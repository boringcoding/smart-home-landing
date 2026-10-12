import * as THREE from 'three';
import { GpuSubmissionFence } from './GpuSubmissionFence';
import { STOCK_SHADOW_CHUNK, EXPLICIT_SHADOW_CHUNK } from './explicitShadowSampling';

export interface ShadowSamplingValidationCase {
  name: 'unclipped' | 'divergent-and-clipped';
  pixels: number;
  changedPixels: number;
  changedAlphaPixels: number;
  maxChannelDelta: number;
  meanChannelDelta: number;
  drawnPixels: number;
  discardedPixels: number;
  partialShadowPixels: number;
  distinctRgbValues: number;
  stockChecksum: string;
  explicitChecksum: string;
  gpuWaitMs: { stock: number; explicit: number };
  differences: Array<{ x: number; y: number; stock: number[]; explicit: number[] }>;
}

export interface ShadowSamplingValidationReport {
  passed: boolean;
  fixture: 'pcf-soft-rgba8-v1';
  threeRevision: string;
  width: number;
  height: number;
  comparedPixels: number;
  textureState: {
    width: number;
    height: number;
    format: 'RGBA8';
    minFilter: 'Nearest';
    magFilter: 'Nearest';
    mipmaps: false;
    anisotropy: 1;
  };
  cases: ShadowSamplingValidationCase[];
}

const SIZE = 128;
const DEPTH_SIZE = 64;
const activeRenderers = new WeakSet<THREE.WebGLRenderer>();

function makeDepthTexture(): THREE.DataTexture {
  const bytes = new Uint8Array(DEPTH_SIZE * DEPTH_SIZE * 4);
  for (let y = 0; y < DEPTH_SIZE; y++) {
    for (let x = 0; x < DEPTH_SIZE; x++) {
      // Ramps and hard edges exercise fractional PCF weights and clamp-to-edge.
      const checker = (Math.floor(x / 7) + Math.floor(y / 9)) % 2;
      const depth = .06 + .88 * (.46 * x / (DEPTH_SIZE - 1) + .34 * y / (DEPTH_SIZE - 1) + .20 * checker);
      const packed = Math.floor(depth * 16777216);
      const offset = (y * DEPTH_SIZE + x) * 4;
      // Exactly packDepthToRGBA for a depth on the 24-bit grid: its final
      // fractional byte is zero, and unpackRGBAToDepth recovers packed / 2^24.
      bytes[offset] = packed >>> 16;
      bytes[offset + 1] = packed >>> 8 & 255;
      bytes[offset + 2] = packed & 255;
    }
  }
  bytes.fill(0, 0, 4);
  bytes.fill(255, bytes.length - 4);
  const texture = new THREE.DataTexture(bytes, DEPTH_SIZE, DEPTH_SIZE, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.name = 'shadow-validation-packed-depth';
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.anisotropy = 1;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function materialFor(chunk: string, depth: THREE.DataTexture): THREE.RawShaderMaterial {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
    uniforms: { depthFixture: { value: depth }, fixtureCase: { value: 0 } },
    vertexShader: `
      precision highp float;
      in vec3 position;
      out vec2 fixtureUv;
      void main() {
        fixtureUv = position.xy * 0.5 + 0.5;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      precision highp int;
      precision highp sampler2D;
      #define texture2D texture
      #define USE_SHADOWMAP
      #define SHADOWMAP_TYPE_PCF_SOFT
      ${THREE.ShaderChunk.packing}
      ${chunk}
      uniform sampler2D depthFixture;
      uniform int fixtureCase;
      in vec2 fixtureUv;
      out vec4 outputColor;
      void main() {
        vec2 uv = fixtureUv * 0.9 + 0.05;
        if (fixtureCase == 1) {
          // Like local clipping, a varying condition discards before sampling.
          if (fixtureUv.x + 0.47 * fixtureUv.y < 0.31) discard;
          if (mod(floor(fixtureUv.x * 37.0) + floor(fixtureUv.y * 29.0), 5.0) < 1.0) discard;
          // Adjacent fragments take different lookup branches. The wider UV
          // range also exercises getShadow's own varying frustum condition.
          if (mod(floor(fixtureUv.x * 31.0) + floor(fixtureUv.y * 23.0), 3.0) < 1.0) {
            outputColor = vec4(0.05, 0.15, 0.25, 1.0);
            return;
          }
          uv = fixtureUv * 1.4 - 0.2;
        }
        float z = 0.2 + 0.6 * fixtureUv.y;
        float r = getShadow(depthFixture, vec2(${DEPTH_SIZE}.0), 1.0, 0.0, 1.0, vec4(uv, z, 1.0));
        float g = getShadow(depthFixture, vec2(${DEPTH_SIZE}.0), 1.0, -0.07, 1.0, vec4(uv, z, 1.0));
        float b = getShadow(depthFixture, vec2(${DEPTH_SIZE}.0), 0.83, 0.11, 1.0, vec4(uv, z, 1.0));
        outputColor = vec4(r, g, b, 1.0);
      }
    `,
  });
}

function checksum(bytes: Uint8Array): string {
  let hash = 2166136261;
  for (const value of bytes) hash = Math.imul(hash ^ value, 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function compare(name: ShadowSamplingValidationCase['name'], stock: Uint8Array, explicit: Uint8Array, gpuWaitMs: ShadowSamplingValidationCase['gpuWaitMs']): ShadowSamplingValidationCase {
  let changedPixels = 0, changedAlphaPixels = 0, maxChannelDelta = 0, totalDelta = 0, drawnPixels = 0, partialShadowPixels = 0;
  const distinct = new Set<number>();
  const differences: ShadowSamplingValidationCase['differences'] = [];
  for (let offset = 0; offset < stock.length; offset += 4) {
    let changed = false;
    for (let channel = 0; channel < 3; channel++) {
      const delta = Math.abs(stock[offset + channel] - explicit[offset + channel]);
      maxChannelDelta = Math.max(maxChannelDelta, delta);
      totalDelta += delta;
      changed ||= delta !== 0;
    }
    if (changed) changedPixels++;
    if (stock[offset + 3] !== explicit[offset + 3]) changedAlphaPixels++;
    if ((changed || stock[offset + 3] !== explicit[offset + 3]) && differences.length < 8) {
      differences.push({ x: offset / 4 % SIZE, y: Math.floor(offset / 4 / SIZE), stock: Array.from(stock.subarray(offset, offset + 4)), explicit: Array.from(explicit.subarray(offset, offset + 4)) });
    }
    if (stock[offset + 3] === 255) {
      drawnPixels++;
      distinct.add(stock[offset] * 65536 + stock[offset + 1] * 256 + stock[offset + 2]);
      // Only the red channel counts: blue deliberately includes shadowIntensity.
      if (stock[offset] > 0 && stock[offset] < 255) partialShadowPixels++;
    }
  }
  return { name, pixels: SIZE * SIZE, changedPixels, changedAlphaPixels, maxChannelDelta, meanChannelDelta: totalDelta / (SIZE * SIZE * 3), drawnPixels, discardedPixels: SIZE * SIZE - drawnPixels, partialShadowPixels, distinctRgbValues: distinct.size, stockChecksum: checksum(stock), explicitChecksum: checksum(explicit), gpuWaitMs, differences };
}

/** Local diagnostic only. The caller must pause scene submissions and finish its
 * current GPU fence before calling. No renderer, context, canvas, or visible draw
 * is created. An abort during GPU work is terminal for this validation run; the
 * caller must not resume a renderer it has already disposed.
 */
export async function runShadowSamplingValidation(renderer: THREE.WebGLRenderer, signal?: AbortSignal): Promise<ShadowSamplingValidationReport> {
  signal?.throwIfAborted();
  if (activeRenderers.has(renderer)) throw new Error('Shadow sampling validation is already running.');
  const gl = renderer.getContext() as WebGL2RenderingContext;
  if (gl.isContextLost()) throw new Error('Cannot validate shadow sampling on a lost context.');
  if (renderer.xr.isPresenting) throw new Error('Shadow sampling validation requires a non-XR renderer.');
  if (STOCK_SHADOW_CHUNK === EXPLICIT_SHADOW_CHUNK) throw new Error('Shadow validation requires distinct stock and explicit shader sources.');
  activeRenderers.add(renderer);

  const previous = { target: renderer.getRenderTarget(), face: renderer.getActiveCubeFace(), mip: renderer.getActiveMipmapLevel(), clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), autoClear: renderer.autoClear, xrEnabled: renderer.xr.enabled };
  const depth = makeDepthTexture();
  const materials = [materialFor(STOCK_SHADOW_CHUNK, depth), materialFor(EXPLICIT_SHADOW_CHUNK, depth)];
  materials[0].name = 'shadow-validation-stock';
  materials[1].name = 'shadow-validation-explicit-lod0';
  const targets = materials.map((_, i) => {
    const target = new THREE.WebGLRenderTarget(SIZE, SIZE, { format: THREE.RGBAFormat, type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false, samples: 0 });
    target.texture.name = `shadow-validation-${i}`;
    target.texture.colorSpace = THREE.NoColorSpace;
    return target;
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, materials[0]);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  const camera = new THREE.Camera();
  const fence = new GpuSubmissionFence<{ name: string; variant: string }>(gl, { timeoutMs: 10_000, collectErrors: true });
  const cases: ShadowSamplingValidationCase[] = [];
  try {
    renderer.autoClear = false;
    renderer.xr.enabled = false;
    renderer.setClearColor(0, 0);
    for (const [caseIndex, name] of (['unclipped', 'divergent-and-clipped'] as const).entries()) {
      const pixels: Uint8Array[] = [];
      const waits: number[] = [];
      for (let variant = 0; variant < 2; variant++) {
        signal?.throwIfAborted();
        mesh.material = materials[variant];
        mesh.material.uniforms.fixtureCase.value = caseIndex;
        // setRenderTarget uses the target's physical 128px viewport. Calling
        // setViewport(128px) here would incorrectly multiply it by device DPR.
        renderer.setRenderTarget(targets[variant]);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Shadow validation framebuffer is incomplete.');
        renderer.clear(true, false, false);
        renderer.render(scene, camera);
        const submitted = fence.submit({ name, variant: variant === 0 ? 'stock' : 'explicit' });
        if (submitted.status === 'error') throw new Error(`Shadow validation GPU submission failed: ${submitted.reason}`);
        let waitMs = 0;
        for (;;) {
          signal?.throwIfAborted();
          const completion = fence.poll();
          if (completion.status === 'complete') {
            if (completion.errors?.length) throw new Error(`Shadow validation GL errors: ${completion.errors.join(',')}`);
            waitMs = completion.elapsedMs ?? 0;
            break;
          }
          if (completion.status === 'error') throw new Error(`Shadow validation GPU completion failed: ${completion.reason}`);
          await new Promise<void>(resolve => setTimeout(resolve, 4));
        }
        const output = new Uint8Array(SIZE * SIZE * 4);
        renderer.readRenderTargetPixels(targets[variant], 0, 0, SIZE, SIZE, output);
        if (gl.isContextLost()) throw new Error('Context was lost during shadow validation readback.');
        const readError = gl.getError();
        if (readError !== gl.NO_ERROR) throw new Error(`Shadow validation readback GL error: ${readError}`);
        pixels.push(output); waits.push(waitMs);
      }
      cases.push(compare(name, pixels[0], pixels[1], { stock: waits[0], explicit: waits[1] }));
    }
    const passed = cases.every(result => result.changedPixels === 0 && result.changedAlphaPixels === 0 && result.drawnPixels > SIZE * SIZE / 3 && result.distinctRgbValues > 32 && result.partialShadowPixels > 64)
      && cases[0].discardedPixels === 0 && cases[1].discardedPixels > 0;
    return { passed, fixture: 'pcf-soft-rgba8-v1', threeRevision: THREE.REVISION, width: SIZE, height: SIZE, comparedPixels: SIZE * SIZE * cases.length, textureState: { width: DEPTH_SIZE, height: DEPTH_SIZE, format: 'RGBA8', minFilter: 'Nearest', magFilter: 'Nearest', mipmaps: false, anisotropy: 1 }, cases };
  } finally {
    fence.dispose();
    renderer.autoClear = previous.autoClear;
    renderer.xr.enabled = previous.xrEnabled;
    if (!gl.isContextLost()) {
      renderer.setClearColor(previous.clear, previous.alpha);
      renderer.setRenderTarget(previous.target, previous.face, previous.mip);
    }
    targets.forEach(target => target.dispose());
    materials.forEach(material => material.dispose());
    geometry.dispose(); depth.dispose();
    activeRenderers.delete(renderer);
  }
}

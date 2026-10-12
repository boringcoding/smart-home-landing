import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { WebGLShadowMap } from 'three/src/renderers/webgl/WebGLShadowMap.js';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

// Keep the stock RGBA/PCF backend; only its level-zero lookup is deliberately patched.
// These contracts deliberately require review before upgrading the renderer again.
test('pinned Three receivers unpack ordinary RGBA textures for stock PCF Soft', () => {
  const manifest = JSON.parse(read('../package.json'));
  assert.equal(manifest.dependencies.three, '0.181.2');
  assert.equal(THREE.REVISION, '181');
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  assert.match(chunk, /uniform sampler2D directionalShadowMap\[/);
  assert.match(chunk, /float depth = unpackRGBAToDepth\( texture2D\( depths, uv \) \);/);
  assert.doesNotMatch(chunk, /sampler2DShadow|smartHouseCompareShadowDepth/);
  const soft = chunk.split('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )')[1]?.split('#elif defined( SHADOWMAP_TYPE_VSM )')[0];
  assert.ok(soft, 'stock PCF Soft must have its own supported shader branch');
  assert.match(soft, /texture2DCompare\( shadowMap,/);
  assert.match(soft, /mix\(/, 'soft edges interpolate depth comparisons in shader code');
  assert.match(soft, /\* \( 1\.0 \/ 9\.0 \)/);
  assert.match(chunk, /return mix\( 1\.0, shadow, shadowIntensity \);/);
});

test('installed shadow renderer allocates RGBA8 and retains per-mesh clipping and depth packing', () => {
  // Run the real dependency's allocation/material selection without creating a GPU context.
  const draws: Array<{ material: THREE.MeshDepthMaterial; object: THREE.Mesh }> = [];
  const renderer = {
    localClippingEnabled: true,
    getRenderTarget: () => null,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    setRenderTarget: () => {},
    clear: () => {},
    state: {
      setBlending: () => {}, setScissorTest: () => {}, viewport: () => {},
      buffers: { color: { setClear: () => {} }, depth: { getReversed: () => false, setTest: () => {} } },
    },
    renderBufferDirect: (_camera: THREE.Camera, _scene: unknown, _geometry: THREE.BufferGeometry, material: THREE.MeshDepthMaterial, object: THREE.Mesh) => {
      draws.push({ material, object });
    },
  };
  const shadows = new WebGLShadowMap(
    renderer as unknown as THREE.WebGLRenderer,
    { update: (object: THREE.Mesh) => object.geometry } as ConstructorParameters<typeof WebGLShadowMap>[1],
    { maxTextureSize: 4096 } as ConstructorParameters<typeof WebGLShadowMap>[2],
  );
  shadows.enabled = true;
  shadows.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), light = new THREE.DirectionalLight(), camera = new THREE.PerspectiveCamera();
  light.shadow.mapSize.set(1024, 1024);
  const material = new THREE.MeshStandardMaterial();
  material.clipShadows = true;
  material.clipIntersection = true;
  material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), .82)];
  const plain = new THREE.Mesh(new THREE.BoxGeometry(), material);
  const custom = new THREE.Mesh(plain.geometry, material);
  custom.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  for (const mesh of [plain, custom]) { mesh.castShadow = true; mesh.frustumCulled = false; scene.add(mesh); }
  scene.add(light, light.target);
  scene.updateMatrixWorld(true);
  try {
    shadows.render([light], scene, camera);
    const map = light.shadow.map;
    assert.ok(map);
    assert.equal(map.width, 1024);
    assert.equal(map.texture.format, THREE.RGBAFormat);
    assert.equal(map.texture.type, THREE.UnsignedByteType);
    assert.equal(map.texture.colorSpace, THREE.NoColorSpace);
    assert.equal(map.texture.minFilter, THREE.NearestFilter);
    assert.equal(map.texture.magFilter, THREE.NearestFilter);
    assert.equal(map.texture.wrapS, THREE.ClampToEdgeWrapping);
    assert.equal(map.texture.wrapT, THREE.ClampToEdgeWrapping);
    assert.equal(map.texture.generateMipmaps, false, 'explicit LOD 0 must retain all available shadow detail');
    assert.equal(map.texture.mipmaps.length, 0);
    assert.equal(map.depthTexture, null, 'native depth must never be sampled by receivers');
    assert.equal(map.depthBuffer, true, 'casters still need depth testing through a renderbuffer');
    assert.equal(map.samples, 0);
    assert.equal(draws.length, 2);
    assert.equal(draws.find(draw => draw.object === custom)?.material, custom.customDepthMaterial);
    for (const { material: depth } of draws) {
      assert.equal(depth.depthPacking, THREE.RGBADepthPacking);
      assert.equal(depth.clippingPlanes, material.clippingPlanes, 'cutaway and cabinet clipping must reach the shadow pass');
      assert.equal(depth.clipIntersection, true);
      assert.equal(depth.clipShadows, true);
    }
  } finally {
    light.shadow.dispose();
    for (const depth of new Set([...draws.map(draw => draw.material), custom.customDepthMaterial])) depth.dispose();
    plain.geometry.dispose(); material.dispose();
  }
});

test('RGBA targets use the dependency renderbuffer path and packed caster output', () => {
  const textures = read('../node_modules/three/src/renderers/webgl/WebGLTextures.js');
  assert.match(textures, /if \( renderTarget\.depthTexture && ! renderTargetProperties\.__autoAllocateDepthBuffer \)/);
  assert.match(textures, /__webglDepthbuffer = _gl\.createRenderbuffer\(\);\s*setupRenderBufferStorage/);
  assert.match(textures, /glType === _gl\.UNSIGNED_BYTE \) internalFormat = \( transfer === SRGBTransfer \) \? _gl\.SRGB8_ALPHA8 : _gl\.RGBA8/);
  const depth = THREE.ShaderLib.depth;
  assert.match(depth.fragmentShader, /#elif DEPTH_PACKING == 3201\s+gl_FragColor = packDepthToRGBA\( fragCoordZ \);/);
  assert.match(depth.vertexShader, /#include <morphtarget_vertex>/, 'moving curtain meshes must cast their current shape');
  assert.match(depth.fragmentShader, /#include <clipping_planes_fragment>/);
});

test('production scene selects the stock filter and explicitly packs custom shadow materials', () => {
  const scene = read('../src/scene/Scene.tsx');
  const selected = [...scene.matchAll(/renderer\.shadowMap\.type\s*=\s*([^;]+);/g)].map(match => match[1].trim());
  assert.ok(selected.length > 0);
  assert.ok(selected.every(value => value === 'THREE.PCFSoftShadowMap'), 'initialization and quality changes must select the same packed backend');
  assert.match(scene, /customDepthMaterial\s*=\s*new THREE\.MeshDepthMaterial\(\s*\{\s*depthPacking\s*:\s*THREE\.RGBADepthPacking\s*\}\s*\)/);
  assert.match(scene, /installExplicitShadowSampling\(\)/, 'install only the reviewed level-zero lookup before rendering');
  assert.doesNotMatch(scene, /installPortableShadows|ShaderChunk\./, 'keep shader mutation inside the guarded sampling module');
});

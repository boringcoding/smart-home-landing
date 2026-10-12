import { REVISION, ShaderChunk } from 'three';

export const SHADOW_SAMPLING_MODE = 'explicit-lod0' as const;
export const IMPLICIT_SHADOW_LOOKUP = 'texture2D( depths, uv )';
export const EXPLICIT_SHADOW_LOOKUP = 'textureLod( depths, uv, 0.0 )';

export const ORIGINAL_SHADOW_COMPARE_SOURCE = `float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
  float depth = unpackRGBAToDepth( texture2D( depths, uv ) );
  #ifdef USE_REVERSED_DEPTH_BUFFER
    return step( depth, compare );
  #else
    return step( compare, depth );
  #endif
}`;
export const EXPLICIT_SHADOW_COMPARE_SOURCE = ORIGINAL_SHADOW_COMPARE_SOURCE.replace(IMPLICIT_SHADOW_LOOKUP, EXPLICIT_SHADOW_LOOKUP);

const compact = (source: string) => source.replace(/\s+/g, '');

/**
 * Reviewed against the published three@0.181.2 shader, including its bundled form.
 * r181 PCF maps use Nearest min/mag, ClampToEdge and no mipmaps: explicit level 0
 * preserves every texel comparison and the unchanged PCF Soft interpolation.
 * This isolates receiver sampling after the Pixel GPU completed both material
 * and caster passes. It does not establish which driver instruction caused loss.
 * GLSL ES 3.00 §8.8: explicit LOD avoids implicit derivative selection, including
 * receivers reached after clipping discard or varying shadow-frustum branches.
 */
export function patchExplicitShadowSampling(source: string, revision: string = REVISION): string {
  if (revision !== '181') throw new Error('Explicit shadow sampling requires reviewed Three r181.');
  const declarations = [...source.matchAll(/\bfloat\s+texture2DCompare\s*\(/g)];
  if (declarations.length !== 1) throw new Error('Expected exactly one reviewed texture2DCompare helper.');
  const start = declarations[0].index!;
  const end = source.indexOf('}', start);
  if (end < 0) throw new Error('Incomplete texture2DCompare helper.');
  const helper = source.slice(start, end + 1);
  if (compact(helper) === compact(EXPLICIT_SHADOW_COMPARE_SOURCE)) return source;
  if (compact(helper) !== compact(ORIGINAL_SHADOW_COMPARE_SOURCE)) {
    throw new Error('texture2DCompare differs from the reviewed Three r181 shader.');
  }
  const patched = helper.replace(/\btexture2D\s*\(\s*depths\s*,\s*uv\s*\)/, EXPLICIT_SHADOW_LOOKUP);
  return source.slice(0, start) + patched + source.slice(end + 1);
}

// Capture both complete sources before installation, for the same-context GPU A/B fixture.
export const STOCK_SHADOW_CHUNK = ShaderChunk.shadowmap_pars_fragment;
if (!STOCK_SHADOW_CHUNK.includes(IMPLICIT_SHADOW_LOOKUP) || STOCK_SHADOW_CHUNK.includes(EXPLICIT_SHADOW_LOOKUP)) {
  throw new Error('Expected stock Three shadow source before explicit sampling installation.');
}
export const EXPLICIT_SHADOW_CHUNK = patchExplicitShadowSampling(STOCK_SHADOW_CHUNK);

/** Call before the first renderer compilation. Repeated scene mounts do not repatch. */
export function installExplicitShadowSampling() {
  const previous = ShaderChunk.shadowmap_pars_fragment;
  const patched = patchExplicitShadowSampling(previous);
  if (patched !== previous) ShaderChunk.shadowmap_pars_fragment = patched;
  return { sampling: SHADOW_SAMPLING_MODE, threeRevision: REVISION, installed: patched !== previous };
}

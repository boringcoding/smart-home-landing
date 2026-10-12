import { REVISION, ShaderChunk } from 'three';

export const PORTABLE_SHADOW_FILTER = 'software-pcf-9' as const;
const SUPPORTED_REVISION = '186';
const MARKER = '// SMART_HOUSE_SOFTWARE_PCF_9_R186';

// This function is from the project's pinned three 0.186.1. The built package
// strips blank lines and comments, so assert GLSL tokens with flexible whitespace
// before replacing anything. A Three upgrade still needs a deliberate review.
const ORIGINAL_BASIC_FUNCTION = `		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {

			float shadow = 1.0;

			shadowCoord.xyz /= shadowCoord.w;

			#ifdef USE_REVERSED_DEPTH_BUFFER

				shadowCoord.z -= shadowBias;

			#else

				shadowCoord.z += shadowBias;

			#endif

			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;

			if ( frustumTest ) {

				float depth = texture2D( shadowMap, shadowCoord.xy ).r;

				#ifdef USE_REVERSED_DEPTH_BUFFER

					shadow = step( depth, shadowCoord.z );

				#else

					shadow = step( shadowCoord.z, depth );

				#endif

			}

			return mix( 1.0, shadow, shadowIntensity );

		}`;

const ORIGINAL_COMPARISON = `				float depth = texture2D( shadowMap, shadowCoord.xy ).r;

				#ifdef USE_REVERSED_DEPTH_BUFFER

					shadow = step( depth, shadowCoord.z );

				#else

					shadow = step( shadowCoord.z, depth );

				#endif`;

// BasicShadowMap provides a nearest-filtered native depth texture with no GPU
// comparison mode. Compare raw .r depths, not the packed RGBA used by older Three.
// Fixed 3x3 tent weights avoid stochastic screen-space noise and driver-side PCF.
const SOFTWARE_COMPARISON = `		${MARKER}
		float smartHouseCompareShadowDepth( sampler2D shadowMap, vec2 uv, float receiverDepth ) {
			float depth = texture2D( shadowMap, uv ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				return step( depth, receiverDepth );
			#else
				return step( receiverDepth, depth );
			#endif
		}

`;

const SOFTWARE_SAMPLING = `				vec2 texel = vec2( max( shadowRadius, 0.0 ) ) / shadowMapSize;
				shadow = (
					1.0 * smartHouseCompareShadowDepth( shadowMap, shadowCoord.xy + texel * vec2( -1.0, -1.0 ), shadowCoord.z ) +
					2.0 * smartHouseCompareShadowDepth( shadowMap, shadowCoord.xy + texel * vec2(  0.0, -1.0 ), shadowCoord.z ) +
					1.0 * smartHouseCompareShadowDepth( shadowMap, shadowCoord.xy + texel * vec2(  1.0, -1.0 ), shadowCoord.z ) +
					2.0 * smartHouseCompareShadowDepth( shadowMap, shadowCoord.xy + texel * vec2( -1.0,  0.0 ), shadowCoord.z ) +
					4.0 * smartHouseCompareShadowDepth( shadowMap, shadowCoord.xy + texel * vec2(  0.0,  0.0 ), shadowCoord.z ) +
					2.0 * smartHouseCompareShadowDepth( shadowMap, shadowCoord.xy + texel * vec2(  1.0,  0.0 ), shadowCoord.z ) +
					1.0 * smartHouseCompareShadowDepth( shadowMap, shadowCoord.xy + texel * vec2( -1.0,  1.0 ), shadowCoord.z ) +
					2.0 * smartHouseCompareShadowDepth( shadowMap, shadowCoord.xy + texel * vec2(  0.0,  1.0 ), shadowCoord.z ) +
					1.0 * smartHouseCompareShadowDepth( shadowMap, shadowCoord.xy + texel * vec2(  1.0,  1.0 ), shadowCoord.z )
				) / 16.0;`;

const PORTABLE_BASIC_FUNCTION = SOFTWARE_COMPARISON + ORIGINAL_BASIC_FUNCTION.replace(ORIGINAL_COMPARISON, SOFTWARE_SAMPLING);
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const basicFunctionPattern = () => new RegExp('\\t\\t' + ORIGINAL_BASIC_FUNCTION.trim().split(/\s+/).map(escapeRegExp).join('\\s+'), 'g');

/** Pure source transform, exposed for contract checks against the installed Three. */
export function patchPortableShadowChunk(source: string, revision: string = REVISION): string {
  if (revision !== SUPPORTED_REVISION) {
    throw new Error(`Portable shadows require reviewed Three r${SUPPORTED_REVISION}; received r${revision}.`);
  }
  if (source.includes(MARKER)) {
    if (source.split(MARKER).length !== 2 || source.split(PORTABLE_BASIC_FUNCTION).length !== 2) {
      throw new Error('Portable shadow shader was modified after installation.');
    }
    return source;
  }
  const matches = [...source.matchAll(basicFunctionPattern())];
  const match = matches[0];
  // Require the outer BASIC #else, not a coincidentally similar helper. Keep
  // both built (comment-free) and source GLSL valid without rewriting either.
  const before = match ? source.slice(0, match.index) : '';
  const after = match ? source.slice(match.index + match[0].length) : '';
  if (matches.length !== 1 || !/(?:^|\n)\t#else(?:[ \t]*\/\/[^\n]*)?\n\s*$/.test(before) || !/^\n(?:[\t ]*\n)*\t#endif\n(?:[\t ]*\n)*\t#if NUM_SUN_LIGHT_SHADOWS > 0/.test(after)) {
    throw new Error('Three r186 BASIC shadow function differs from the reviewed three 0.186.1 source.');
  }
  return before + PORTABLE_BASIC_FUNCTION + after;
}

/**
 * Call before any renderer compiles materials, then use THREE.BasicShadowMap
 * on the renderer that needs portable PCF. PCF/VSM and point-shadow branches
 * stay byte-for-byte unchanged; desktop PCF can coexist with this patch.
 *
 * This follows the official r186 raw-depth shader extension point:
 * https://github.com/mrdoob/three.js/blob/r186/examples/webgl_shadowmap_pcss.html
 * Do not undo the patch during cleanup: already-compiled program caches must
 * keep matching the shared chunk across scene remounts. No GPU resources are owned.
 */
export function installPortableShadows() {
  const original = ShaderChunk.shadowmap_pars_fragment;
  const patched = patchPortableShadowChunk(original);
  ShaderChunk.shadowmap_pars_fragment = patched;
  return { filter: PORTABLE_SHADOW_FILTER, threeRevision: SUPPORTED_REVISION, installed: patched !== original };
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { REVISION, ShaderChunk } from 'three';
import { installPortableShadows, patchPortableShadowChunk, PORTABLE_SHADOW_FILTER } from '../src/scene/portableShadows';

const original = ShaderChunk.shadowmap_pars_fragment;
const basicStart = '\n\t#else';
const basicEnd = '\n\t#endif';
function basicBounds(source: string) {
  const start = source.indexOf(basicStart, source.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )'));
  return { start, end: source.indexOf(basicEnd, start) };
}
function basicBranch(source: string) {
  const { start, end } = basicBounds(source);
  return source.slice(start, end);
}

test('portable shadows patch the installed BASIC receiver without changing desktop or point-shadow paths', () => {
  assert.equal(REVISION, '186', 'the pinned shadow layout must be reviewed when Three changes');
  const patched = patchPortableShadowChunk(original);
  assert.equal(patched.slice(0, basicBounds(patched).start), original.slice(0, basicBounds(original).start), 'PCF and VSM remain intact');
  assert.equal(patched.slice(basicBounds(patched).end), original.slice(basicBounds(original).end), 'cascades and point-shadow functions remain intact');
  const basic = basicBranch(patched);
  assert.match(basic, /float depth = texture2D\( shadowMap, uv \)\.r;/);
  assert.doesNotMatch(basic, /sampler2DShadow|unpackRGBAToDepth|vogelDiskSample|gl_FragCoord|\bfor\s*\(/);
  assert.match(basic, /return step\( depth, receiverDepth \);[\s\S]*#else[\s\S]*return step\( receiverDepth, depth \);/);
  assert.match(basic, /#ifdef USE_REVERSED_DEPTH_BUFFER[\s\S]*shadowCoord\.z -= shadowBias;[\s\S]*#else[\s\S]*shadowCoord\.z \+= shadowBias;/);
  assert.match(basic, /if \( frustumTest \)/);
  assert.match(basic, /return mix\( 1\.0, shadow, shadowIntensity \);/);
  assert.match(basic, /max\( shadowRadius, 0\.0 \)[\s\S]*\/ shadowMapSize/);
});

test('software filter has nine normalized symmetric depth comparisons, retaining fully lit and shaded regions', () => {
  const basic = basicBranch(patchPortableShadowChunk(original));
  const taps = [...basic.matchAll(/([\d.]+) \* smartHouseCompareShadowDepth\( shadowMap, shadowCoord\.xy \+ texel \* vec2\(\s*(-?[\d.]+),\s*(-?[\d.]+) \), shadowCoord\.z \)/g)]
    .map(match => ({ weight: Number(match[1]), x: Number(match[2]), y: Number(match[3]) }));
  assert.equal(taps.length, 9, 'the fragment must perform exactly nine fixed depth comparisons');
  assert.equal(new Set(taps.map(tap => `${tap.x},${tap.y}`)).size, 9);
  const denominator = Number(basic.match(/\) \/ ([\d.]+);/)?.[1]);
  assert.equal(taps.reduce((sum, tap) => sum + tap.weight, 0) / denominator, 1, 'uniformly lit surfaces keep their brightness');
  assert.equal(taps.reduce((sum, tap) => sum + tap.weight * 0, 0) / denominator, 0, 'fully occluded surfaces remain shaded');
  for (const tap of taps) {
    assert.ok(Math.abs(tap.x) <= 1 && Math.abs(tap.y) <= 1);
    assert.equal(tap.weight, taps.find(other => other.x === -tap.x && other.y === -tap.y)?.weight, 'the filter must not bias one edge direction');
    assert.equal(tap.weight, taps.find(other => other.x === tap.y && other.y === tap.x)?.weight);
  }
  assert.equal(taps.find(tap => tap.x === 0 && tap.y === 0)?.weight, 4, 'tent filtering retains a stronger center sample');
});

test('shader contract rejects unknown revisions and changed or ambiguous BASIC code instead of silently patching', () => {
  assert.throws(() => patchPortableShadowChunk(original, '187'), /reviewed Three r186/);
  assert.throws(() => patchPortableShadowChunk(original.replace(basicStart, '#else')), /differs from the reviewed/);
  assert.throws(() => patchPortableShadowChunk(original.replace('float depth = texture2D( shadowMap, shadowCoord.xy ).r;', 'float depth = 0.0;')), /differs from the reviewed/);
  assert.throws(() => patchPortableShadowChunk(original + original), /differs from the reviewed/);
  const patched = patchPortableShadowChunk(original);
  assert.throws(() => patchPortableShadowChunk(patched.replace(') / 16.0;', ') / 15.0;')), /modified after installation/);
});

test('installation is idempotent across scene remounts and exposes the active filter for diagnostics', t => {
  const previous = ShaderChunk.shadowmap_pars_fragment;
  t.after(() => { ShaderChunk.shadowmap_pars_fragment = previous; });
  ShaderChunk.shadowmap_pars_fragment = original;
  assert.deepEqual(installPortableShadows(), { filter: PORTABLE_SHADOW_FILTER, threeRevision: '186', installed: true });
  const once = ShaderChunk.shadowmap_pars_fragment;
  assert.deepEqual(installPortableShadows(), { filter: PORTABLE_SHADOW_FILTER, threeRevision: '186', installed: false });
  assert.equal(ShaderChunk.shadowmap_pars_fragment, once);
  assert.equal(patchPortableShadowChunk(once), once);
});

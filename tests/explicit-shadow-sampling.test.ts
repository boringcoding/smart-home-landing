import assert from 'node:assert/strict';
import test from 'node:test';
import { ShaderChunk } from 'three';
import {
  EXPLICIT_SHADOW_CHUNK, EXPLICIT_SHADOW_LOOKUP, IMPLICIT_SHADOW_LOOKUP,
  STOCK_SHADOW_CHUNK, installExplicitShadowSampling, patchExplicitShadowSampling,
} from '../src/scene/explicitShadowSampling';

test('explicit LOD changes only the reviewed lookup, preserving the entire PCF Soft kernel and receiver branches', () => {
  assert.equal(EXPLICIT_SHADOW_CHUNK, STOCK_SHADOW_CHUNK.replace(IMPLICIT_SHADOW_LOOKUP, EXPLICIT_SHADOW_LOOKUP));
  assert.equal(patchExplicitShadowSampling(STOCK_SHADOW_CHUNK), EXPLICIT_SHADOW_CHUNK);
  assert.equal(patchExplicitShadowSampling(EXPLICIT_SHADOW_CHUNK), EXPLICIT_SHADOW_CHUNK);
  const kernel = (chunk: string) => chunk.split('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )')[1].split('#elif defined( SHADOWMAP_TYPE_VSM )')[0];
  assert.equal(kernel(EXPLICIT_SHADOW_CHUNK), kernel(STOCK_SHADOW_CHUNK));
  assert.equal([...kernel(EXPLICIT_SHADOW_CHUNK).matchAll(/texture2DCompare\(/g)].length, 16);
  assert.match(EXPLICIT_SHADOW_CHUNK, /unpackRGBAToDepth\( textureLod\( depths, uv, 0\.0 \) \)/);
});

test('unknown revisions, missing or ambiguous helpers and modified comparisons cannot be patched silently', () => {
  assert.throws(() => patchExplicitShadowSampling(STOCK_SHADOW_CHUNK, '182'), /reviewed Three r181/);
  assert.throws(() => patchExplicitShadowSampling(STOCK_SHADOW_CHUNK.replace('float texture2DCompare', 'float otherCompare')), /exactly one/);
  assert.throws(() => patchExplicitShadowSampling(STOCK_SHADOW_CHUNK + STOCK_SHADOW_CHUNK), /exactly one/);
  assert.throws(() => patchExplicitShadowSampling(STOCK_SHADOW_CHUNK.replace('return step( compare, depth );', 'return 1.0;')), /differs from the reviewed/);
  assert.throws(() => patchExplicitShadowSampling(EXPLICIT_SHADOW_CHUNK.replace('depths, uv, 0.0', 'depths, uv, 1.0')), /differs from the reviewed/);
  const reformatted = STOCK_SHADOW_CHUNK.replace(/\n/g, '\n\n');
  assert.equal(patchExplicitShadowSampling(reformatted), reformatted.replace(IMPLICIT_SHADOW_LOOKUP, EXPLICIT_SHADOW_LOOKUP));
});

test('installation is idempotent across scene remounts and retains the unmodified A/B source', t => {
  const previous = ShaderChunk.shadowmap_pars_fragment;
  t.after(() => { ShaderChunk.shadowmap_pars_fragment = previous; });
  ShaderChunk.shadowmap_pars_fragment = STOCK_SHADOW_CHUNK;
  assert.deepEqual(installExplicitShadowSampling(), { sampling: 'explicit-lod0', threeRevision: '181', installed: true });
  assert.deepEqual(installExplicitShadowSampling(), { sampling: 'explicit-lod0', threeRevision: '181', installed: false });
  assert.equal(ShaderChunk.shadowmap_pars_fragment, EXPLICIT_SHADOW_CHUNK);
  assert.ok(STOCK_SHADOW_CHUNK.includes(IMPLICIT_SHADOW_LOOKUP));
});


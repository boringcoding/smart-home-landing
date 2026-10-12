import assert from 'node:assert/strict';
import test from 'node:test';
import { drawingPixelRatio, renderQuality } from '../src/scene/renderQuality';

function bufferPixels(profile: ReturnType<typeof renderQuality>, width: number, height: number, nativeDpr: number, mobile: boolean) {
  const ratio = drawingPixelRatio(profile, width, height, nativeDpr, mobile);
  // WebGLRenderer allocates integer drawing-buffer dimensions.
  return Math.floor(width * ratio) * Math.floor(height * ratio);
}

test('mobile auto starts with full materials and useful shadow/detail quality', () => {
  const automatic = renderQuality('auto', true);
  const economy = renderQuality('low', true);
  assert.equal(automatic.compactTextures, false, 'a mobile viewport alone must not replace the full material maps');
  assert.equal(automatic.shadowSize, 1024, 'balanced mobile keeps a real directional shadow map');
  assert.ok(drawingPixelRatio(automatic, 430, 390, 1, true) > 1, 'thin siding must stay legible even at a low native DPR');
  assert.ok(bufferPixels(automatic, 430, 390, 3, true) > bufferPixels(economy, 430, 390, 3, true));
});

test('explicit high increases mobile detail but stays within the 1.8 MP limit', () => {
  const high = renderQuality('high', true);
  const automatic = renderQuality('auto', true);
  const highPixels = bufferPixels(high, 430, 932, 3, true);
  assert.ok(highPixels > bufferPixels(automatic, 430, 932, 3, true), 'high must visibly differ from auto on a tall phone viewport');
  assert.ok(highPixels <= 1_800_000, 'high is still a bounded mobile profile');
  assert.equal(high.compactTextures, false);
  assert.equal(
    drawingPixelRatio(renderQuality('high', true, true), 430, 390, 3, true),
    drawingPixelRatio(high, 430, 390, 3, true),
    'an adaptive auto downgrade must not silently override an explicit high choice',
  );
});

test('economy keeps the direct-render recovery path on any device', () => {
  for (const mobile of [true, false]) {
    const economy = renderQuality('low', mobile);
    assert.equal(economy.compactTextures, true);
    assert.equal(economy.postprocessing, false, 'recovery must never allocate HDR/FXAA render targets');
    assert.equal(economy.shadowSize, 0);
    assert.equal(economy.anisotropy, 1);
    assert.equal(economy.pixelRatio, 1);
    assert.ok(drawingPixelRatio(economy, 932, 430, 3, mobile) <= 1);
    assert.ok(bufferPixels(economy, 932, 430, 3, mobile) <= 650_000);
    assert.deepEqual(renderQuality('low', mobile, true), economy);
  }
});

test('mobile auto and high render directly while keeping their material and shadow detail', () => {
  for (const quality of ['auto', 'high'] as const) {
    for (const adaptiveReduced of [false, true]) {
      const profile = renderQuality(quality, true, adaptiveReduced);
      assert.equal(profile.postprocessing, false, `${quality} must not require floating-point render targets on a phone`);
      assert.equal(profile.compactTextures, false);
      assert.equal(profile.shadowSize, 1024);
      assert.equal(profile.anisotropy, 4);
      assert.equal(profile.pixelBudget, quality === 'high' ? 1_800_000 : 1_200_000);
    }
  }
});

test('desktop auto and high remain eligible for postprocessing', () => {
  for (const quality of ['auto', 'high'] as const) {
    for (const adaptiveReduced of [false, true]) {
      assert.equal(renderQuality(quality, false, adaptiveReduced).postprocessing, true);
    }
  }
});

test('adaptive mobile auto reduces resolution without degrading material or shadow settings', () => {
  const automatic = renderQuality('auto', true);
  const reduced = renderQuality('auto', true, true);
  const { pixelRatio: originalRatio, ...originalDetail } = automatic;
  const { pixelRatio: reducedRatio, ...reducedDetail } = reduced;
  assert.ok(reducedRatio < originalRatio);
  assert.deepEqual(reducedDetail, originalDetail, 'only render resolution may change after a slow-frame downgrade');
  assert.ok(bufferPixels(reduced, 430, 390, 3, true) < bufferPixels(automatic, 430, 390, 3, true));
});

test('portrait, landscape and expanded viewports obey their drawing-buffer budgets', () => {
  const viewports = [[360, 325], [430, 932], [932, 430], [1440, 1024], [1920, 1080]];
  for (const mobile of [true, false]) {
    for (const quality of ['auto', 'high', 'low'] as const) {
      const profile = renderQuality(quality, mobile);
      const limit = quality === 'low' ? 650_000 : mobile ? quality === 'high' ? 1_800_000 : 1_200_000 : 5_000_000;
      for (const [width, height] of viewports) {
        for (const nativeDpr of [1, 2, 3.5]) {
          const context = `${quality}, mobile=${mobile}, ${width}x${height}, DPR=${nativeDpr}`;
          const ratio = drawingPixelRatio(profile, width, height, nativeDpr, mobile);
          assert.ok(Number.isFinite(ratio) && ratio > 0, context);
          assert.ok(ratio <= profile.pixelRatio, context);
          assert.ok(bufferPixels(profile, width, height, nativeDpr, mobile) <= limit, context);
          if (!mobile) assert.ok(ratio <= nativeDpr, `desktop should not supersample above its native display: ${context}`);
        }
      }
    }
  }
});


test('desktop auto can reduce sustained load without discarding material detail',()=>{
  const normal=renderQuality('auto',false),reduced=renderQuality('auto',false,true);
  assert.ok(reduced.pixelRatio<normal.pixelRatio);
  assert.ok(reduced.shadowSize>0&&reduced.shadowSize<normal.shadowSize);
  assert.equal(reduced.compactTextures,false);
  assert.deepEqual(renderQuality('high',false,true),renderQuality('high',false));
});

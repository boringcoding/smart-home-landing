import assert from 'node:assert/strict';
import test from 'node:test';
import { resizeDrawingBuffer } from '../src/scene/drawingBuffer';

function fakeRenderer() {
  const calls: Array<[number, number, number]> = [];
  return {
    calls,
    domElement: { style: { width: '', height: '' } },
    setDrawingBufferSize(width: number, height: number, ratio: number) { calls.push([width, height, ratio]); },
    setPixelRatio() { assert.fail('setPixelRatio would introduce another drawing-buffer reset'); },
    setSize() { assert.fail('setSize would introduce another drawing-buffer reset'); },
  };
}

test('startup, ResizeObserver and unchanged quality requests allocate only once', () => {
  const renderer = fakeRenderer();
  assert.equal(resizeDrawingBuffer(renderer, 430, 390, 2), true);
  assert.equal(resizeDrawingBuffer(renderer, 430, 390, 2), false);
  assert.equal(resizeDrawingBuffer(renderer, 430, 390, 2), false);
  assert.deepEqual(renderer.calls, [[430, 390, 2]]);
  assert.deepEqual(renderer.domElement.style, { width: '430px', height: '390px' });
});

test('each real logical dimension change performs one reset and updates CSS dimensions', () => {
  const renderer = fakeRenderer();
  resizeDrawingBuffer(renderer, 430, 390, 2);
  assert.equal(resizeDrawingBuffer(renderer, 932, 390, 2), true);
  assert.equal(resizeDrawingBuffer(renderer, 932, 430, 2), true);
  assert.equal(resizeDrawingBuffer(renderer, 932, 430, 2), false);
  assert.deepEqual(renderer.calls, [[430, 390, 2], [932, 390, 2], [932, 430, 2]]);
  assert.deepEqual(renderer.domElement.style, { width: '932px', height: '430px' });
});

test('DPR-only quality changes perform one reset while preserving logical CSS size', () => {
  const renderer = fakeRenderer();
  resizeDrawingBuffer(renderer, 430, 390, 2);
  assert.equal(resizeDrawingBuffer(renderer, 430, 390, 1), true);
  assert.equal(resizeDrawingBuffer(renderer, 430, 390, 1), false);
  assert.equal(resizeDrawingBuffer(renderer, 430, 390, 1.5), true);
  assert.deepEqual(renderer.calls, [[430, 390, 2], [430, 390, 1], [430, 390, 1.5]]);
  assert.deepEqual(renderer.domElement.style, { width: '430px', height: '390px' });
});

test('a remounted renderer gets its own initial resize at the same viewport and DPR', () => {
  const retired = fakeRenderer(), replacement = fakeRenderer();
  assert.equal(resizeDrawingBuffer(retired, 430, 390, 2), true);
  assert.equal(resizeDrawingBuffer(replacement, 430, 390, 2), true);
  assert.equal(resizeDrawingBuffer(retired, 430, 390, 2), false);
  assert.equal(retired.calls.length, 1);
  assert.equal(replacement.calls.length, 1);
});

test('hidden or invalid viewports do not clear a valid buffer or poison its cached size', () => {
  const renderer = fakeRenderer();
  resizeDrawingBuffer(renderer, 430, 390, 2);
  for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(resizeDrawingBuffer(renderer, invalid, 390, 2), false);
    assert.equal(resizeDrawingBuffer(renderer, 430, invalid, 2), false);
    assert.equal(resizeDrawingBuffer(renderer, 430, 390, invalid), false);
  }
  assert.equal(resizeDrawingBuffer(renderer, 430, 390, 2), false);
  assert.deepEqual(renderer.calls, [[430, 390, 2]]);
  assert.deepEqual(renderer.domElement.style, { width: '430px', height: '390px' });
});

test('a failed resize propagates the error and does not suppress a later retry', () => {
  const renderer = fakeRenderer(), failure = new Error('drawing buffer unavailable');
  const allocate = renderer.setDrawingBufferSize;
  renderer.setDrawingBufferSize = () => { throw failure; };
  assert.throws(() => resizeDrawingBuffer(renderer, 430, 390, 2), error => error === failure);
  assert.deepEqual(renderer.domElement.style, { width: '', height: '' });
  renderer.setDrawingBufferSize = allocate;
  assert.equal(resizeDrawingBuffer(renderer, 430, 390, 2), true);
  assert.equal(resizeDrawingBuffer(renderer, 430, 390, 2), false);
  assert.deepEqual(renderer.calls, [[430, 390, 2]]);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { GpuSubmissionFence, type GpuFenceGL } from '../src/scene/GpuSubmissionFence';

function fixture(options: { collectErrors?: boolean } = {}) {
  let now = 0;
  let lost = false;
  let wait = 0x911b;
  let nextSync: WebGLSync | null = {} as WebGLSync;
  let queuedErrors: number[] = [];
  let errorReads = 0;
  let fences = 0;
  let flushes = 0;
  const deleted: WebGLSync[] = [];
  const waits: Array<{ sync: WebGLSync; flags: number; timeout: number }> = [];
  const gl: GpuFenceGL = {
    SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
    ALREADY_SIGNALED: 0x911a,
    TIMEOUT_EXPIRED: 0x911b,
    CONDITION_SATISFIED: 0x911c,
    WAIT_FAILED: 0x911d,
    NO_ERROR: 0,
    fenceSync(condition, flags) {
      assert.equal(condition, gl.SYNC_GPU_COMMANDS_COMPLETE);
      assert.equal(flags, 0);
      fences++;
      return nextSync;
    },
    flush() { flushes++; },
    clientWaitSync(sync, flags, timeout) { waits.push({ sync, flags, timeout }); return wait; },
    deleteSync(sync) { if (sync) deleted.push(sync); },
    isContextLost() { return lost; },
    getError() { errorReads++; return queuedErrors.shift() ?? gl.NO_ERROR; },
  };
  const fence = new GpuSubmissionFence<{ stage: string }>(gl, { now: () => now, ...options });
  return {
    gl, fence, deleted, waits,
    setNow(value: number) { now = value; },
    loseContext() { lost = true; },
    setWait(value: number) { wait = value; },
    failCreation() { nextSync = null; },
    setErrors(errors: number[]) { queuedErrors = errors; },
    counts: () => ({ fences, flushes, errorReads }),
  };
}

test('one GPU submission stays in flight and polling never blocks or consumes GL errors', () => {
  const f = fixture({ collectErrors: true });
  const metadata = { stage: 'materials' };
  assert.equal(f.fence.poll().status, 'idle');
  assert.equal(f.fence.submit(metadata).status, 'pending');
  assert.equal(f.fence.hasPending, true);
  f.setNow(400);
  const overlap = f.fence.submit({ stage: 'shadows' });
  assert.equal(overlap.reason, 'already-pending');
  const pending = f.fence.poll();
  assert.equal(pending.status, 'pending');
  assert.strictEqual(pending.metadata, metadata, 'a refused batch must not replace the original diagnostic metadata');
  assert.equal(pending.elapsedMs, 400);
  assert.deepEqual(f.counts(), { fences: 1, flushes: 1, errorReads: 0 });
  assert.deepEqual(f.waits.map(({ flags, timeout }) => ({ flags, timeout })), [{ flags: 0, timeout: 0 }]);
  assert.equal(f.deleted.length, 0);
});

test('both completion statuses release the fence once and allow the next stage', () => {
  for (const status of [0x911a, 0x911c]) {
    const f = fixture();
    f.fence.submit({ stage: 'materials' });
    f.setNow(34);
    f.setWait(status);
    const completed = f.fence.poll();
    assert.equal(completed.status, 'complete');
    assert.equal(completed.metadata?.stage, 'materials');
    assert.equal(completed.elapsedMs, 34);
    assert.equal(f.fence.hasPending, false);
    assert.equal(f.deleted.length, 1);
    assert.equal(f.fence.poll().status, 'idle', 'completion is a single event, not a repeated stage transition');
    assert.equal(f.fence.submit({ stage: 'shadows' }).status, 'pending');
    assert.equal(f.counts().errorReads, 0, 'ordinary frame fences do not consume the context error queue');
  }
});

test('optional error sampling happens only on completion and is bounded to eight reads', () => {
  const f = fixture({ collectErrors: true });
  f.setErrors(Array(12).fill(0x0502));
  f.fence.submit({ stage: 'shadowed-frame' });
  f.fence.poll();
  assert.equal(f.counts().errorReads, 0);
  f.setWait(f.gl.CONDITION_SATISFIED);
  const result = f.fence.poll();
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.errors, Array(8).fill(0x0502));
  assert.equal(f.counts().errorReads, 8);
});

test('context loss retires pending work without querying or deleting invalid sync objects', () => {
  const f = fixture();
  const metadata = { stage: 'shadow-draw' };
  f.fence.submit(metadata);
  f.setNow(120);
  f.loseContext();
  const result = f.fence.poll();
  assert.equal(result.reason, 'context-lost');
  assert.strictEqual(result.metadata, metadata);
  assert.equal(result.elapsedMs, 120);
  assert.equal(f.fence.hasPending, false);
  assert.equal(f.waits.length, 0);
  f.fence.dispose();
  assert.equal(f.deleted.length, 0);
  const lostBeforeSubmit = fixture();
  lostBeforeSubmit.loseContext();
  assert.equal(lostBeforeSubmit.fence.poll().reason, 'context-lost');
  assert.equal(lostBeforeSubmit.fence.submit(metadata).reason, 'context-lost');
  assert.equal(lostBeforeSubmit.counts().fences, 0);
  const lostDuringWait = fixture();
  lostDuringWait.fence.submit(metadata);
  lostDuringWait.gl.clientWaitSync = () => { lostDuringWait.loseContext(); return lostDuringWait.gl.WAIT_FAILED; };
  assert.equal(lostDuringWait.fence.poll().reason, 'context-lost', 'a driver loss during wait must not be mislabeled as an ordinary wait failure');
  assert.equal(lostDuringWait.deleted.length, 0);
});

test('WAIT_FAILED and unsuccessful fence creation report failure rather than GPU completion', () => {
  const f = fixture();
  f.fence.submit({ stage: 'shadow-draw' });
  f.setWait(f.gl.WAIT_FAILED);
  assert.equal(f.fence.poll().reason, 'wait-failed');
  assert.equal(f.fence.hasPending, false);
  assert.equal(f.deleted.length, 1);
  assert.equal(f.fence.poll().status, 'idle');
  const noSync = fixture();
  noSync.failCreation();
  assert.equal(noSync.fence.submit({ stage: 'materials' }).reason, 'fence-creation-failed');
  assert.equal(noSync.fence.hasPending, false);
  assert.equal(noSync.counts().flushes, 0);
});

test('a pending GPU batch times out at fifteen active seconds with its diagnostics intact', () => {
  const f = fixture();
  const metadata = { stage: 'shadowed-frame' };
  f.fence.submit(metadata);
  f.setNow(14_999);
  assert.equal(f.fence.poll().status, 'pending');
  f.setNow(15_000);
  const result = f.fence.poll();
  assert.equal(result.reason, 'timeout');
  assert.strictEqual(result.metadata, metadata);
  assert.equal(result.elapsedMs, 15_000);
  assert.equal(result.wallElapsedMs, 15_000);
  assert.equal(f.fence.hasPending, false);
  assert.equal(f.deleted.length, 1);
  assert.equal(f.fence.poll().status, 'idle');
});

test('explicit pause/resume excludes a hidden interval while retaining its wall time', () => {
  const f = fixture();
  f.fence.submit({ stage: 'materials' });
  f.setNow(1_000);
  f.fence.pause();
  f.setNow(61_000);
  f.fence.pause();
  assert.equal(f.fence.poll().elapsedMs, 1_000, 'repeated pause must not reset the original pause timestamp');
  f.fence.resume();
  f.fence.resume();
  f.setNow(74_999);
  assert.equal(f.fence.poll().status, 'pending');
  f.setNow(75_000);
  const result = f.fence.poll();
  assert.equal(result.reason, 'timeout');
  assert.equal(result.elapsedMs, 15_000);
  assert.equal(result.wallElapsedMs, 75_000);
});

test('dispose is idempotent, releases a live sync and prevents further submissions', () => {
  const f = fixture();
  f.fence.submit({ stage: 'normal-frame' });
  f.fence.dispose();
  f.fence.dispose();
  assert.equal(f.deleted.length, 1);
  assert.equal(f.fence.hasPending, false);
  assert.equal(f.fence.submit({ stage: 'late-frame' }).reason, 'disposed');
  assert.equal(f.fence.poll().reason, 'disposed');
  assert.deepEqual(f.counts(), { fences: 1, flushes: 1, errorReads: 0 });
});

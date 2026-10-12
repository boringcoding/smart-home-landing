import assert from 'node:assert/strict';
import test from 'node:test';
import { createDiagnosticRecorder, DIAGNOSTICS_STORAGE_KEY, sanitizeDiagnostic } from '../src/diagnostics';

const START = Date.UTC(2026, 9, 12, 12, 0, 0);
const options = { build: 'test-build', sessionId: 'test-session', now: () => START };

function memoryStorage(initial?: string) {
  const entries = new Map<string, string>();
  if (initial !== undefined) entries.set(DIAGNOSTICS_STORAGE_KEY, initial);
  const writes: Array<{ key: string; value: string }> = [];
  return {
    entries, writes,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem(key: string, value: string) { entries.set(key, value); writes.push({ key, value }); },
  };
}

test('the ring keeps the latest 90 phases without losing the last error or total error count', () => {
  let time = START;
  const recorder = createDiagnosticRecorder({ ...options, now: () => time });
  recorder.log('context.lost', { status: 'GPU reset' }, 'error');
  const beforeBurst = recorder.getSnapshot();
  for (let index = 1; index <= 105; index++) {
    time++;
    recorder.log(`phase.${index}`);
  }
  const snapshot = recorder.getSnapshot();
  assert.equal(snapshot.events.length, 90);
  assert.equal(snapshot.events[0].stage, 'phase.16');
  assert.equal(snapshot.events.at(-1)?.stage, 'phase.105');
  assert.equal(snapshot.lastStage, 'phase.105');
  assert.equal(snapshot.errorCount, 1);
  assert.equal(snapshot.lastError?.stage, 'context.lost');
  assert.equal(snapshot.lastError?.time, new Date(START).toISOString());
  assert.equal(beforeBurst.events.length, 1, 'published snapshots must not change under a subscriber');
  assert.equal(beforeBurst.lastStage, 'context.lost');
});

test('warning/error deduplication expires at three seconds and distinguishes level and detail', () => {
  let time = START;
  const recorder = createDiagnosticRecorder({ ...options, now: () => time });
  recorder.log('shader.compile', { code: 'failed' }, 'error');
  time += 2999;
  recorder.log('shader.compile', { code: 'failed' }, 'error');
  assert.equal(recorder.getSnapshot().events.length, 1);
  assert.equal(recorder.getSnapshot().errorCount, 1);
  time++;
  recorder.log('shader.compile', { code: 'failed' }, 'error');
  recorder.log('shader.compile', { code: 'different' }, 'error');
  recorder.log('shader.compile', { code: 'failed' }, 'warn');
  recorder.log('shader.compile', { code: 'failed' }, 'warn');
  recorder.log('frame.ready');
  recorder.log('frame.ready');
  assert.equal(recorder.getSnapshot().events.length, 6);
  assert.equal(recorder.getSnapshot().errorCount, 3);
  assert.equal(recorder.getSnapshot().lastError?.detail &&
    (recorder.getSnapshot().lastError?.detail as { code: string }).code, 'different');
});

test('persistence happens synchronously before the next GPU operation, even though UI notifications are coalesced', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = memoryStorage();
  const recorder = createDiagnosticRecorder({ ...options, storage });
  let notifications = 0;
  recorder.subscribe(() => { notifications++; });
  recorder.log('framebuffer.allocate.begin', { width: 1080, height: 2400 });
  recorder.log('framebuffer.allocate.end');
  assert.equal(storage.writes.length, 2);
  assert.equal(JSON.parse(storage.getItem(DIAGNOSTICS_STORAGE_KEY)!).lastStage, 'framebuffer.allocate.end');
  assert.equal(notifications, 0);
  t.mock.timers.tick(149);
  assert.equal(notifications, 0);
  t.mock.timers.tick(1);
  assert.equal(notifications, 1);
});

test('blocked storage reads and writes leave the in-memory report and subscribers usable', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let attemptedWrites = 0, notifications = 0;
  const recorder = createDiagnosticRecorder({ ...options, storage: {
    getItem() { throw new Error('SecurityError: storage denied'); },
    setItem() { attemptedWrites++; throw new Error('QuotaExceededError'); },
  } });
  recorder.subscribe(() => { notifications++; });
  assert.equal(recorder.getSnapshot().previousSession, null);
  assert.doesNotThrow(() => {
    recorder.log('context.lost', { reason: 'driver reset' }, 'error');
    recorder.setGraphics({ depthBits: 24 });
    recorder.setMetrics({ frames: 10 });
  });
  t.mock.timers.tick(150);
  assert.equal(attemptedWrites, 3);
  assert.equal(notifications, 1);
  assert.equal(recorder.getSnapshot().lastError?.stage, 'context.lost');
  assert.match(recorder.getReport(), /driver reset/);
});

test('reload recovers the previous session tail and does not persist a recursive session history', () => {
  const storage = memoryStorage();
  const first = createDiagnosticRecorder({ ...options, sessionId: 'first', storage });
  for (let index = 1; index <= 90; index++) first.log(`first.${index}`);
  const second = createDiagnosticRecorder({ ...options, sessionId: 'second', storage });
  const previous = second.getSnapshot().previousSession as { sessionId: string; events: Array<{ stage: string }>; previousSession?: unknown };
  assert.equal(previous.sessionId, 'first');
  assert.equal(previous.events.length, 60);
  assert.equal(previous.events[0].stage, 'first.31');
  assert.equal(previous.events.at(-1)?.stage, 'first.90');
  assert.equal('previousSession' in previous, false);
  assert.equal(second.getSnapshot().events.length, 0);
  second.log('second.ready');
  const persisted = JSON.parse(storage.getItem(DIAGNOSTICS_STORAGE_KEY)!);
  assert.equal(persisted.sessionId, 'second');
  assert.equal(persisted.previousSession, null);
  assert.deepEqual(persisted.events.map((event: { stage: string }) => event.stage), ['second.ready']);
  assert.ok(storage.writes.every(write => write.key === DIAGNOSTICS_STORAGE_KEY));
  const third = createDiagnosticRecorder({ ...options, sessionId: 'third', storage });
  assert.equal((third.getSnapshot().previousSession as { sessionId: string }).sessionId, 'second');
  assert.equal(JSON.stringify(third.getSnapshot().previousSession).includes('first.90'), false);
});

test('untrusted saved reports are sanitized again and malformed, invalid or oversized reports are ignored', () => {
  const previous = {
    sessionId: 'old', token: 'old-secret', previousSession: { events: [{ detail: 'older-secret' }] },
    events: [{ stage: 'model.fetch', detail: { email: 'private@example.com', url: 'https://example.com/model.glb?key=old-secret#private' } }],
  };
  const recorder = createDiagnosticRecorder({ ...options, storage: memoryStorage(JSON.stringify(previous)) });
  const restored = JSON.stringify(recorder.getSnapshot().previousSession);
  assert.match(restored, /https:\/\/example.com\/model.glb/);
  for (const secret of ['old-secret', 'private@example.com', 'older-secret', '#private']) assert.equal(restored.includes(secret), false);
  for (const invalid of ['{broken', 'null', '[]', '{"events":{}}', JSON.stringify({ events: [], padding: 'x'.repeat(100_000) })]) {
    const result = createDiagnosticRecorder({ ...options, storage: memoryStorage(invalid) });
    assert.equal(result.getSnapshot().previousSession, null);
  }
});

test('large event details are trimmed for storage without discarding the in-memory ring', () => {
  const storage = memoryStorage();
  const recorder = createDiagnosticRecorder({ ...options, storage });
  for (let index = 0; index < 100; index++) recorder.log(`shader.${index}`, { message: 'x'.repeat(4000) });
  const serialized = storage.getItem(DIAGNOSTICS_STORAGE_KEY)!;
  const saved = JSON.parse(serialized);
  assert.ok(serialized.length <= 65_000);
  assert.ok(saved.events.length > 0 && saved.events.length < 90);
  assert.equal(saved.events.at(-1).stage, 'shader.99');
  assert.equal(recorder.getSnapshot().events.length, 90);
  assert.equal((recorder.getSnapshot().events[0].detail as { message: string }).message.length, 2600);
});

test('sanitization removes credentials, URL queries/fragments and sensitive nested fields while keeping useful GPU data', () => {
  const input = {
    renderer: 'Adreno', depthBits: 24, contextLost: true,
    url: 'https://alice:password@example.com/models/house.glb?token=secret#private',
    detail: {
      accessToken: 'access-secret', Authorization: 'Bearer private', cookie: 'session-secret',
      password: 'password-secret', contact: { name: 'private-person' }, email: 'private@example.com',
      phone: '+1-555-private', homeState: { address: 'private-address' }, formValue: 'private-form',
      extensions: ['EXT_color_buffer_float'],
    },
  };
  const safe = sanitizeDiagnostic(input) as typeof input;
  assert.equal(safe.url, 'https://example.com/models/house.glb');
  assert.equal(safe.renderer, 'Adreno');
  assert.equal(safe.depthBits, 24);
  assert.equal(safe.contextLost, true);
  assert.deepEqual(safe.detail.extensions, ['EXT_color_buffer_float']);
  for (const [key, value] of Object.entries(safe.detail)) if (key !== 'extensions') assert.equal(value, '[redacted]');
  assert.equal(input.detail.accessToken, 'access-secret', 'sanitizing must not mutate caller state');
});

test('sanitization bounds strings, arrays, object entries and cyclic structures', () => {
  assert.equal((sanitizeDiagnostic('x'.repeat(10_000)) as string).length, 2600);
  assert.deepEqual(sanitizeDiagnostic(Array.from({ length: 100 }, (_, index) => index)), Array.from({ length: 35 }, (_, index) => index));
  const manyKeys = Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`field${index}`, index]));
  assert.equal(Object.keys(sanitizeDiagnostic(manyKeys) as object).length, 50);
  const cyclic: Record<string, unknown> = { label: 'root' };
  cyclic.self = cyclic;
  const serialized = JSON.stringify(sanitizeDiagnostic(cyclic));
  assert.match(serialized, /\[truncated\]/);
  assert.ok(serialized.length < 1000);
});

test('Error diagnostics retain the failure and stack while stripping URL secrets', () => {
  const error = new Error('Fetch failed https://example.com/house.glb?credential=secret#private');
  error.stack = `Error: ${error.message}\n    at https://example.com/assets/Scene.js?debug=secret:12:4`;
  const safe = sanitizeDiagnostic(error) as { name: string; message: string; stack: string };
  assert.equal(safe.name, 'Error');
  assert.match(safe.message, /^Fetch failed https:\/\/example.com\/house.glb$/);
  assert.match(safe.stack, /Scene\.js/);
  assert.equal(JSON.stringify(safe).includes('secret'), false);
  assert.equal(JSON.stringify(safe).includes('#private'), false);
});

test('graphics merge capabilities, metrics replace samples, and both redact before publishing', () => {
  const recorder = createDiagnosticRecorder({ ...options, environment: { renderer: 'test', sessionToken: 'environment-secret' } });
  recorder.setGraphics({ webglVersion: 2, depthBits: 16 });
  recorder.setGraphics({ depthBits: 24, accessToken: 'graphics-secret' });
  recorder.setMetrics({ frames: 1, obsolete: true });
  recorder.setMetrics({ frames: 2, formValue: 'metrics-secret' });
  assert.deepEqual(recorder.getSnapshot().graphics, { webglVersion: 2, depthBits: 24, accessToken: '[redacted]' });
  assert.deepEqual(recorder.getSnapshot().metrics, { frames: 2, formValue: '[redacted]' });
  assert.deepEqual(recorder.getSnapshot().environment, { renderer: 'test', sessionToken: '[redacted]' });
  assert.equal(recorder.getSnapshot().events.length, 0);
});

test('a failing subscriber cannot prevent other subscribers and unsubscribe also cancels pending delivery', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const recorder = createDiagnosticRecorder(options);
  let healthyCalls = 0, removedCalls = 0;
  recorder.subscribe(() => { throw new Error('panel unavailable'); });
  const stopHealthy = recorder.subscribe(() => { healthyCalls++; });
  const stopRemoved = recorder.subscribe(() => { removedCalls++; });
  recorder.log('model.fetch.begin');
  stopRemoved();
  assert.doesNotThrow(() => t.mock.timers.tick(150));
  assert.equal(healthyCalls, 1);
  assert.equal(removedCalls, 0);
  stopHealthy();
  recorder.log('model.fetch.end');
  assert.doesNotThrow(() => t.mock.timers.tick(150));
  assert.equal(healthyCalls, 1);
});

test('exported reports are self-contained JSON with build, last failure and sanitized bounded stage names', () => {
  const recorder = createDiagnosticRecorder(options);
  recorder.log('x'.repeat(500), { token: 'report-secret' }, 'error');
  recorder.log('render.recovered');
  const text = recorder.getReport();
  assert.ok(text.startsWith('SMART HOUSE · 3D DIAGNOSTICS\n'));
  const report = JSON.parse(text.slice(text.indexOf('\n') + 1));
  assert.equal(report.reportVersion, 1);
  assert.equal(report.build, 'test-build');
  assert.equal(report.sessionId, 'test-session');
  assert.equal(report.startedAt, new Date(START).toISOString());
  assert.equal(report.lastStage, 'render.recovered');
  assert.equal(report.lastError.stage.length, 160);
  assert.equal(report.lastError.level, 'error');
  assert.equal(report.errorCount, 1);
  assert.equal(text.includes('report-secret'), false);
});

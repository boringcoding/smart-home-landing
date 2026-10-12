import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyWebGLCreationFailure } from '../src/scene/webglFailure';

const BLOCKED = 'Web page caused context loss and was blocked';
const GENERIC = new Error('THREE.WebGLRenderer: Error creating WebGL context.');

test('the explicit Chromium page block takes precedence over the generic renderer exception', () => {
  const result = classifyWebGLCreationFailure([BLOCKED], GENERIC);
  assert.equal(result.kind, 'blocked');
  assert.deepEqual(result.nativeMessages, [BLOCKED]);
  assert.match(result.message, /заблокировал/);
});

test('the native block remains visible when a fallback creation attempt reports a different failure', () => {
  const nativeMessages = [BLOCKED, 'Failed to create a WebGL2 context'];
  const result = classifyWebGLCreationFailure(nativeMessages, GENERIC);
  assert.equal(result.kind, 'blocked');
  assert.deepEqual(result.nativeMessages, nativeMessages);
});

test('recognizes the explicit phrase with console prefixes, case differences and whitespace', () => {
  const result = classifyWebGLCreationFailure([
    'WebGLRenderer: WEB PAGE caused\ncontext loss and was\tblocked.',
  ], GENERIC);
  assert.equal(result.kind, 'blocked');
});

test('a forwarded explicit browser refusal is recognized in Error and string exceptions', () => {
  for (const error of [new Error(BLOCKED), `WebGL startup: ${BLOCKED}.`]) {
    const result = classifyWebGLCreationFailure([], error);
    assert.equal(result.kind, 'blocked');
    assert.deepEqual(result.nativeMessages, [], 'an exception must not be mislabeled as a captured native event');
  }
});

test('disabled, unsupported, attribute and driver errors do not imply a browser page block', () => {
  for (const detail of [
    'WebGL disabled',
    'WebGL2 is not supported',
    'THREE.WebGLRenderer: Error creating WebGL context with your selected attributes.',
    'GPU process exited unexpectedly',
    'Out of memory',
    'Resource was blocked by content security policy',
  ]) {
    const result = classifyWebGLCreationFailure([detail], GENERIC);
    assert.equal(result.kind, 'unavailable', detail);
    assert.equal(result.message, classifyWebGLCreationFailure([], GENERIC).message);
    assert.deepEqual(result.nativeMessages, [detail]);
  }
});

test('ordinary context loss and a negated block phrase remain unavailable rather than classified as blocked', () => {
  for (const detail of ['WebGLRenderer: Context Lost.', 'Web page caused context loss and was not blocked']) {
    assert.equal(classifyWebGLCreationFailure([detail], GENERIC).kind, 'unavailable');
  }
});

test('normalization removes empty duplicate messages without mutating the caller array', () => {
  const input = Object.freeze(['', '  ', ` ${BLOCKED} `, BLOCKED, 'Second attempt failed']);
  const result = classifyWebGLCreationFailure(input, GENERIC);
  assert.deepEqual(result.nativeMessages, [BLOCKED, 'Second attempt failed']);
  assert.deepEqual(input, ['', '  ', ` ${BLOCKED} `, BLOCKED, 'Second attempt failed']);
  result.nativeMessages.push('caller annotation');
  assert.equal(input.length, 5);
});

test('missing native evidence yields an honest generic failure without guessing its cause', () => {
  const result = classifyWebGLCreationFailure([], GENERIC);
  assert.equal(result.kind, 'unavailable');
  assert.deepEqual(result.nativeMessages, []);
  assert.match(result.message, /WebGL/);
  assert.doesNotMatch(result.message, /драйвер|памят|видеокарт|поддержива/i);
});

test('unusual thrown values are safe and are not stringified during failure handling', () => {
  const hostile = { toString(): never { throw new Error('must not stringify'); } };
  const cyclic: { self?: unknown } = {}; cyclic.self = cyclic;
  for (const error of [undefined, null, 42, false, Symbol('failure'), hostile, cyclic]) {
    assert.equal(classifyWebGLCreationFailure([], error).kind, 'unavailable');
  }
});

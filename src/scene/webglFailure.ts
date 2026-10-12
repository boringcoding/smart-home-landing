export interface WebGLCreationFailure {
  kind: 'blocked' | 'unavailable';
  message: string;
  nativeMessages: string[];
}

// This is an explicit Chromium refusal after context loss, not a diagnosis of
// what caused the original loss. Generic "disabled"/"unsupported" errors do
// not establish that the browser has blocked this page.
const PAGE_BLOCKED = /\bweb\s+page\s+caused\s+context\s+loss\s+and\s+was\s+blocked\b/i;

export function classifyWebGLCreationFailure(
  nativeMessages: readonly string[],
  error: unknown,
): WebGLCreationFailure {
  const messages = [...new Set(nativeMessages.map(message => message.trim()).filter(Boolean))];
  // Avoid stringifying arbitrary thrown objects: their getters/toString may
  // themselves throw while the application is trying to report a GPU failure.
  const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
  const blocked = messages.some(message => PAGE_BLOCKED.test(message)) || PAGE_BLOCKED.test(errorMessage);
  return {
    kind: blocked ? 'blocked' : 'unavailable',
    message: blocked
      ? 'Браузер заблокировал создание 3D-контекста после его потери.'
      : 'Браузер не смог создать графический контекст WebGL.',
    nativeMessages: messages,
  };
}

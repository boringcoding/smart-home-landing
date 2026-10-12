export type DiagnosticLevel = 'info' | 'warn' | 'error';
export interface DiagnosticEvent { time: string; level: DiagnosticLevel; stage: string; detail?: unknown }
export interface DiagnosticSnapshot {
  build: string; sessionId: string; startedAt: string; lastStage: string; errorCount: number;
  environment: Record<string, unknown>; graphics: Record<string, unknown>;
  metrics: Record<string, unknown> | null; events: DiagnosticEvent[]; previousSession: unknown | null;
  lastError: DiagnosticEvent | null;
}
interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface RecorderOptions { build: string; environment?: Record<string, unknown>; storage?: StorageLike; now?: () => number; sessionId?: string }
export const DIAGNOSTICS_STORAGE_KEY = 'smart-house.diagnostics.v1';
const EVENT_LIMIT = 90;

// Only diagnostics are recorded: no HomeState, contacts, forms or storage dumps.
export function sanitizeDiagnostic(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.replace(/https?:\/\/[^\s)"'<>]+/g, raw => {
    try { const url = new URL(raw); return `${url.origin}${url.pathname}`; } catch { return '[url]'; }
  }).slice(0, 2600);
  if (depth > 5) return '[truncated]';
  if (value instanceof Error) return sanitizeDiagnostic({ name: value.name, message: value.message, stack: value.stack }, depth + 1);
  if (Array.isArray(value)) return value.slice(0, 35).map(item => sanitizeDiagnostic(item, depth + 1));
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, 50)) {
      output[key] = /password|token|authorization|cookie|contact|email|phone|homeState|formValue/i.test(key)
        ? '[redacted]' : sanitizeDiagnostic(item, depth + 1);
    }
    return output;
  }
  return String(value).slice(0, 200);
}

export function createDiagnosticRecorder(options: RecorderOptions) {
  const now = options.now ?? Date.now;
  let previousSession: unknown = null;
  try {
    const stored = options.storage?.getItem(DIAGNOSTICS_STORAGE_KEY);
    if (stored && stored.length < 100_000) {
      const previous = JSON.parse(stored);
      if (previous && typeof previous === 'object' && Array.isArray(previous.events)) {
        delete previous.previousSession;
        previousSession = { ...sanitizeDiagnostic(previous) as Record<string, unknown>, events: previous.events.slice(-60).map((event: unknown) => sanitizeDiagnostic(event)) };
      }
    }
  } catch { /* Private browsing and exhausted storage must not break diagnostics. */ }
  let snapshot: DiagnosticSnapshot = {
    build: options.build, sessionId: options.sessionId ?? `${now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: new Date(now()).toISOString(), lastStage: 'diagnostics.start', errorCount: 0,
    environment: (sanitizeDiagnostic(options.environment ?? {}) ?? {}) as Record<string, unknown>,
    graphics: {}, metrics: null, events: [], previousSession, lastError: null,
  };
  const listeners = new Set<() => void>();
  const duplicates = new Map<string, number>();
  let notifyTimer: ReturnType<typeof setTimeout> | undefined;
  function publish() {
    try {
      // Persist only this session, never a recursively growing chain of reports.
      const saved = { ...snapshot, previousSession: null };
      let serialized = JSON.stringify(saved);
      while (serialized.length > 65_000 && saved.events.length > 1) {
        saved.events = saved.events.slice(1);
        serialized = JSON.stringify(saved);
      }
      options.storage?.setItem(DIAGNOSTICS_STORAGE_KEY, serialized);
    } catch { /* The in-memory report remains usable. */ }
    // Preserve the phase synchronously before a GPU call, but coalesce React UI
    // notifications so a burst of loader/shader events doesn't rerender the panel.
    if (listeners.size && !notifyTimer) notifyTimer = setTimeout(() => {
      notifyTimer = undefined;
      for (const listener of listeners) { try { listener(); } catch { /* Isolate UI listeners. */ } }
    }, 150);
  }
  function log(stage: string, detail?: unknown, level: DiagnosticLevel = 'info') {
    const safeDetail = sanitizeDiagnostic(detail);
    const fingerprint = `${level}:${stage}:${JSON.stringify(safeDetail)}`;
    const timestamp = now();
    if (level !== 'info' && duplicates.has(fingerprint) && timestamp - duplicates.get(fingerprint)! < 3000) return;
    if (duplicates.size > 100) duplicates.clear();
    if (level !== 'info') duplicates.set(fingerprint, timestamp);
    const event = { time: new Date(timestamp).toISOString(), level, stage: stage.slice(0, 160), detail: safeDetail };
    snapshot = { ...snapshot, lastStage: event.stage, errorCount: snapshot.errorCount + (level === 'error' ? 1 : 0),
      lastError: level === 'error' ? event : snapshot.lastError, events: [...snapshot.events, event].slice(-EVENT_LIMIT) };
    publish();
  }
  function update(field: 'graphics' | 'metrics', values: Record<string, unknown>) {
    const safe = sanitizeDiagnostic(values) as Record<string, unknown>;
    snapshot = { ...snapshot, [field]: field === 'graphics' ? { ...snapshot.graphics, ...safe } : safe };
    publish();
  }
  return {
    log,
    getSnapshot: () => snapshot,
    getReport: () => `SMART HOUSE · 3D DIAGNOSTICS\n${JSON.stringify({ reportVersion: 1, ...snapshot }, null, 2)}`,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setGraphics: (values: Record<string, unknown>) => update('graphics', values),
    setMetrics: (values: Record<string, unknown>) => update('metrics', values),
  };
}

interface BootstrapDiagnostics {
  events: DiagnosticEvent[]; previous: unknown;
  receive?: (stage: string, detail?: unknown, level?: DiagnosticLevel) => void;
  report?: () => string;
  appReady(): void; showFallback(): void;
}
declare global { interface Window { __smartHouseDiagnostics?: BootstrapDiagnostics } }
function browserEnvironment(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  const device = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string; saveData?: boolean } };
  return {
    userAgent: navigator.userAgent, platform: navigator.platform, language: navigator.language,
    page: `${location.origin}${location.pathname}`, viewport: { width: innerWidth, height: innerHeight },
    screen: { width: screen.width, height: screen.height, colorDepth: screen.colorDepth },
    dpr: devicePixelRatio, touchPoints: navigator.maxTouchPoints, coarsePointer: matchMedia('(pointer: coarse)').matches,
    hardwareConcurrency: navigator.hardwareConcurrency, deviceMemoryGB: device.deviceMemory,
    connection: { effectiveType: device.connection?.effectiveType, saveData: device.connection?.saveData },
    online: navigator.onLine, visibility: document.visibilityState, secureContext: isSecureContext,
  };
}
function sessionStorageIfAvailable(): StorageLike | undefined { try { return typeof window !== 'undefined' ? window.sessionStorage : undefined; } catch { return undefined; } }
const recorder = createDiagnosticRecorder({
  build: import.meta.env?.VITE_BUILD_ID ?? 'local-development', environment: browserEnvironment(), storage: sessionStorageIfAvailable(),
});
export const logDiagnostic = recorder.log;
export const getDiagnosticsSnapshot = recorder.getSnapshot;
export const getDiagnosticReport = recorder.getReport;
export const subscribeDiagnostics = recorder.subscribe;
export const setGraphicsDiagnostics = recorder.setGraphics;
export const setMetricsDiagnostics = recorder.setMetrics;

export function initializeDiagnostics() {
  const boot = window.__smartHouseDiagnostics;
  if (boot) {
    for (const event of boot.events) logDiagnostic(event.stage, { capturedAt: event.time, detail: event.detail }, event.level);
    boot.receive = logDiagnostic;
    boot.report = getDiagnosticReport;
    if (boot.previous) logDiagnostic('bootstrap.previous-session', boot.previous);
  }
  logDiagnostic('application.entry');
  const recordVisibility = () => logDiagnostic('page.visibility', { state: document.visibilityState });
  document.addEventListener('visibilitychange', recordVisibility);
  window.addEventListener('pagehide', event => logDiagnostic('page.hide', { persisted: event.persisted }));
  window.addEventListener('pageshow', event => logDiagnostic('page.show', { persisted: event.persisted }));
  window.addEventListener('vite:preloadError', event => logDiagnostic('application.chunk-load-error', (event as Event & { payload?: unknown }).payload, 'error'));
  // Three logs shader/context failures through console as well as DOM events.
  for (const level of ['warn', 'error'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      logDiagnostic(`console.${level}`, args, level);
    };
  }
}

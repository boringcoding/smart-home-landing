export type GpuFenceGL = Pick<WebGL2RenderingContext,
  'fenceSync' | 'flush' | 'clientWaitSync' | 'deleteSync' | 'isContextLost' | 'getError' |
  'SYNC_GPU_COMMANDS_COMPLETE' | 'ALREADY_SIGNALED' | 'CONDITION_SATISFIED' |
  'TIMEOUT_EXPIRED' | 'WAIT_FAILED' | 'NO_ERROR'
>;

export type GpuFenceError = 'already-pending' | 'context-lost' | 'wait-failed' | 'timeout' |
  'fence-creation-failed' | 'disposed' | 'webgl-exception';

export interface GpuFenceResult<T> {
  status: 'idle' | 'pending' | 'complete' | 'error';
  metadata?: T;
  /** Waiting time excluding explicit pause()/resume() intervals. */
  elapsedMs?: number;
  /** Full wall time, including pauses, retained for diagnostics. */
  wallElapsedMs?: number;
  reason?: GpuFenceError;
  message?: string;
  /** Optional GL error sampling, performed only after GPU completion, at most eight reads. */
  errors?: number[];
}

export interface GpuFenceOptions {
  now?: () => number;
  timeoutMs?: number;
  collectErrors?: boolean;
}

interface Submission<T> {
  sync: WebGLSync;
  metadata: T;
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number;
}

/** Place after submitted GL commands; check hasPending before issuing another batch.
 * poll() never waits on the CPU: it uses clientWaitSync(sync, 0, 0).
 * Each completed or failed batch is retired; its metadata is returned only once.
 */
export class GpuSubmissionFence<T extends Record<string, unknown> = Record<string, unknown>> {
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly collectErrors: boolean;
  private submission: Submission<T> | null = null;
  private paused = false;
  private disposed = false;

  constructor(private readonly gl: GpuFenceGL, options: GpuFenceOptions = {}) {
    this.now = options.now ?? (() => performance.now());
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.collectErrors = options.collectErrors ?? false;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) throw new RangeError('GPU fence timeout must be positive and finite.');
  }

  get hasPending(): boolean { return this.submission !== null; }

  submit(metadata: T): GpuFenceResult<T> {
    if (this.disposed) return { status: 'error', reason: 'disposed', metadata, elapsedMs: 0, wallElapsedMs: 0 };
    // Preserve the original fence and its metadata if a caller tries to overlap batches.
    if (this.submission) return { status: 'error', reason: 'already-pending', ...this.details(this.submission) };
    try {
      if (this.gl.isContextLost()) return { status: 'error', reason: 'context-lost', metadata, elapsedMs: 0, wallElapsedMs: 0 };
      const sync = this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) return { status: 'error', reason: this.gl.isContextLost() ? 'context-lost' : 'fence-creation-failed', metadata, elapsedMs: 0, wallElapsedMs: 0 };
      const startedAt = this.now();
      this.submission = { sync, metadata, startedAt, pausedAt: this.paused ? startedAt : null, pausedMs: 0 };
      this.gl.flush();
      if (this.gl.isContextLost()) return this.fail('context-lost');
      return { status: 'pending', ...this.details(this.submission) };
    } catch (error) {
      if (this.submission) return this.fail('webgl-exception', String(error));
      return { status: 'error', reason: 'webgl-exception', metadata, elapsedMs: 0, wallElapsedMs: 0, message: String(error) };
    }
  }

  poll(): GpuFenceResult<T> {
    if (this.disposed) return { status: 'error', reason: 'disposed' };
    try {
      if (this.gl.isContextLost()) return this.fail('context-lost');
      const submission = this.submission;
      if (!submission) return { status: 'idle' };
      const wait = this.gl.clientWaitSync(submission.sync, 0, 0);
      if (this.gl.isContextLost()) return this.fail('context-lost');
      if (wait === this.gl.ALREADY_SIGNALED || wait === this.gl.CONDITION_SATISFIED) {
        const errors: number[] = [];
        if (this.collectErrors) {
          for (let reads = 0; reads < 8; reads++) {
            const error = this.gl.getError();
            if (error === this.gl.NO_ERROR) break;
            errors.push(error);
          }
          if (this.gl.isContextLost()) return this.fail('context-lost');
        }
        const result: GpuFenceResult<T> = { status: 'complete', ...this.details(submission), ...(this.collectErrors ? { errors } : {}) };
        this.release();
        return result;
      }
      if (wait === this.gl.WAIT_FAILED) return this.fail('wait-failed');
      if (wait !== this.gl.TIMEOUT_EXPIRED) return this.fail('wait-failed', `Unexpected wait status: ${wait}`);
      const details = this.details(submission);
      if (details.elapsedMs >= this.timeoutMs) return this.fail('timeout');
      return { status: 'pending', ...details };
    } catch (error) {
      return this.fail('webgl-exception', String(error));
    }
  }

  /** Call on visibility loss; GPU work may finish, but background time must not cause a timeout. */
  pause(): void {
    if (this.disposed || this.paused) return;
    this.paused = true;
    if (this.submission) this.submission.pausedAt = this.now();
  }

  resume(): void {
    if (this.disposed || !this.paused) return;
    this.paused = false;
    if (this.submission?.pausedAt != null) {
      this.submission.pausedMs += Math.max(0, this.now() - this.submission.pausedAt);
      this.submission.pausedAt = null;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
  }

  private details(submission: Submission<T>) {
    const now = this.now();
    const wallElapsedMs = Math.max(0, now - submission.startedAt);
    const pausedMs = submission.pausedMs + (submission.pausedAt === null ? 0 : Math.max(0, now - submission.pausedAt));
    return { metadata: submission.metadata, elapsedMs: Math.max(0, wallElapsedMs - pausedMs), wallElapsedMs };
  }

  private fail(reason: GpuFenceError, message?: string): GpuFenceResult<T> {
    const result: GpuFenceResult<T> = { status: 'error', reason, ...(this.submission ? this.details(this.submission) : {}), ...(message ? { message } : {}) };
    this.release();
    return result;
  }

  private release(): void {
    const submission = this.submission;
    this.submission = null;
    if (!submission) return;
    // A lost context already owns the invalidated sync; deletion must not mask the original failure.
    try { if (!this.gl.isContextLost()) this.gl.deleteSync(submission.sync); } catch { /* Context teardown is best-effort. */ }
  }
}

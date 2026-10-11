/** One decoder at a time. Superseded fetches abort; decoded stale assets are released. */
export class LatestAssetLoader<T> {
  private desired: string | null = null;
  private revision = 0;
  private disposed = false;
  private running = false;
  private controller: AbortController | null = null;

  constructor(private readonly handlers: {
    load: (key: string, signal: AbortSignal) => Promise<T>;
    start: (key: string) => void;
    commit: (value: T, key: string) => void;
    release: (value: T) => void;
    error: (error: unknown, key: string) => void;
  }) {}

  request(key: string) {
    if (this.disposed || key === this.desired) return;
    this.desired = key;
    this.revision++;
    this.controller?.abort();
    void this.drain();
  }

  dispose() {
    this.disposed = true;
    this.desired = null;
    this.revision++;
    this.controller?.abort();
  }

  private async drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (!this.disposed && this.desired !== null) {
        const key = this.desired, revision = this.revision;
        const controller = new AbortController();
        this.controller = controller;
        try {
          this.handlers.start(key);
          const value = await this.handlers.load(key, controller.signal);
          if (this.disposed || revision !== this.revision) this.handlers.release(value);
          else {
            // Ownership transfers only after commit succeeds. A failed scene
            // setup must not strand the decoded geometry/textures in memory.
            try { this.handlers.commit(value, key); }
            catch (error) { this.handlers.release(value); throw error; }
          }
        } catch (error) {
          if (!this.disposed && revision === this.revision) this.handlers.error(error, key);
        }
        if (revision === this.revision) break;
      }
    } finally {
      this.controller = null;
      this.running = false;
    }
  }
}

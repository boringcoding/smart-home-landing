/** Share one instance across scene mounts to prevent overlapping unabortable decodes. */
export class SerialDecoder {
  private tail:Promise<void> = Promise.resolve();

  run<T>(task:()=>Promise<T>,signal:AbortSignal):Promise<T> {
    const result=this.tail.then(()=>{
      // A queued request may have become obsolete while another decoder ran.
      signal.throwIfAborted();
      // Once decoding starts, ownership of its result must reach the caller.
      // LatestAssetLoader releases stale values; this queue knows no release API.
      return task();
    });
    // Neither a failed decoder nor an aborted queued request can poison the tail.
    this.tail=result.then(()=>undefined,()=>undefined);
    return result;
  }
}

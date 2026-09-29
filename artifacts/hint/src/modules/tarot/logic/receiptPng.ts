/** Encode full-resolution pixels without blocking receipt controls in WebKit. */
export function createReceiptPng(canvas: HTMLCanvasElement, signal?: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let worker: Worker | undefined;
    let settled = false;
    const finish = (error?: unknown, blob?: Blob) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      if (worker) {
        worker.onmessage = worker.onerror = worker.onmessageerror = null;
        worker.terminate();
      }
      if (error) reject(error);
      else if (blob?.size && blob.type === "image/png") resolve(blob);
      else reject(new Error("Receipt export failed"));
    };
    const cancel = () => finish(new DOMException("Receipt cancelled", "AbortError"));
    const timer = setTimeout(() => finish(new Error("Receipt export timed out")), 5_000);
    if (signal?.aborted) { cancel(); return; }
    signal?.addEventListener("abort", cancel, { once: true });

    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined"
      || typeof OffscreenCanvas.prototype.convertToBlob !== "function" || typeof createImageBitmap !== "function") {
      // Older browsers retain a cancellable export; supported iOS uses the worker.
      try { canvas.toBlob(blob => finish(undefined, blob ?? undefined), "image/png"); }
      catch (error) { finish(error); }
      return;
    }

    try {
      worker = new Worker(new URL("./receiptPng.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = ({ data }: MessageEvent<{ blob?: Blob; error?: string }>) => {
        finish(data.error ? new Error("Receipt export failed") : undefined, data.blob);
      };
      worker.onerror = event => { event.preventDefault(); finish(new Error("Receipt export failed")); };
      worker.onmessageerror = () => finish(new Error("Receipt export failed"));
      void createImageBitmap(canvas).then(bitmap => {
        if (settled) { bitmap.close(); return; }
        try { worker!.postMessage({ bitmap }, [bitmap]); }
        catch (error) { bitmap.close(); finish(error); }
      }, error => finish(error));
    } catch (error) { finish(error); }
  });
}

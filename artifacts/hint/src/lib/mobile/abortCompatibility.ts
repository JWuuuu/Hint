/** iOS 15 WebViews have AbortController but may lack newer AbortSignal helpers. */
export function configureAbortCompatibility() {
  if (typeof AbortSignal.timeout !== "function") {
    Object.defineProperty(AbortSignal, "timeout", { configurable: true, value(milliseconds: number) {
      if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new RangeError("Invalid timeout");
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), milliseconds);
      return controller.signal;
    } });
  }
  if (typeof AbortSignal.prototype.throwIfAborted !== "function") {
    Object.defineProperty(AbortSignal.prototype, "throwIfAborted", { configurable: true, value(this: AbortSignal) {
      if (this.aborted) throw this.reason ?? new DOMException("Request cancelled", "AbortError");
    } });
  }
}

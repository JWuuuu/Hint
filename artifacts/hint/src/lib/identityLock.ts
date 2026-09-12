import { isNativeShell } from "./mobile/runtime";

const LOCK_NAME = "hint.identity-and-enrollment.v1";
let nativeQueue = Promise.resolve();

/** Profile snapshots and first enrollment share one origin-wide critical section. */
export async function withIdentityLock<T>(work: () => Promise<T> | T): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return await navigator.locks.request(LOCK_NAME, { mode: "exclusive" }, work);
  }
  // The native shell owns one WebView. Its Keychain operations still need to
  // serialize within that context when Web Locks are unavailable.
  if (isNativeShell()) {
    const result = nativeQueue.then(work);
    nativeQueue = result.then(() => undefined, () => undefined);
    return result;
  }
  // A per-tab mutex is not a safe browser fallback: another tab could enroll
  // a different remote owner and overwrite the only durable credential.
  return Promise.reject(new Error("Device coordination is unavailable"));
}

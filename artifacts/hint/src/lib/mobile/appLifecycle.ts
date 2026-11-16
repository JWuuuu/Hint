import { isNativeShell } from "./runtime";

export type NativeAppStateListener = (isActive: boolean) => void;

export async function addNativeAppStateListener(
  listener: NativeAppStateListener,
  { emitCurrentState = false }: { emitCurrentState?: boolean } = {},
): Promise<() => Promise<void>> {
  if (!isNativeShell()) return async () => undefined;

  const { App } = await import("@capacitor/app");
  let stateChanged = false;
  let removed = false;
  const handle = await App.addListener("appStateChange", ({ isActive }) => {
    stateChanged = true;
    if (removed) return;
    listener(isActive);
  });
  if (emitCurrentState) {
    let expired = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        App.getState().then(state => {
          // A newer event or expired query wins over an old snapshot.
          if (!expired && !removed && !stateChanged) listener(state.isActive);
        }),
        new Promise<void>(resolve => { timeout = setTimeout(resolve, 75); }),
      ]);
    } catch { /* Visibility events remain available if the state query fails. */ }
    finally { expired = true; clearTimeout(timeout); }
  }

  return async () => {
    removed = true;
    await handle.remove().catch(() => undefined);
  };
}

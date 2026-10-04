import { isNativeShell } from "./runtime";

export type NativeAppStateListener = (isActive: boolean) => void;

export async function addNativeAppStateListener(
  listener: NativeAppStateListener,
): Promise<() => Promise<void>> {
  if (!isNativeShell()) return async () => undefined;

  const { App } = await import("@capacitor/app");
  const handle = await App.addListener("appStateChange", ({ isActive }) => {
    listener(isActive);
  });

  return async () => {
    await handle.remove().catch(() => undefined);
  };
}

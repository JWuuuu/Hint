/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from "vitest";
import { shouldShowDevicePreview } from "./DevicePreview";
const native = vi.hoisted(() => ({ value: false }));
vi.mock("../../lib/mobile/runtime", () => ({ isNativeShell: () => native.value }));
afterEach(() => { native.value = false; vi.unstubAllEnvs(); window.history.replaceState({}, "", "/"); });
it("allows an explicit production phone frame while keeping embedded pages unwrapped", () => {
  vi.stubEnv("DEV", false);
  window.history.replaceState({}, "", "/app?hintPreview=frame");
  expect(shouldShowDevicePreview()).toBe(true);
  window.history.replaceState({}, "", "/app?hintPreview=embedded");
  expect(shouldShowDevicePreview()).toBe(false);
  window.history.replaceState({}, "", "/app");
  expect(shouldShowDevicePreview()).toBe(false);
});
it("never places a simulated phone around the native app", () => {
  native.value = true;
  window.history.replaceState({}, "", "/app?hintPreview=frame");
  expect(shouldShowDevicePreview()).toBe(false);
});

import { configureAbortCompatibility } from "./abortCompatibility";

type CapacitorGlobal = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
};

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}

export function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  if (window.Capacitor?.isNativePlatform?.()) return true;
  return window.location.protocol === "capacitor:" || window.location.protocol === "ionic:";
}

export function getMobilePlatform(): string {
  if (typeof window === "undefined") return "web";
  return window.Capacitor?.getPlatform?.() ?? (isNativeShell() ? "native" : "web");
}

export function configureMobileRuntime() {
  if (typeof window === "undefined") return;

  configureAbortCompatibility();

  const root = document.documentElement;
  const syncViewport = () => {
    const viewport = window.visualViewport;
    const visibleHeight = viewport?.height ?? window.innerHeight;
    const keyboardInset = viewport
      ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      : 0;
    root.style.setProperty("--hint-vh", `${visibleHeight * 0.01}px`);
    root.style.setProperty("--hint-keyboard-inset", `${keyboardInset}px`);
  };

  root.dataset.hintPlatform = getMobilePlatform();
  root.dataset.hintNative = isNativeShell() ? "true" : "false";
  syncViewport();

  window.addEventListener("resize", syncViewport, { passive: true });
  window.visualViewport?.addEventListener("resize", syncViewport, { passive: true });
  window.visualViewport?.addEventListener("scroll", syncViewport, { passive: true });
}

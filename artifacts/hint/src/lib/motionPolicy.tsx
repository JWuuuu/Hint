import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { useHintPreferences } from "./preferences";
import { addNativeAppStateListener } from "./mobile/appLifecycle";

const QUERY = "(prefers-reduced-motion: reduce)";
function systemPreference() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;
}
function subscribeSystem(listener: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
function subscribeVisibility(listener: () => void) {
  document.addEventListener("visibilitychange", listener);
  window.addEventListener("pageshow", listener);
  return () => {
    document.removeEventListener("visibilitychange", listener);
    window.removeEventListener("pageshow", listener);
  };
}
export function useEffectiveReducedMotion() {
  const { preferences } = useHintPreferences();
  const systemReduced = useSyncExternalStore(subscribeSystem, systemPreference, () => false);
  return preferences.reduceMotion || systemReduced;
}
export type MotionPolicy = { reduced: boolean; pageVisible: boolean };
const Context = createContext<MotionPolicy>({ reduced: false, pageVisible: true });
export function useMotionPolicy() { return useContext(Context); }

export function MotionPolicyProvider({ children }: { children: ReactNode }) {
  const reduced = useEffectiveReducedMotion();
  const browserVisible = useSyncExternalStore(subscribeVisibility, () => document.visibilityState !== "hidden", () => true);
  const [nativeActive, setNativeActive] = useState(true);
  const pageVisible = browserVisible && nativeActive;
  useEffect(() => {
    let disposed = false;
    let remove: (() => Promise<void>) | undefined;
    void addNativeAppStateListener(active => { if (!disposed) setNativeActive(active); })
      .then(listener => { if (disposed) void listener(); else remove = listener; })
      .catch(() => { /* Browser visibility remains available without a native bridge. */ });
    return () => { disposed = true; void remove?.(); };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.hintReduceMotion = String(reduced);
    document.documentElement.dataset.hintMotionPaused = String(!pageVisible);
  }, [reduced, pageVisible]);
  return <Context.Provider value={{ reduced, pageVisible }}>
    <MotionConfig reducedMotion={reduced ? "always" : "never"}>{children}</MotionConfig>
  </Context.Provider>;
}

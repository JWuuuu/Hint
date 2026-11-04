import { useEffect, useSyncExternalStore } from "react";

/**
 * Full-screen opaque surfaces (such as Share receipt) hide the app's sky and
 * mascot completely. While one is open, those decorative layers stop
 * animating, so the surface gets the main thread and the battery is spared.
 * They resume when the last covering surface closes.
 */
let covers = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

export function coverDecorations(): () => void {
  covers += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    covers -= 1;
    emit();
  };
}

export function decorationsCovered(): boolean {
  return covers > 0;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useDecorationsCovered(): boolean {
  return useSyncExternalStore(subscribe, decorationsCovered, () => false);
}

/** Call from a surface that fully covers the app while it is mounted. */
export function useCoverDecorations(active = true) {
  useEffect(() => (active ? coverDecorations() : undefined), [active]);
}

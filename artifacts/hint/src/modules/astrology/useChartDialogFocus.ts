import { useRef, type SyntheticEvent } from "react";

/** Keep touch-opened chart dialogs connected to a visible return target. */
export function useChartDialogFocus() {
  const root = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  function remember(event: SyntheticEvent) {
    const target = event.target as Element;
    if (target.closest('[role="dialog"]')) return;
    const control = target.closest<HTMLElement>('button, a, [role="button"]');
    if (control) opener.current = control;
  }
  function restore(event: Event) {
    event.preventDefault();
    // A zoom-to-detail handoff must leave the new dialog in control of focus.
    if (document.querySelector('[role="dialog"][data-state="open"]')) return;
    const target = opener.current?.isConnected
      ? opener.current
      : root.current?.querySelector<HTMLElement>('button, a, [role="button"]');
    target?.focus({ preventScroll: true });
  }
  return { root, remember, restore };
}

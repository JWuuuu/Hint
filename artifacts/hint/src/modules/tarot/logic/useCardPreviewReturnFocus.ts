import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";

function canFocus(element: HTMLElement | null): element is HTMLElement {
  if (!element?.isConnected || element.closest("[inert]") || element.matches(":disabled") ||
    getComputedStyle(element).visibility !== "visible") return false;
  for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
    if (getComputedStyle(ancestor).display === "none") return false;
  }
  return true;
}

// Reduced-motion CSS can still create inherited visibility transitions. Wait
// for those transitions to leave the reading subtree, not an assumed duration.
function hasVisibilityTransition(background: HTMLElement) {
  return (background.getAnimations?.({ subtree: true }) ?? []).some(animation =>
    animation.effect instanceof KeyframeEffect &&
    animation.effect.getKeyframes().some(frame => "visibility" in frame));
}

export function useCardPreviewReturnFocus(
  open: boolean,
  backgroundRef: RefObject<HTMLDivElement | null>,
) {
  const opener = useRef<HTMLElement | null>(null);
  const generation = useRef(0);
  const openRef = useRef(open);
  const mounted = useRef(false);
  const focusMoved = useRef(false);
  const frame = useRef<number | null>(null);
  const location = useRef("");
  const cancel = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  useLayoutEffect(() => {
    openRef.current = open;
    if (open) { cancel(); return; }
    if (!opener.current) return;
    const exitingDialog = backgroundRef.current?.parentElement?.querySelector('[role="dialog"]');
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && event.target !== document.body &&
        event.target !== opener.current && !exitingDialog?.contains(event.target)) {
        // Remember the choice even if a subsequent visibility change blurs it
        // before Radix's close callback or our next rendering update.
        focusMoved.current = true;
        cancel();
      }
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, [open, cancel, backgroundRef]);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      cancel();
    };
  }, [cancel]);

  const captureOpener = useCallback((element: HTMLElement | null) => {
    cancel();
    generation.current += 1;
    focusMoved.current = false;
    opener.current = element;
    location.current = window.location.href;
  }, [cancel]);

  // An exiting preview retains this render's callback. A later preview must
  // invalidate it even if that later preview has already closed as well.
  const session = generation.current;
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    if (!mounted.current || openRef.current || focusMoved.current || session !== generation.current) return;
    cancel();
    const background = backgroundRef.current;
    const target = opener.current;
    if (!background) return;

    const restore = () => {
      frame.current = null;
      if (!mounted.current || openRef.current || focusMoved.current || session !== generation.current ||
        !background.isConnected || location.current !== window.location.href ||
        document.querySelector('[role="dialog"]')) return;
      // A user who has already moved focus owns it; a stale close must not
      // take it back from another control or another dialog.
      if (document.activeElement !== document.body && document.activeElement !== target) return;
      if (hasVisibilityTransition(background)) {
        frame.current = requestAnimationFrame(restore);
        return;
      }
      const destination = canFocus(target) ? target :
        background.querySelector<HTMLElement>('[data-testid="tarot-short-answer"]');
      if (canFocus(destination)) destination.focus({ preventScroll: true });
    };
    restore();
  };
  return { captureOpener, restoreFocus };
}

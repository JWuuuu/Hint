import { useLayoutEffect, useRef } from "react";

/** The fixed-height room can be shorter than its header and composer together.
 * Let Ask scroll in that case and reveal the focused composer after a resize.
 * Never refocus or replace the textarea: its selection belongs to the reader. */
export function useAskComposerVisibility() {
  const layoutRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const layout = layoutRef.current;
    const textarea = layout?.querySelector("textarea");
    const composer = textarea?.parentElement?.parentElement;
    if (!layout || !textarea || !composer) return;
    let frame = 0;
    const reveal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Safari need not focus a button on pointer activation. Active
        // dictation still owns the composer (the textarea is then read-only).
        if (!composer.contains(document.activeElement) && !textarea.readOnly) return;
        const room = layout.getBoundingClientRect();
        // A voice notice may be taller than the room. The editable row still
        // needs to fit, with its mic/send controls alongside the textarea.
        const target = (composer.offsetHeight <= layout.clientHeight ? composer : textarea.parentElement!).getBoundingClientRect();
        if (target.bottom > room.bottom) layout.scrollTop += target.bottom - room.bottom;
        else if (target.top < room.top) layout.scrollTop += target.top - room.top;
      });
    };
    const observer = new ResizeObserver(reveal);
    observer.observe(layout);
    observer.observe(composer);
    layout.addEventListener("focusin", reveal);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      layout.removeEventListener("focusin", reveal);
    };
  }, []);

  return layoutRef;
}

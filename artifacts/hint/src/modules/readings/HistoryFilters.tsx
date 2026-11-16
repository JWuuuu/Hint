import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "../../lib/i18n";
import { HISTORY_COPY } from "./historyCopy";

const EDGE_CLEARANCE = 48; // Actual 44px control plus 4px clear space.

/** Keep the archive's single row, with a tap alternative to horizontal swiping. */
export function HistoryFilters({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const copy = HISTORY_COPY[language];
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ previous: false, next: false, below: false });
  const measure = () => {
    const el = row.current;
    if (!el) return;
    const previous = el.scrollLeft > 1;
    const next = el.scrollWidth - el.clientWidth - el.scrollLeft > 1;
    // Keep long, enlarged chips intact. When two real touch targets would
    // crowd them, place only the new controls below the unchanged filter row.
    const below = Array.from(el.children).some(child => child.getBoundingClientRect().width > el.clientWidth - 2 * EDGE_CLEARANCE);
    setEdges(old => old.previous === previous && old.next === next && old.below === below ? old : { previous, next, below });
  };

  useLayoutEffect(() => {
    const el = row.current;
    if (!el) return;
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    Array.from(el.children).forEach(child => observer?.observe(child));
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [children]);

  const reveal = (button: HTMLElement) => {
    const el = row.current;
    if (!el) return;
    const viewport = el.getBoundingClientRect();
    const bounds = button.getBoundingClientRect();
    // Leave space for the overlaid edge controls; clamping removes the control
    // at either end, so the first/last chip retains its original resting position.
    const left = viewport.left + (!edges.below && el.scrollLeft > 1 ? EDGE_CLEARANCE : 4);
    const right = viewport.right - (!edges.below && el.scrollWidth - el.clientWidth - el.scrollLeft > 1 ? EDGE_CLEARANCE : 4);
    if (bounds.left < left) el.scrollLeft -= left - bounds.left;
    else if (bounds.right > right) el.scrollLeft += bounds.right - right;
    measure();
  };
  const move = (direction: "previous" | "next") => {
    const el = row.current;
    if (!el) return;
    const bounds = el.getBoundingClientRect();
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>(".hr-filter"));
    const clearance = edges.below ? 4 : EDGE_CLEARANCE;
    const target = direction === "next"
      ? buttons.find(button => button.getBoundingClientRect().right > bounds.right - clearance + 1)
      : buttons.reverse().find(button => button.getBoundingClientRect().left < bounds.left + clearance - 1);
    target?.focus({ preventScroll: true });
    if (target) reveal(target);
  };

  return <div className="hr-filter-strip" data-controls-below={edges.below && (edges.previous || edges.next) ? "true" : undefined}>
    <div ref={row} className="hr-filters" role="group" aria-label={copy.filter} onScroll={measure}
      onFocus={event => { if (event.target.matches(".hr-filter")) reveal(event.target); }}>
      {children}
    </div>
    {edges.previous && <button type="button" className="hr-filter-edge" data-direction="previous" aria-label={copy.previousFilters} onClick={() => move("previous")}><ChevronLeft size={18} aria-hidden="true" /></button>}
    {edges.next && <button type="button" className="hr-filter-edge" data-direction="next" aria-label={copy.nextFilters} onClick={() => move("next")}><ChevronRight size={18} aria-hidden="true" /></button>}
  </div>;
}

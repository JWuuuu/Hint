import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { AroundNavHandler } from "wouter";
import { Dialog, DialogPortal, DialogOverlay, DialogSurface, DialogTitle, DialogDescription } from "../ui/dialog";
import { useLanguage } from "../../lib/i18n";
import { useMotionPolicy } from "../../lib/motionPolicy";
import { canonicalRoom, markRoomVisitClosed } from "./roomVisits";
import { ROOM_EXIT_COPY } from "./roomExitCopy";
import "./room-visits.css";

const REQUEST = "hint:room-leave-request";
type Request = { to: string; proceed: () => void };
type Visit = { room: string; hasProgress: boolean; onLeave?: () => void };
type Registration = { room: string; read: () => Visit };
type Pending = Request & { source: string; registration: Registration; opener: HTMLElement | null };
const VisitContext = createContext<((visit: Registration) => () => void) | null>(null);

export function useManagedRoomVisit() { return useContext(VisitContext) !== null; }

/** Wouter's supported navigation hook; no second History API patch. */
export const guardRoomNavigation: AroundNavHandler = (navigate, to, options) => {
  const event = new CustomEvent<Request>(REQUEST, { cancelable: true, detail: { to, proceed: () => navigate(to, options) } });
  if (window.dispatchEvent(event)) navigate(to, options);
};

export function useRoomVisit(visit: Visit) {
  const register = useContext(VisitContext);
  const current = useRef(visit);
  current.current = visit;
  useLayoutEffect(() => register?.({ room: visit.room, read: () => current.current }), [register, visit.room]);
}

export function RoomVisitBoundary({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const { reduced } = useMotionPolicy();
  const copy = ROOM_EXIT_COPY[language];
  const registrations = useRef(new Map<string, Registration>());
  const previous = useRef(canonicalRoom(window.location.pathname));
  const prepared = useRef<string | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [leftRoom, setLeftRoom] = useState<string | null>(null);
  const staying = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const register = useCallback((visit: Registration) => {
    registrations.current.set(visit.room, visit);
    return () => { if (registrations.current.get(visit.room) === visit) registrations.current.delete(visit.room); };
  }, []);

  const closeVisit = useCallback((room: string, registration?: Registration) => {
    markRoomVisitClosed(room);
    registration?.read().onLeave?.();
  }, []);

  useLayoutEffect(() => {
    let activated: HTMLElement | null = null;
    let clearActivation: number | undefined;
    const rememberActivation = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>("a[href],button") : null;
      activated = element;
      // WebKit can run microtasks between native capture and React's delegated
      // click handler. Keep this opener through that event, then discard it so
      // later programmatic navigation uses its current focus.
      window.clearTimeout(clearActivation);
      clearActivation = window.setTimeout(() => { activated = null; clearActivation = undefined; }, 0);
    };
    const request = (raw: Event) => {
      const event = raw as CustomEvent<Request>;
      const source = canonicalRoom(window.location.pathname);
      const destination = canonicalRoom(event.detail.to);
      if (!source || source === destination) return;
      const registration = registrations.current.get(source);
      if (registration?.read().hasProgress) {
        event.preventDefault();
        // A second tap must not replace a destination the person is reviewing.
        if (pendingRef.current) return;
        const next: Pending = { ...event.detail, source, registration, opener: activated ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null) };
        pendingRef.current = next;
        restoreFocus.current = next.opener;
        setPending(next);
      } else {
        prepared.current = source;
        closeVisit(source, registration);
      }
    };
    const committed = () => {
      const destination = canonicalRoom(window.location.pathname);
      const source = previous.current;
      previous.current = destination;
      if (!source || source === destination) return;
      if (prepared.current === source) { prepared.current = null; return; }
      const registration = registrations.current.get(source);
      const hasProgress = registration?.read().hasProgress;
      closeVisit(source, registration);
      // Browser Back has already committed. Explain the reset without trapping
      // the user in an artificial history entry or replaying their navigation.
      pendingRef.current = null;
      setPending(null);
      if (hasProgress) setLeftRoom(source);
    };
    window.addEventListener(REQUEST, request);
    document.addEventListener("click", rememberActivation, true);
    const events = ["popstate", "pushState", "replaceState"];
    events.forEach(name => window.addEventListener(name, committed, true));
    return () => {
      window.removeEventListener(REQUEST, request);
      document.removeEventListener("click", rememberActivation, true);
      window.clearTimeout(clearActivation);
      events.forEach(name => window.removeEventListener(name, committed, true));
    };
  }, [closeVisit]);

  const cancel = () => {
    pendingRef.current = null;
    setPending(null);
    setLeftRoom(null);
    window.dispatchEvent(new Event("hint:room-navigation-cancelled"));
  };
  const leave = () => {
    const next = pendingRef.current;
    if (!next || canonicalRoom(window.location.pathname) !== next.source || registrations.current.get(next.source) !== next.registration) { cancel(); return; }
    pendingRef.current = null;
    restoreFocus.current = null;
    prepared.current = next.source;
    closeVisit(next.source, next.registration);
    setPending(null);
    window.dispatchEvent(new CustomEvent("hint:room-navigation-approved", { detail: { to: next.to } }));
    next.proceed();
  };

  return <VisitContext.Provider value={register}>
    {children}
    <Dialog open={Boolean(pending || leftRoom)} onOpenChange={open => { if (!open) cancel(); }}>
      <DialogPortal>
        <DialogOverlay className="hint-room-exit-overlay" data-reduced={reduced} />
        <DialogSurface className="hint-room-exit-panel" data-room-exit-dialog data-reduced={reduced}
          onOpenAutoFocus={event => { event.preventDefault(); staying.current?.focus(); }}
          onCloseAutoFocus={event => { event.preventDefault(); if (restoreFocus.current?.isConnected) restoreFocus.current.focus(); }}>
          <span className="hint-room-exit-seal" aria-hidden="true">✦</span>
          <DialogTitle className="hint-room-exit-title">{pending ? copy.title : copy.leftTitle}</DialogTitle>
          <DialogDescription className="hint-room-exit-description">{pending ? pending.source === "tarot" ? copy.tarot : copy.other : copy.left}</DialogDescription>
          <p className="hint-room-exit-kept">{copy.kept}</p>
          <div className="hint-room-exit-actions">
            <button ref={staying} type="button" onClick={cancel}>{pending ? copy.stay : copy.okay}</button>
            {pending && <button type="button" data-primary onClick={leave}>{copy.leave}</button>}
          </div>
        </DialogSurface>
      </DialogPortal>
    </Dialog>
  </VisitContext.Provider>;
}

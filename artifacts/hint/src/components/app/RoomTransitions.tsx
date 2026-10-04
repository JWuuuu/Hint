import { useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type MouseEvent } from "react";
import { useMotionPolicy } from "../../lib/motionPolicy";
import { useRouter } from "wouter";
import { preloadRoom } from "../../product/roomPreload";
import { entranceKeyframes, entrancePath, entranceRect, entranceRoom, isEntranceOrigin, ROOM_ENTRANCES, ENTRANCE_SETTLE_EASING, type EntranceRect, type EntranceRoom } from "./roomEntrance";
import "./room-transitions.css";

type Intent = { from: string; to: string; room: EntranceRoom; rect: EntranceRect; createdAt: number };
type Entrance = Intent & { id: number };

function navigationTarget(target: EventTarget | null, base: string) {
  const element = target instanceof Element ? target.closest<HTMLAnchorElement | HTMLButtonElement>("a[href],button[data-room-target]") : null;
  if (!element || element.getAttribute("aria-disabled") === "true") return null;
  const isLink = element instanceof HTMLAnchorElement;
  if (isLink ? element.hasAttribute("download") || (element.target && element.target !== "_self") : element.disabled) return null;
  const value = isLink ? element.href : element.dataset.roomTarget?.trim();
  if (!value) return null;
  try {
    // Button destinations use the same app-relative path as Wouter navigate().
    const path = !isLink && base && value.startsWith("/") && !value.startsWith("//") && !value.startsWith(`${base}/`) ? `${base}${value}` : value;
    const url = new URL(path, window.location.href);
    return url.origin === window.location.origin ? { element, url, isLink } : null;
  } catch { return null; }
}

/** One persistent content host; links, router, focus and forms remain the owners. */
export function RoomTransitions({ location, children, ...props }: HTMLAttributes<HTMLDivElement> & { location: string }) {
  const root = useRef<HTMLDivElement>(null);
  const pending = useRef<Intent | null>(null);
  const previousPath = useRef(entrancePath(location));
  const nextId = useRef(0);
  const [entrance, setEntrance] = useState<Entrance | null>(null);
  const { reduced, pageVisible } = useMotionPolicy();
  const { base } = useRouter();

  useEffect(() => {
    // Me exposes Tarot setup as a primary preference. Warm its local chunk once
    // the page has settled so its entrance does not open onto a cold loader.
    const path = entrancePath(location);
    if (!pageVisible || !["/", "/app", "/app/profile"].includes(path)) return;
    const timer = window.setTimeout(() => {
      preloadRoom("/app/tarot");
      if (path !== "/app/profile") preloadRoom("/app/astrology");
    }, 600);
    return () => window.clearTimeout(timer);
  }, [location, pageVisible]);

  function warmLink(target: EventTarget | null) {
    if (!pageVisible || !isEntranceOrigin(location) || !(target instanceof Element)) return;
    const destination = navigationTarget(target, base);
    if (!destination || !root.current?.contains(destination.element)) return;
    const { url } = destination;
    preloadRoom(base && url.pathname.startsWith(`${base}/`) ? url.pathname.slice(base.length) : url.pathname);
  }

  function captureClick(event: MouseEvent<HTMLDivElement>) {
    const priorIntent = pending.current;
    pending.current = null;
    if (!pageVisible || !isEntranceOrigin(location) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const destination = navigationTarget(event.target, base);
    if (!destination || !root.current?.contains(destination.element)) return;
    const { element, url, isLink } = destination;
    const from = entrancePath(location);
    const relativePath = base && url.pathname.startsWith(`${base}/`) ? url.pathname.slice(base.length) : url.pathname;
    const to = entrancePath(relativePath);
    const room = entranceRoom(to);
    if (url.origin !== window.location.origin || !room) return;
    // Wouter pushes even an identical URL. A second tap in the same frame must
    // not add another history entry while the first navigation is committing.
    if (isLink && url.pathname === window.location.pathname && url.search === window.location.search && url.hash === window.location.hash) {
      if (priorIntent?.to === to) pending.current = priorIntent;
      event.preventDefault();
      return;
    }
    // Details and query changes stay within the current room; a deliberate
    // link to a different room receives that destination's entrance.
    if (from === to || entranceRoom(from) === room) return;
    const rect = entranceRect(element.getBoundingClientRect(), root.current.getBoundingClientRect());
    if (rect) pending.current = { from, to, room, rect, createdAt: performance.now() };
  }

  useLayoutEffect(() => {
    const path = entrancePath(location);
    if (path === previousPath.current) return;
    const intent = pending.current;
    pending.current = null;
    const matches = intent?.from === previousPath.current && intent.to === path && performance.now() - intent.createdAt < 800;
    previousPath.current = path;
    setEntrance(matches && pageVisible ? { ...intent, id: ++nextId.current } : null);
  }, [location, pageVisible]);

  useEffect(() => {
    if (!pageVisible) { pending.current = null; setEntrance(null); }
  }, [pageVisible]);
  useEffect(() => {
    const dismiss = () => { pending.current = null; setEntrance(null); };
    // A back gesture, resize or bfcache restore must never replay a stale entrance.
    window.addEventListener("popstate", dismiss);
    window.addEventListener("resize", dismiss);
    window.addEventListener("pagehide", dismiss);
    window.addEventListener("pageshow", dismiss);
    return () => {
      window.removeEventListener("popstate", dismiss);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("pagehide", dismiss);
      window.removeEventListener("pageshow", dismiss);
    };
  }, []);

  useEffect(() => {
    const approve = (event: Event) => {
      const intent = pending.current;
      const to = (event as CustomEvent<{ to?: unknown }>).detail?.to;
      if (!intent || typeof to !== "string" || intent.from !== previousPath.current) return;
      try {
        const url = new URL(to, window.location.href);
        const path = base && url.pathname.startsWith(`${base}/`) ? url.pathname.slice(base.length) : url.pathname;
        if (url.origin === window.location.origin && entrancePath(path) === intent.to) {
          // A confirmed departure may happen after the original click expires.
          // Keep its source geometry; the leave boundary still owns navigation.
          intent.createdAt = performance.now();
        }
      } catch { /* An invalid approval cannot change the pending entrance. */ }
    };
    const cancel = () => { pending.current = null; };
    window.addEventListener("hint:room-navigation-approved", approve);
    window.addEventListener("hint:room-navigation-cancelled", cancel);
    return () => {
      window.removeEventListener("hint:room-navigation-approved", approve);
      window.removeEventListener("hint:room-navigation-cancelled", cancel);
    };
  }, [base]);

  return <div {...props} ref={root} data-room-transitions onClickCapture={captureClick} onPointerOver={event => warmLink(event.target)} onFocusCapture={event => warmLink(event.target)} onPointerDownCapture={event => warmLink(event.target)}>
    {children}
    {entrance && pageVisible && <RoomArrivalMotion key={entrance.id} container={root.current} entrance={entrance} reduced={reduced} onDone={() => setEntrance(current => current?.id === entrance.id ? null : current)} />}
  </div>;
}

function RoomArrivalMotion({ container, entrance, reduced, onDone }: { container: HTMLDivElement | null; entrance: Entrance; reduced: boolean; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useLayoutEffect(() => {
    const content = container?.querySelector<HTMLElement>("[data-room-content]");
    if (reduced || !content || typeof content.animate !== "function") { done.current(); return; }
    const previousWillChange = content.style.willChange;
    const id = String(entrance.id);
    let disposed = false;
    let completed = false;
    let animation: Animation | undefined;
    let observer: MutationObserver | undefined;
    let loadDeadline: number | undefined;
    let motionDeadline: number | undefined;
    const restore = () => {
      if (content.dataset.roomArrivalId !== id) return;
      content.removeAttribute("data-room-entrance");
      content.removeAttribute("data-motion");
      content.removeAttribute("data-room-arrival-id");
      content.style.willChange = previousWillChange;
    };
    const settle = () => {
      if (disposed || completed) return;
      completed = true;
      observer?.disconnect();
      window.clearTimeout(loadDeadline);
      window.clearTimeout(motionDeadline);
      animation?.cancel();
      restore();
      done.current();
    };
    const begin = () => {
      if (disposed || completed || animation) return;
      if (content.querySelector("[data-room-load-error]")) { settle(); return; }
      if (content.querySelector("[data-room-loading]")) return;
      observer?.disconnect();
      window.clearTimeout(loadDeadline);
      const bounds = content.getBoundingClientRect();
      if (bounds.width < 1 || bounds.height < 1) { settle(); return; }
      content.dataset.roomEntrance = entrance.room;
      content.dataset.motion = "full";
      content.dataset.roomArrivalId = id;
      content.style.willChange = "transform";
      const duration = ROOM_ENTRANCES[entrance.room].duration;
      try {
        animation = content.animate(entranceKeyframes(entrance.room, entrance.rect, bounds, false), {
          duration, easing: ENTRANCE_SETTLE_EASING, fill: "both",
        });
        animation.finished.then(settle, settle);
        motionDeadline = window.setTimeout(settle, duration + 80);
      } catch { settle(); }
    };
    // Reading and controls stay available throughout. Engaging with the room
    // settles its decorative arrival instead of making a moving input compete.
    const events = ["pointerdown", "wheel", "click", "focusin", "keydown"];
    events.forEach(name => content.addEventListener(name, settle, { capture: true, passive: true }));
    // A cold module keeps its real loading feedback. Only the arrived content
    // receives motion; no second curtain or timer holds back the page.
    if (content.querySelector("[data-room-loading]")) {
      observer = new MutationObserver(begin);
      observer.observe(content, { childList: true, subtree: true });
      loadDeadline = window.setTimeout(settle, 10_000);
    }
    begin();
    return () => {
      disposed = true;
      observer?.disconnect();
      window.clearTimeout(loadDeadline);
      window.clearTimeout(motionDeadline);
      events.forEach(name => content.removeEventListener(name, settle, true));
      if (!completed) animation?.cancel();
      restore();
    };
  }, [container, entrance, reduced]);
  return null;
}

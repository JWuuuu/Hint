import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useMotionPolicy } from "../../lib/motionPolicy";
import type { GestureId, HintSceneContext, HintSceneFrame, HintScenePlayer } from "../../../mascot-library/versions/v3.2/src/index";
import "./hint-guide.css";

type Delivery = { key: string; cardBack: string; target: RefObject<HTMLDivElement | null>; done: boolean };
type Slot = { node: HTMLDivElement; context: HintSceneContext; delivery?: Delivery; priority: number; order: number };
type GuideContext = {
  enabled: boolean;
  mount: (key: symbol, slot: Omit<Slot, "order">) => void;
  update: (key: symbol, context: HintSceneContext, delivery?: Delivery) => void;
  unmount: (key: symbol) => void;
  react: () => void;
  playGesture: (id: GestureId) => void;
  subscribe: (listener: (frame: HintSceneFrame) => void) => () => void;
};
const Context = createContext<GuideContext | null>(null);
type Review = { speed?: number; holdAt?: number; paused?: boolean; onPauseChange?: (paused: boolean) => void };
const PlaybackContext = createContext({ speed: 1, paused: false });
type Area = { top: number; right: number; bottom: number; left: number };
const clips = (overflow: string) => Boolean(overflow) && overflow !== "visible";

/** Narrows the stage to the boxes of the ancestors that scroll or clip a node. */
function clipArea(node: Element, stage: Area): Area {
  const area = { ...stage };
  let position = getComputedStyle(node).position;
  for (let element = node.parentElement; element && element !== document.body && element !== document.documentElement && position !== "fixed"; element = element.parentElement) {
    const style = getComputedStyle(element);
    const containing = Boolean(style.position && style.position !== "static" || style.transform && style.transform !== "none");
    // An absolute box escapes the overflow of static ancestors until its containing block.
    if (position === "absolute" && !containing) continue;
    const box = element.getBoundingClientRect();
    if (clips(style.overflowX || style.overflow)) { area.left = Math.max(area.left, box.left);area.right = Math.min(area.right, box.right); }
    if (clips(style.overflowY || style.overflow)) { area.top = Math.max(area.top, box.top);area.bottom = Math.min(area.bottom, box.bottom); }
    position = style.position;
  }
  return area;
}

export function hintGuideEnabled() {
  return import.meta.env.VITE_HINT_GUIDE_V32 !== "0";
}

export function HintGuideProvider({ children, enabled: enabledOverride, review }: { children: ReactNode; enabled?: boolean; review?: Review }) {
  const [enabledAtStart] = useState(hintGuideEnabled);
  const [unavailable, setUnavailable] = useState(false);
  const enabled = (enabledOverride ?? enabledAtStart) && !unavailable;
  const policy = useMotionPolicy();
  const currentPolicy = useRef(policy);currentPolicy.current = policy;
  const currentReview = useRef(review);currentReview.current = review;
  const [heldForReview, setHeldForReview] = useState(false);
  const reviewHeld = useRef(false);
  const previousHold = useRef(review?.holdAt);
  const playback = useMemo(() => ({ speed: import.meta.env.DEV ? review?.speed || 1 : 1,
    paused: Boolean(import.meta.env.DEV && (review?.paused || heldForReview)) }), [review?.speed, review?.paused, heldForReview]);
  const slots = useRef(new Map<symbol, Slot>());
  const order = useRef(0), selected = useRef<symbol | null>(null), lastContext = useRef("");
  const overlay = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const actor = useRef<HTMLDivElement>(null), fallback = useRef<HTMLImageElement>(null), shadow = useRef<HTMLSpanElement>(null);
  const origin = useRef<SVGSVGElement>(null);
  const listeners = useRef(new Set<(frame: HintSceneFrame) => void>());
  const player = useRef<HintScenePlayer | null>(null);
  const synchronize = useRef<(followLayout?: boolean) => void>(() => {});
  const syncQueued = useRef(false);
  const [requested, setRequested] = useState(false);
  const scheduleSync = useCallback(() => {
    if (syncQueued.current) return;
    syncQueued.current = true;
    queueMicrotask(() => { syncQueued.current = false;synchronize.current(); });
  }, []);

  const mount = useCallback((key: symbol, slot: Omit<Slot, "order">) => {
    slots.current.set(key, { ...slot, order: ++order.current });setRequested(true);scheduleSync();
  }, [scheduleSync]);
  const update = useCallback((key: symbol, context: HintSceneContext, delivery?: Delivery) => {
    const slot = slots.current.get(key);if (!slot) return;
    slot.context = context;slot.delivery = delivery;scheduleSync();
  }, [scheduleSync]);
  // React replaces a large slot with its compact counterpart within one commit.
  // Measure the final registration set rather than briefly departing the room.
  const unmount = useCallback((key: symbol) => { slots.current.delete(key);scheduleSync(); }, [scheduleSync]);
  const react = useCallback(() => { player.current?.react(); }, []);
  const playGesture = useCallback((id: GestureId) => { player.current?.playGesture(id, { interrupt: true }); }, []);
  const subscribe = useCallback((listener: (frame: HintSceneFrame) => void) => {
    listeners.current.add(listener);return () => { listeners.current.delete(listener); };
  }, []);
  const value = useMemo(() => ({ enabled, mount, update, unmount, react, playGesture, subscribe }), [enabled, mount, update, unmount, react, playGesture, subscribe]);

  useEffect(() => {
    if (!enabled || !requested || !canvas.current || !overlay.current) return;
    let disposed = false;
    const stage = overlay.current, drawing = canvas.current;
    let activeNode: HTMLDivElement | null = null, previousWidth = 0;
    let deliveryNode: HTMLDivElement | null = null, hadDelivery = false;
    const resize = new ResizeObserver(() => synchronize.current(true));
    let clip = "";
    function setClip(value: string) {
      if (value === clip) return;
      clip = value;stage.style.clipPath = value;stage.dataset.clip = value || "none";
    }
    function sync(followLayout = false, tracking = false) {
      const viewport = window.visualViewport;
      const width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
      stage.style.width = `${width}px`;stage.style.height = `${height}px`;
      stage.style.left = `${viewport?.offsetLeft || 0}px`;stage.style.top = `${viewport?.offsetTop || 0}px`;
      const entry = [...slots.current.entries()].filter(([, slot]) => slot.node.isConnected)
        .sort((a, b) => b[1].priority - a[1].priority || b[1].order - a[1].order)[0];
      if (!player.current) return;
      if (!entry) {
        if (hadDelivery) player.current.setDelivery(null);hadDelivery = false;
        if (deliveryNode) resize.unobserve(deliveryNode);deliveryNode = null;
        selected.current = null;lastContext.current = "";
        if (activeNode) resize.unobserve(activeNode);activeNode = null;setClip("");
        player.current.setContext({ room: "away", phase: "idle", audioPlaying: false });
        player.current.setMotionPolicy({ reduced: currentPolicy.current.reduced, visible: currentPolicy.current.pageVisible });return;
      }
      const [key, slot] = entry, changed = selected.current !== key;
      if (activeNode !== slot.node) { if (activeNode) resize.unobserve(activeNode);activeNode = slot.node;resize.observe(activeNode); }
      const bounds = slot.node.getBoundingClientRect(), screen = stage.getBoundingClientRect();
      const target = slot.delivery?.target.current ?? null;
      const targetBounds = target?.isConnected ? target.getBoundingClientRect() : null;
      const contextKey = JSON.stringify(slot.context), contextChanged = lastContext.current !== contextKey;
      // The finite letter delivery belongs to the open modal, even when its
      // small header slot scrolls away. Page/native suspension still pauses it.
      const delivering = Boolean(slot.delivery && !slot.delivery.done && targetBounds && targetBounds.width > 0 && targetBounds.height > 0);
      // The guide shares the scrolling viewport of its slot, so it never paints
      // over a fixed header or content scrolled out of reach. The stage clip
      // covers canvas, fallback and shadow and nests outside the intro mask.
      const area = clipArea(delivering && target ? target : slot.node, { top: screen.top, right: screen.right, bottom: screen.bottom, left: screen.left });
      const px = (value: number) => `${Math.max(0, Math.round(value * 100) / 100)}px`;
      setClip(area.top <= screen.top + .5 && area.left <= screen.left + .5 && area.bottom >= screen.bottom - .5 && area.right >= screen.right - .5 ? ""
        : area.bottom <= area.top || area.right <= area.left ? "inset(50%)"
        : `inset(${px(area.top - screen.top)} ${px(screen.right - area.right)} ${px(screen.bottom - area.bottom)} ${px(area.left - screen.left)})`);
      const visible = delivering || bounds.width > 0 && bounds.height > 0 && bounds.bottom > area.top && bounds.top < area.bottom && bounds.right > area.left && bounds.left < area.right;
      stage.style.zIndex = String(Math.max(20, slot.priority));
      player.current.setMotionPolicy({ reduced: currentPolicy.current.reduced, visible: currentPolicy.current.pageVisible && visible });
      if (changed || contextChanged) player.current.setContext(slot.context);
      const size = Math.min(bounds.width, bounds.height);
      player.current.setAnchor({ x: (bounds.left + bounds.width / 2 - screen.left) / width, y: (bounds.top + bounds.height / 2 - screen.top) / height, width: size / width },
        // A moving room also scales its slot; the guide rides along without a new glide.
        { followLayout: followLayout && !changed && (tracking || Math.abs(previousWidth - size) < 1) });
      if (deliveryNode !== target) { if (deliveryNode) resize.unobserve(deliveryNode);deliveryNode = target;if (target) resize.observe(target); }
      if (slot.delivery && targetBounds) {
        const rect = targetBounds;
        player.current.setDelivery({ key: slot.delivery.key, cardBack: slot.delivery.cardBack, done: slot.delivery.done || rect.width <= 0 || rect.height <= 0,
          card: { x: (rect.left - screen.left) / width, y: (rect.top - screen.top) / height, width: rect.width / width, height: rect.height / height } });
        hadDelivery = true;
      } else if (hadDelivery) { player.current.setDelivery(null);hadDelivery = false; }
      previousWidth = size;selected.current = key;lastContext.current = contextKey;
    }
    synchronize.current = sync;
    const follow = () => sync(true);
    // A room entrance moves the slot with a native transform that raises no
    // layout event. Measure each frame only while an owned entrance runs, and
    // once more when it finishes, is cancelled or settles.
    const motions = new Set<string>();
    let frameRequest = 0, trackUntil = 0;
    const tracking = () => !currentPolicy.current.reduced && currentPolicy.current.pageVisible;
    const track = () => {
      frameRequest = 0;
      if (disposed) return;
      if (!motions.size || !tracking() || performance.now() > trackUntil) { motions.clear();sync(true, true);return; }
      sync(true, true);
      if (selected.current) frameRequest = requestAnimationFrame(track);
    };
    // Without a player nothing is selected and frames stop; readiness resumes them.
    const resumeTracking = () => { if (!frameRequest && motions.size && tracking()) frameRequest = requestAnimationFrame(track); };
    const roomMotion = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: unknown; active?: unknown }>).detail;
      if (typeof detail?.id !== "string") return;
      if (detail.active) { motions.add(detail.id);trackUntil = performance.now() + 4000; } else motions.delete(detail.id);
      // An entrance may end inside a navigation commit; measure its final
      // registrations afterwards, like a slot change, not a brief departure.
      if (!motions.size) { cancelAnimationFrame(frameRequest);frameRequest = 0;queueMicrotask(() => { if (!disposed) sync(true, true); }); }
      else resumeTracking();
    };
    window.addEventListener("hint:room-motion", roomMotion);
    window.addEventListener("resize", follow);window.addEventListener("scroll", follow, true);
    window.visualViewport?.addEventListener("resize", follow);window.visualViewport?.addEventListener("scroll", follow);
    sync();
    void Promise.all([
      import("../../../mascot-library/versions/v3.2/src/index"),
      import("../../../mascot-library/versions/v3.2/preview/hint-assets.js"),
    ]).then(async ([library, bundle]) => {
      if (disposed) return;
      if (fallback.current) fallback.current.src = bundle.assets.images["empty-rest"];
      const instance = await library.createHintScenePlayer(drawing, {
        assets: bundle.assets, context: { room: "away", phase: "idle" }, pointerTarget: document.body,
        motionPolicy: { reduced: currentPolicy.current.reduced, visible: false },
        onFrame(frame) {
          if (disposed || !actor.current) return;
          const holdAt = currentReview.current?.holdAt;
          if (import.meta.env.DEV && holdAt !== undefined && frame.delivery && frame.delivery.time >= holdAt && !reviewHeld.current) {
            reviewHeld.current = true;
            queueMicrotask(() => { if (!disposed) { setHeldForReview(true);player.current?.pause();currentReview.current?.onPauseChange?.(true); } });
          }
          if (!frame.delivery && reviewHeld.current) {
            reviewHeld.current = false;queueMicrotask(() => { if (!disposed) { setHeldForReview(false);if (!currentReview.current?.paused) player.current?.resume(); } });
          }
          const bounds = stage.getBoundingClientRect(), position = frame.actor;
          const intro = frame.intro;
          drawing.style.opacity = String(intro?.actor.opacity ?? 1);
          drawing.style.clipPath = intro && !intro.actor.front ? `inset(0 0 ${Math.max(0, 1 - intro.maskY) * 100}% 0)` : "none";
          drawing.style.zIndex = intro && !intro.actor.front ? "1" : "3";
          if (origin.current) {
            origin.current.style.opacity = String(intro?.logoOpacity ?? 0);
            if (intro) {
              origin.current.style.left = `${intro.logo.x * 100}%`;origin.current.style.top = `${intro.logo.y * 100}%`;
              origin.current.style.width = `${intro.logo.width * bounds.width}px`;
            }
          }
          actor.current.style.width = `${position.width * bounds.width}px`;actor.current.style.height = `${position.height * bounds.height}px`;
          actor.current.style.transform = `translate3d(${position.x * bounds.width}px,${position.y * bounds.height}px,0)`;
          actor.current.hidden = frame.state.placement === "away" && !frame.state.transitioning;
          if (fallback.current) {
            fallback.current.hidden = !frame.fallback;
            const source = bundle.assets.images[frame.letter === "delivered" ? "empty-rest" : "approved-rest"];
            if (fallback.current.getAttribute("src") !== source) fallback.current.src = source;
          }
          if (shadow.current) {
            shadow.current.style.left = `${frame.shadow.x * 100}%`;shadow.current.style.top = `${frame.shadow.y * 100}%`;
            shadow.current.style.width = `${frame.shadow.width * 100}%`;shadow.current.style.opacity = String(intro?.shadow.opacity ?? frame.shadow.opacity);
          }
          stage.dataset.phase = frame.state.context.phase;stage.dataset.activity = frame.state.activity;
          stage.dataset.paused = String(frame.state.paused);stage.dataset.clock = frame.state.clock.toFixed(3);
          stage.dataset.introduction = intro?.phase ?? "none";
          stage.dataset.reaction = frame.state.reaction ?? "none";
          stage.dataset.gesture = frame.state.gesture ?? frame.gesture;
          stage.dataset.letter = frame.letter;
          stage.dataset.delivery = frame.delivery?.phase ?? "none";
          stage.dataset.transitioning = String(frame.state.transitioning);
          for (const listener of listeners.current) listener(frame);
        },
      });
      if (disposed) { instance.destroy();return; }
      player.current = instance;if (import.meta.env.DEV && currentReview.current?.speed) instance.setSpeed(currentReview.current.speed);
      if (import.meta.env.DEV && currentReview.current?.paused) instance.pause();sync();resumeTracking();
    }).catch(() => { if (!disposed) setUnavailable(true); });
    return () => {
      disposed = true;synchronize.current = () => {};resize.disconnect();
      cancelAnimationFrame(frameRequest);motions.clear();window.removeEventListener("hint:room-motion", roomMotion);
      window.removeEventListener("resize", follow);window.removeEventListener("scroll", follow, true);
      window.visualViewport?.removeEventListener("resize", follow);window.visualViewport?.removeEventListener("scroll", follow);
      player.current?.destroy();player.current = null;selected.current = null;lastContext.current = "";
    };
  }, [enabled, requested]);
  useEffect(() => { synchronize.current(); }, [policy.reduced, policy.pageVisible]);
  useEffect(() => { if (import.meta.env.DEV && review?.speed) player.current?.setSpeed(review.speed); }, [review?.speed]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // Clear a consumed inspection stop only when its target changes. A pause
    // notification must not re-arm the same stop during the redraw it causes.
    if (previousHold.current !== review?.holdAt) {
      previousHold.current = review?.holdAt;reviewHeld.current = false;setHeldForReview(false);
    }
    if (review?.paused || reviewHeld.current) player.current?.pause();else player.current?.resume();
  }, [review?.holdAt, review?.paused]);

  return <PlaybackContext.Provider value={playback}><Context.Provider value={value}>{children}{enabled && requested && <div ref={overlay} className="hint-guide-overlay" data-testid="hint-guide-layer" aria-hidden="true">
    <span ref={shadow} className="hint-guide-shadow" aria-hidden="true" />
    <canvas ref={canvas} aria-hidden="true" />
    <svg ref={origin} className="hint-guide-origin" viewBox="0 0 220 220" fill="none" aria-hidden="true">
      <defs><linearGradient id="hint-guide-gold" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f6eccb" /><stop offset=".5" stopColor="#e6cb8e" /><stop offset="1" stopColor="#cba85f" /></linearGradient></defs>
      <rect x="42" y="34" width="64" height="152" rx="18" fill="url(#hint-guide-gold)" /><rect x="120" y="34" width="64" height="152" rx="18" fill="url(#hint-guide-gold)" />
      <path d="M110 77 Q116 104 143 110 Q116 116 110 143 Q104 116 77 110 Q104 104 110 77" fill="#fff5d9" />
    </svg>
    <div ref={actor} className="hint-guide-actor"><img ref={fallback} alt="" hidden /></div>
  </div>}</Context.Provider></PlaybackContext.Provider>;
}

export function HintGuideSlot({ context, delivery, priority = 50, className = "", fallback }: {
  context: HintSceneContext; delivery?: Delivery; priority?: number; className?: string; fallback?: ReactNode;
}) {
  const guide = useContext(Context), node = useRef<HTMLDivElement>(null), key = useRef(Symbol("hint-slot"));
  const contextRef = useRef(context);contextRef.current = context;
  const deliveryRef = useRef(delivery);deliveryRef.current = delivery;
  useLayoutEffect(() => {
    if (!guide?.enabled || !node.current) return;
    guide.mount(key.current, { node: node.current, context: contextRef.current, delivery: deliveryRef.current, priority });
    return () => guide.unmount(key.current);
  }, [guide, priority]);
  const contextKey = JSON.stringify(context);
  useLayoutEffect(() => { if (guide?.enabled) guide.update(key.current, contextRef.current, deliveryRef.current); }, [guide, contextKey, delivery?.key, delivery?.cardBack, delivery?.done, delivery?.target]);
  if (!guide?.enabled) return <>{fallback}</>;
  return <div ref={node} className={`hint-guide-slot ${className}`} data-hint-guide-slot>
    <button type="button" aria-label="Hint" className="hint-guide-hit" onClick={guide.react} />
  </div>;
}

export function useHintGuideEnabled() { return useContext(Context)?.enabled ?? false; }
export function useHintGuidePlayback() { return useContext(PlaybackContext); }
export function useHintGuideGesture() {
  const play = useContext(Context)?.playGesture, mounted = useRef(false);
  useLayoutEffect(() => { mounted.current = true;return () => { mounted.current = false; }; }, []);
  return useCallback((id: GestureId) => { if (mounted.current) play?.(id); }, [play]);
}
export function useHintGuideFrames(listener: (frame: HintSceneFrame) => void) {
  const guide = useContext(Context), latest = useRef(listener);latest.current = listener;
  useLayoutEffect(() => guide?.subscribe(frame => latest.current(frame)), [guide]);
}

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMotionPolicy } from "../../lib/motionPolicy";
import type { GestureId, HintSceneContext, HintSceneFrame, HintScenePlayer } from "../../../mascot-library/versions/v3.2/src/index";
import "./hint-guide.css";

type Slot = { node: HTMLDivElement; context: HintSceneContext; priority: number; order: number };
type GuideContext = {
  enabled: boolean;
  mount: (key: symbol, slot: Omit<Slot, "order">) => void;
  update: (key: symbol, context: HintSceneContext) => void;
  unmount: (key: symbol) => void;
  react: () => void;
  playGesture: (id: GestureId) => void;
  subscribe: (listener: (frame: HintSceneFrame) => void) => () => void;
};
const Context = createContext<GuideContext | null>(null);

export function hintGuideEnabled() {
  return import.meta.env.VITE_HINT_GUIDE_V32 === "1"
    || Boolean(import.meta.env.DEV && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("hintGuide") === "v3.2");
}

export function HintGuideProvider({ children, enabled: enabledOverride }: { children: ReactNode; enabled?: boolean }) {
  const [enabledAtStart] = useState(hintGuideEnabled);
  const [unavailable, setUnavailable] = useState(false);
  const enabled = (enabledOverride ?? enabledAtStart) && !unavailable;
  const policy = useMotionPolicy();
  const currentPolicy = useRef(policy);currentPolicy.current = policy;
  const slots = useRef(new Map<symbol, Slot>());
  const order = useRef(0), selected = useRef<symbol | null>(null), lastContext = useRef("");
  const overlay = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const actor = useRef<HTMLDivElement>(null), fallback = useRef<HTMLImageElement>(null), shadow = useRef<HTMLSpanElement>(null);
  const origin = useRef<SVGSVGElement>(null);
  const listeners = useRef(new Set<(frame: HintSceneFrame) => void>());
  const player = useRef<HintScenePlayer | null>(null);
  const synchronize = useRef<(followLayout?: boolean) => void>(() => {});
  const [requested, setRequested] = useState(false);

  const mount = useCallback((key: symbol, slot: Omit<Slot, "order">) => {
    slots.current.set(key, { ...slot, order: ++order.current });setRequested(true);synchronize.current();
  }, []);
  const update = useCallback((key: symbol, context: HintSceneContext) => {
    const slot = slots.current.get(key);if (!slot) return;
    slot.context = context;synchronize.current();
  }, []);
  const unmount = useCallback((key: symbol) => { slots.current.delete(key);synchronize.current(); }, []);
  const react = useCallback(() => { player.current?.react(); }, []);
  const playGesture = useCallback((id: GestureId) => { player.current?.playGesture(id); }, []);
  const subscribe = useCallback((listener: (frame: HintSceneFrame) => void) => {
    listeners.current.add(listener);return () => { listeners.current.delete(listener); };
  }, []);
  const value = useMemo(() => ({ enabled, mount, update, unmount, react, playGesture, subscribe }), [enabled, mount, update, unmount, react, playGesture, subscribe]);

  useEffect(() => {
    if (!enabled || !requested || !canvas.current || !overlay.current) return;
    let disposed = false;
    const stage = overlay.current, drawing = canvas.current;
    let activeNode: HTMLDivElement | null = null, previousWidth = 0;
    const resize = new ResizeObserver(() => synchronize.current(true));
    function sync(followLayout = false) {
      const viewport = window.visualViewport;
      const width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
      stage.style.width = `${width}px`;stage.style.height = `${height}px`;
      stage.style.left = `${viewport?.offsetLeft || 0}px`;stage.style.top = `${viewport?.offsetTop || 0}px`;
      const entry = [...slots.current.entries()].filter(([, slot]) => slot.node.isConnected)
        .sort((a, b) => b[1].priority - a[1].priority || b[1].order - a[1].order)[0];
      if (!player.current) return;
      if (!entry) {
        selected.current = null;lastContext.current = "";
        if (activeNode) resize.unobserve(activeNode);activeNode = null;
        player.current.setContext({ room: "away", phase: "idle", audioPlaying: false });
        player.current.setMotionPolicy({ reduced: currentPolicy.current.reduced, visible: currentPolicy.current.pageVisible });return;
      }
      const [key, slot] = entry, changed = selected.current !== key;
      if (activeNode !== slot.node) { if (activeNode) resize.unobserve(activeNode);activeNode = slot.node;resize.observe(activeNode); }
      const bounds = slot.node.getBoundingClientRect(), screen = stage.getBoundingClientRect();
      const contextKey = JSON.stringify(slot.context), contextChanged = lastContext.current !== contextKey;
      const visible = bounds.width > 0 && bounds.height > 0 && bounds.bottom > screen.top && bounds.top < screen.bottom && bounds.right > screen.left && bounds.left < screen.right;
      stage.style.zIndex = slot.priority >= 110 ? "110" : slot.priority >= 100 ? "100" : "20";
      player.current.setMotionPolicy({ reduced: currentPolicy.current.reduced, visible: currentPolicy.current.pageVisible && visible });
      if (changed || contextChanged) player.current.setContext(slot.context);
      const size = Math.min(bounds.width, bounds.height);
      player.current.setAnchor({ x: (bounds.left + bounds.width / 2 - screen.left) / width, y: (bounds.top + bounds.height / 2 - screen.top) / height, width: size / width },
        { followLayout: followLayout && !changed && !contextChanged && Math.abs(previousWidth - size) < 1 });
      previousWidth = size;selected.current = key;lastContext.current = contextKey;
    }
    synchronize.current = sync;
    const follow = () => sync(true);
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
          for (const listener of listeners.current) listener(frame);
        },
      });
      if (disposed) { instance.destroy();return; }
      player.current = instance;sync();
    }).catch(() => { if (!disposed) setUnavailable(true); });
    return () => {
      disposed = true;synchronize.current = () => {};resize.disconnect();
      window.removeEventListener("resize", follow);window.removeEventListener("scroll", follow, true);
      window.visualViewport?.removeEventListener("resize", follow);window.visualViewport?.removeEventListener("scroll", follow);
      player.current?.destroy();player.current = null;selected.current = null;lastContext.current = "";
    };
  }, [enabled, requested]);
  useEffect(() => { synchronize.current(); }, [policy.reduced, policy.pageVisible]);

  return <Context.Provider value={value}>{children}{enabled && requested && <div ref={overlay} className="hint-guide-overlay" data-testid="hint-guide-layer" aria-hidden="true">
    <span ref={shadow} className="hint-guide-shadow" aria-hidden="true" />
    <canvas ref={canvas} aria-hidden="true" />
    <svg ref={origin} className="hint-guide-origin" viewBox="0 0 220 220" fill="none" aria-hidden="true">
      <defs><linearGradient id="hint-guide-gold" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f6eccb" /><stop offset=".5" stopColor="#e6cb8e" /><stop offset="1" stopColor="#cba85f" /></linearGradient></defs>
      <rect x="42" y="34" width="64" height="152" rx="18" fill="url(#hint-guide-gold)" /><rect x="120" y="34" width="64" height="152" rx="18" fill="url(#hint-guide-gold)" />
      <path d="M110 77 Q116 104 143 110 Q116 116 110 143 Q104 116 77 110 Q104 104 110 77" fill="#fff5d9" />
    </svg>
    <div ref={actor} className="hint-guide-actor"><img ref={fallback} alt="" hidden /></div>
  </div>}</Context.Provider>;
}

export function HintGuideSlot({ context, priority = 50, className = "", fallback }: {
  context: HintSceneContext; priority?: number; className?: string; fallback?: ReactNode;
}) {
  const guide = useContext(Context), node = useRef<HTMLDivElement>(null), key = useRef(Symbol("hint-slot"));
  const contextRef = useRef(context);contextRef.current = context;
  useLayoutEffect(() => {
    if (!guide?.enabled || !node.current) return;
    guide.mount(key.current, { node: node.current, context: contextRef.current, priority });
    return () => guide.unmount(key.current);
  }, [guide, priority]);
  const contextKey = JSON.stringify(context);
  useLayoutEffect(() => { if (guide?.enabled) guide.update(key.current, contextRef.current); }, [guide, contextKey]);
  if (!guide?.enabled) return <>{fallback}</>;
  return <div ref={node} className={`hint-guide-slot ${className}`} data-hint-guide-slot>
    <button type="button" aria-label="Hint" className="hint-guide-hit" onClick={guide.react} />
  </div>;
}

export function useHintGuideEnabled() { return useContext(Context)?.enabled ?? false; }
export function useHintGuideGesture() { return useContext(Context)?.playGesture; }
export function useHintGuideFrames(listener: (frame: HintSceneFrame) => void) {
  const guide = useContext(Context), latest = useRef(listener);latest.current = listener;
  useLayoutEffect(() => guide?.subscribe(frame => latest.current(frame)), [guide]);
}

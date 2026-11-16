import { useEffect, useRef, type RefObject } from "react";
import { RECEIPT_LEADER_RATIO } from "./dailyReceiptArtwork";

type RollProps = {
  source: RefObject<HTMLElement | null>;
  height: number;
  duration: number;
  phase: "idle" | "warming" | "printing" | "complete";
  paused: boolean;
  reduced?: boolean;
  tapImpulse?: number;
  onReady: (status: "preview" | "ready" | "fallback") => void;
  onInvitationReady?: () => void;
  onComplete: () => void;
};
type PaperTexture = { paper: HTMLCanvasElement; footer: HTMLCanvasElement | null; complete?: HTMLCanvasElement };

/** Draw the real sheet's outline synchronously, before card images finish loading. */
function makePaperOutline(source: HTMLElement): HTMLCanvasElement {
  const svg = source.querySelector("svg");
  const outline = svg?.querySelector(":scope > path");
  if (!svg || !outline) throw new Error("Paper outline unavailable");
  const canvas = document.createElement("canvas");
  canvas.width = Number(svg.getAttribute("width"));
  canvas.height = Number(svg.getAttribute("height"));
  const context = canvas.getContext("2d");
  if (!context || !canvas.width || !canvas.height) throw new Error("Paper canvas unavailable");
  const path = new Path2D(outline.getAttribute("d") ?? "");
  context.fillStyle = outline.getAttribute("fill") ?? "#fffaf5";
  context.fill(path);
  context.strokeStyle = outline.getAttribute("stroke") ?? "#efbac7";
  context.lineWidth = Number(outline.getAttribute("stroke-width") ?? 2);
  context.stroke(path);
  return canvas;
}

function loadImage(src: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const finish = (error?: Error) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      image.onload = image.onerror = null;
      if (error) reject(error); else resolve(image);
    };
    const abort = () => finish(new DOMException("Paper cancelled", "AbortError"));
    const timer = setTimeout(() => finish(new Error("Paper image unavailable")), 3000);
    image.onload = () => finish();
    image.onerror = () => finish(new Error("Paper image unavailable"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { abort(); return; }
    image.src = src;
  });
}

/** Snapshot the actual vector ticket once, including its embedded card artwork. */
async function makeTexture(source: HTMLElement, signal: AbortSignal) {
  const svg = source.querySelector("svg")?.cloneNode(true) as SVGSVGElement | undefined;
  if (!svg) throw new Error("Paper artwork unavailable");
  await document.fonts?.ready;
  for (const node of svg.querySelectorAll("image")) {
    const image = await loadImage(node.getAttribute("href") ?? "", signal);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(image, 0, 0);
    node.setAttribute("href", canvas.toDataURL("image/png"));
  }
  // Keep the footer ink separate so the invitation can change into it without
  // replacing the paper, losing the edge, or repeating the footer further up.
  const footerGroup = svg.querySelector("[data-receipt-footer]");
  let footerSvg: SVGSVGElement | null = null;
  if (footerGroup) {
    footerSvg = svg.cloneNode(false) as SVGSVGElement;
    const wrapper = document.createElementNS("http://www.w3.org/2000/svg", "g");
    wrapper.setAttribute("transform", footerGroup.parentElement?.getAttribute("transform") ?? "");
    wrapper.append(footerGroup);
    footerSvg.append(wrapper);
  }
  const rasterize = async (vector: SVGSVGElement) => {
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(vector)], { type: "image/svg+xml" }));
    try {
      const image = await loadImage(url, signal);
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      // Rasterize once, instead of asking each curved strip to render SVG again.
      context.drawImage(image, 0, 0);
      return canvas;
    }
    finally { URL.revokeObjectURL(url); }
  };
  const [paper, footer] = await Promise.all([rasterize(svg), footerSvg ? rasterize(footerSvg) : null]);
  const complete = document.createElement("canvas");
  complete.width = paper.width;
  complete.height = paper.height;
  const context = complete.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.drawImage(paper, 0, 0);
  if (footer) context.drawImage(footer, 0, 0);
  return { paper, footer, complete };
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

/** Continuous feed, with only a short, smooth acceleration and deceleration. */
export function receiptFeedProgress(progress: number) {
  const t = clamp(progress);
  const ramp = .04;
  const start = (time: number) => {
    const u = time / ramp;
    return ramp * (u ** 3 - u ** 4 / 2) / (1 - ramp);
  };
  if (t < ramp) return start(t);
  if (t > 1 - ramp) return 1 - start(1 - t);
  return (t - ramp / 2) / (1 - ramp);
}

export const PAPER_SETTLE_MS = 500;
const FEED_RELEASE_MS = 600;
export const INVITATION_PRINT_MS = 820;
export const PAPER_FLUTTER_MS = 1600;

/** The impulse arrives later and bends further as it travels toward the free edge. */
export function receiptPaperFlutter(distance: number, length: number, elapsedMs: number | null) {
  if (elapsedMs === null || elapsedMs >= PAPER_FLUTTER_MS || length <= 12) return { x: 0, bend: 0 };
  const free = clamp((distance - 12) / (length - 12));
  const time = (elapsedMs - 55 - free * 65) / 1000;
  if (time <= 0 || free === 0) return { x: 0, bend: 0 };
  const envelope = smooth(time / .12) * Math.exp(-2.25 * time)
    * (1 - smooth((elapsedMs - 1100) / 500));
  const weight = free ** 1.8 * Math.min(1, length / 150);
  return {
    x: 10 * weight * envelope * Math.sin(time * Math.PI * 3.15),
    bend: .17 * weight * envelope * Math.sin(time * Math.PI * 3.7 - free * .5),
  };
}

/** One small release of the paper's weight just before the rollers stop. */
export function receiptFeedFlutter(distance: number, length: number, elapsedMs: number, duration: number) {
  const start = Math.max(0, duration - FEED_RELEASE_MS);
  if (length <= 12 || elapsedMs <= start || elapsedMs >= duration + PAPER_SETTLE_MS) return { x: 0, bend: 0 };
  const free = clamp((distance - 12) / (length - 12));
  const progress = clamp((elapsedMs - start) / (duration - start + PAPER_SETTLE_MS));
  const sway = Math.sin(progress * Math.PI * 2) * Math.sin(progress * Math.PI) * Math.exp(-progress * .65);
  const weight = free ** 2.3 * smooth(length / 180) * sway;
  return {
    x: 2.8 * weight,
    bend: .1 * weight,
  };
}

/** Arc-length coordinates: bending can shorten the projection, never stretch the sheet. */
export function receiptPaperProfile(length: number, tension: number, flutterMs: number | null = null, feed?: { elapsed: number; duration: number }) {
  const points = [{ distance: 0, x: 0, y: 0, depth: 0, tilt: 0, angle: .4 }];
  const weight = smooth(length / 75);
  // Roll memory relaxes as more paper leaves the slot. This is a shallow bend
  // toward the viewer, with no side-to-side movement during the main feed.
  const flex = feed ? smooth(feed.elapsed / 320) * smooth(length / 120)
    * (1 - smooth((feed.elapsed - feed.duration) / PAPER_SETTLE_MS)) : 0;
  const bow = .11 * flex * (.75 + .25 * Math.sin(length / 27));
  const curl = .1 * flex * Math.sin(length / 19 + .4);
  let y = 0;
  let depth = 0;
  for (let distance = 0; distance < length; distance += 1) {
    const step = Math.min(1, length - distance);
    const middle = distance + step / 2;
    const tip = smooth((middle - Math.max(0, length - 32)) / 32);
    const free = clamp((middle - 12) / Math.max(1, length - 12));
    // The two free corners relax at slightly different heights. Keep this
    // localized to the paper tail so the printed content above stays steady.
    const tail = smooth((middle - Math.max(12, length - 58)) / 46);
    const tilt = .026 * flex * tail ** 2 * Math.sin(length / 37 + .8);
    // The exit bend stays anchored to the lip. Roll memory curls only the free edge.
    const flutter = receiptPaperFlutter(distance + step, length, flutterMs);
    const feeding = feed ? receiptFeedFlutter(distance + step, length, feed.elapsed, feed.duration) : { x: 0, bend: 0 };
    const angle = Math.PI / 2 - 1.17 * Math.exp(-middle / 4.5)
      - (.76 - .1 * clamp(tension)) * weight * tip
      - bow * Math.sin(free * Math.PI) ** 2 - curl * free ** 3
      + flutter.bend + feeding.bend;
    const x = flutter.x + feeding.x;
    const dx = x - points[points.length - 1].x;
    const remaining = Math.sqrt(Math.max(0, step * step - dx * dx));
    y += Math.sin(angle) * remaining;
    depth += Math.cos(angle) * remaining;
    points.push({ distance: distance + step, x, y, depth, tilt, angle });
  }
  return points;
}

/** A flexible sheet pinned at the rollers; its free end can curl and settle. */
export function ReceiptPaperRoll({ source, height, duration, phase, paused, reduced = false, tapImpulse = 0, onReady, onInvitationReady, onComplete }: RollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const texture = useRef<PaperTexture | null>(null);
  const buffer = useRef<HTMLCanvasElement | null>(null);
  const paperWidth = useRef(0);
  const elapsed = useRef(0);
  const tension = useRef(0);
  const lastFrame = useRef<number | null>(null);
  const frame = useRef(0);
  const done = useRef(false);
  const introElapsed = useRef(0);
  const introDone = useRef(false);
  const flutterElapsed = useRef<number | null>(null);
  const lastImpulse = useRef(tapImpulse);
  const current = useRef({ height, duration, phase, paused, onReady, onInvitationReady, onComplete });
  current.current = { height, duration, phase, paused, onReady, onInvitationReady, onComplete };
  const paintRef = useRef<() => void>(() => {});

  paintRef.current = () => {
    const canvas = canvasRef.current;
    const { height: fullHeight, duration: feedDuration, phase: state } = current.current;
    const isComplete = state === "complete";
    const footerOpacity = isComplete ? 1 : state === "printing" ? smooth((elapsed.current - 220) / 460) : 0;
    const merged = footerOpacity === 1 ? texture.current?.complete : undefined;
    const image = merged ?? texture.current?.paper;
    const footerImage = merged ? null : texture.current?.footer;
    if (!canvas || !image) return;
    const imageWidth = image.width;
    const imageHeight = image.height;
    // Machine tilt changes screen bounds, not the physical width of its paper roll.
    const width = paperWidth.current;
    if (!width || !fullHeight) return;
    const gutter = 20;
    const outputWidth = width + gutter * 2;
    const outputHeight = fullHeight + 28;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const backing = buffer.current ?? (buffer.current = document.createElement("canvas"));
    if (canvas.width !== Math.round(outputWidth * ratio) || canvas.height !== Math.round(outputHeight * ratio)) {
      canvas.width = backing.width = Math.round(outputWidth * ratio);
      canvas.height = backing.height = Math.round(outputHeight * ratio);
      canvas.style.width = `${outputWidth}px`;
      canvas.style.height = `${outputHeight}px`;
    }
    const ctx = canvas.getContext("2d");
    const paper = backing.getContext("2d");
    if (!ctx || !paper) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    paper.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, outputWidth, outputHeight);
    paper.clearRect(0, 0, outputWidth, outputHeight);
    const progress = isComplete ? 1 : state === "printing" ? receiptFeedProgress(elapsed.current / feedDuration) : 0;
    const leader = Math.min(width * RECEIPT_LEADER_RATIO, fullHeight);
    const introProgress = state === "idle" ? smooth(introElapsed.current / INVITATION_PRINT_MS) : 1;
    const length = state === "idle" ? leader * introProgress : leader + progress * (fullHeight - leader);
    const feedMotion = state === "printing" && !reduced
      ? { elapsed: elapsed.current, duration: feedDuration } : undefined;
    const profile = receiptPaperProfile(length, isComplete ? 0 : tension.current, flutterElapsed.current, feedMotion);
    paper.imageSmoothingEnabled = true;
    paper.imageSmoothingQuality = "high";
    let currentTilt = 0;
    for (let index = 1; index < profile.length; index++) {
      const start = profile[index - 1];
      // The straight middle needs one draw; reserve fine strips for the two bends.
      if (flutterElapsed.current !== null || feedMotion) {
        // Fine strips at the curled edges, wider strips through the shallow bow.
        const edge = start.distance < 24 || start.distance >= length - 36;
        index = Math.min(index + (edge ? 1 : 7), profile.length - 1);
      } else if (start.distance >= 28 && start.distance < length - 36) {
        index = Math.max(index, Math.floor(length - 36));
      }
      const end = profile[index];
      const step = end.distance - start.distance;
      const sourceY = (fullHeight - length + start.distance) / fullHeight * imageHeight;
      const sourceHeight = Math.min((step + .2) / fullHeight * imageHeight, imageHeight - sourceY);
      // A curved sheet has a little depth. Keep its center pinned and let its
      // width and lighting respond subtly to that depth, not to mouse position.
      const projectedWidth = width * (1 + Math.max(-.01, Math.min(.024, start.depth / 1400)));
      const left = gutter + start.x + (width - projectedWidth) / 2;
      const tilt = (start.tilt + end.tilt) / 2;
      if (tilt !== currentTilt) {
        paper.setTransform(ratio, ratio * tilt, 0, ratio, 0, -ratio * tilt * (gutter + start.x + width / 2));
        currentTilt = tilt;
      }
      paper.drawImage(image, 0, Math.max(0, sourceY), imageWidth, sourceHeight,
        left, start.y, projectedWidth, end.y - start.y + .2);
      if (footerImage && footerOpacity > 0) {
        paper.globalAlpha = footerOpacity;
        paper.drawImage(footerImage, 0, Math.max(0, sourceY), imageWidth, sourceHeight,
          left, start.y, projectedWidth, end.y - start.y + .2);
        paper.globalAlpha = 1;
      }
    }
    if (currentTilt !== 0) paper.setTransform(ratio, 0, 0, ratio, 0, 0);
    paper.globalCompositeOperation = "source-atop";
    // The automatic feed keeps the leader blank; no tap instruction is painted.
    // Light rolls across the same curved sheet.
    const tipY = profile[profile.length - 1].y;
    const shapeLight = paper.createLinearGradient(0, 0, 0, Math.max(1, tipY));
    for (let stop = 0; stop <= 12; stop++) {
      const point = profile[Math.round((profile.length - 1) * stop / 12)];
      const shade = point.distance > 20 ? Math.max(0, Math.cos(point.angle)) * .07 : 0;
      shapeLight.addColorStop(clamp(point.y / Math.max(1, tipY)), `rgba(90,59,58,${shade})`);
    }
    paper.fillStyle = shapeLight;
    paper.fillRect(0, 0, outputWidth, tipY + 1);
    const across = paper.createLinearGradient(gutter, 0, gutter + width, 0);
    across.addColorStop(0, "rgba(107,65,53,.06)");
    across.addColorStop(.025, "rgba(255,255,245,.06)");
    across.addColorStop(.5, "rgba(255,255,255,0)");
    across.addColorStop(.98, "rgba(84,43,36,0)");
    across.addColorStop(1, "rgba(85,44,33,.06)");
    paper.fillStyle = across;
    paper.fillRect(0, 0, outputWidth, outputHeight);
    // Contact darkness under the lip fades over the paper as it bends into the light.
    const bend = paper.createLinearGradient(0, 0, 0, 24);
    bend.addColorStop(0, "rgba(53,27,31,.58)");
    bend.addColorStop(.15, "rgba(67,36,39,.36)");
    bend.addColorStop(.4, "rgba(84,48,47,.16)");
    bend.addColorStop(.72, "rgba(102,65,56,.035)");
    bend.addColorStop(1, "rgba(102,65,56,0)");
    paper.fillStyle = bend;
    paper.fillRect(0, 0, outputWidth, 24);
    if (length > 40) {
      const tip = profile[profile.length - 1].y;
      const edge = paper.createLinearGradient(0, tip - 24, 0, tip + 1);
      edge.addColorStop(0, "rgba(255,255,255,0)");
      edge.addColorStop(.7, "rgba(255,255,251,.18)");
      edge.addColorStop(.94, "rgba(255,255,251,.22)");
      edge.addColorStop(1, "rgba(111,65,47,.12)");
      paper.fillStyle = edge;
      paper.fillRect(0, tip - 24, outputWidth, 26);
    }
    paper.globalCompositeOperation = "source-over";
    ctx.save();
    ctx.shadowColor = "rgba(24,12,23,.2)";
    const lift = Math.max(0, Math.min(2, profile[profile.length - 1].depth * .08));
    ctx.shadowBlur = (5 + lift) * ratio;
    ctx.shadowOffsetX = (1.5 + profile[profile.length - 1].x * .16) * ratio;
    ctx.shadowOffsetY = (3 + lift) * ratio;
    const cornerHeight = Math.abs(profile[profile.length - 1].tilt) * width * .52;
    const visibleHeight = Math.min(outputHeight, tipY + cornerHeight + 2);
    ctx.drawImage(backing, 0, 0, backing.width, visibleHeight * ratio, 0, 0, outputWidth, visibleHeight);
    ctx.restore();
  };

  // The source is a later sibling: its ref is attached only after this child's
  // layout effects, so initialize after the entire tree has been committed.
  useEffect(() => {
    const controller = new AbortController();
    if (!source.current) return;
    try {
      texture.current = { paper: makePaperOutline(source.current), footer: null };
      paintRef.current();
      current.current.onReady("preview");
    } catch { /* The rasterized SVG below also works without Path2D support. */ }
    void makeTexture(source.current, controller.signal).then(image => {
      if (controller.signal.aborted) return;
      texture.current = image;
      paintRef.current();
      current.current.onReady("ready");
    }).catch(() => { if (!controller.signal.aborted) current.current.onReady("fallback"); });
    return () => { controller.abort(); texture.current = null; };
  }, [source]);

  useEffect(() => {
    if (!source.current) return;
    const width = parseFloat(getComputedStyle(source.current).width);
    if (width > 0) paperWidth.current = width;
    const resize = new ResizeObserver(entries => {
      if (entries[0]?.contentRect.width > 0) paperWidth.current = entries[0].contentRect.width;
      paintRef.current();
    });
    resize.observe(source.current);
    paintRef.current();
    return () => resize.disconnect();
  }, [source, height]);

  useEffect(() => {
    lastFrame.current = null;
    if ((reduced || phase !== "idle") && !introDone.current) {
      introElapsed.current = INVITATION_PRINT_MS;
      introDone.current = true;
      current.current.onInvitationReady?.();
    }
    if (phase === "idle" || phase === "warming") { elapsed.current = 0; tension.current = 0; done.current = false; }
    if (paused || reduced) flutterElapsed.current = null;
    else if (tapImpulse !== lastImpulse.current) flutterElapsed.current = 0;
    lastImpulse.current = tapImpulse;
    paintRef.current();
    if (paused || (phase !== "printing" && introDone.current && flutterElapsed.current === null)) return;
    const tick = (now: number) => {
      // Visibility pauses reset the clock; an occasional dropped frame must not slow the motor.
      const delta = lastFrame.current === null ? 0 : Math.max(0, now - lastFrame.current);
      if (phase === "idle" && !introDone.current) {
        introElapsed.current = Math.min(INVITATION_PRINT_MS, introElapsed.current + delta);
        if (introElapsed.current >= INVITATION_PRINT_MS) {
          introDone.current = true;
          current.current.onInvitationReady?.();
        }
      }
      if (phase === "printing") {
        const previous = receiptFeedProgress(elapsed.current / current.current.duration);
        elapsed.current += delta;
        const moving = receiptFeedProgress(elapsed.current / current.current.duration) > previous;
        tension.current += ((moving ? 1 : 0) - tension.current) * (1 - Math.exp(-delta / 60));
      }
      if (flutterElapsed.current !== null) {
        flutterElapsed.current += delta;
        if (flutterElapsed.current >= PAPER_FLUTTER_MS) flutterElapsed.current = null;
      }
      lastFrame.current = now;
      paintRef.current();
      if (phase === "printing" && elapsed.current >= current.current.duration + PAPER_SETTLE_MS) {
        if (!done.current) { done.current = true; current.current.onComplete(); }
      }
      if (!introDone.current || (phase === "printing" && !done.current) || flutterElapsed.current !== null) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [phase, paused, reduced, tapImpulse]);

  return <canvas ref={canvasRef} className="receipt-printer__physical-paper" aria-hidden="true" />;
}

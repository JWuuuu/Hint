import { useEffect, useMemo, useRef } from "react";
import { useMotionPolicy } from "@/lib/motionPolicy";
import { createConstellationRenderer, paintConstellationBackground } from "./constellationBackground";
import "./constellation-backdrop.css";

const CONSTELLATION_SETTINGS = { strength: .65, motion: .55, glow: .95 };

export function ConstellationBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elapsedRef = useRef(0);
  const renderer = useMemo(createConstellationRenderer, []);
  const { reduced, pageVisible } = useMotionPolicy();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const themeRoot = canvas.closest<HTMLElement>("[data-hint-theme]") ?? document.documentElement;
    let frame = 0;
    let lastTime = 0;
    let lastPaint = 0;

    const draw = () => {
      // Use layout dimensions so the device preview's scale does not alter the artwork.
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const theme = themeRoot.dataset.hintTheme === "dark" ? "dark" : "bright";
      paintConstellationBackground(context, width, height, theme);
      renderer.draw(context, width, height, elapsedRef.current, CONSTELLATION_SETTINGS);
      canvas.dataset.backgroundTheme = theme;
    };

    const animate = (now: number) => {
      if (lastTime) elapsedRef.current += Math.min((now - lastTime) / 1000, .1);
      lastTime = now;
      if (!lastPaint || now - lastPaint >= 1000 / 30) {
        lastPaint = now;
        draw();
      }
      frame = window.requestAnimationFrame(animate);
    };

    const resize = new ResizeObserver(draw);
    resize.observe(canvas);
    const themeChange = new MutationObserver(draw);
    themeChange.observe(themeRoot, { attributes: true, attributeFilter: ["data-hint-theme"] });
    draw();
    if (!reduced && pageVisible) frame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frame);
      resize.disconnect();
      themeChange.disconnect();
    };
  }, [renderer, reduced, pageVisible]);

  return (
    <div className="hint-app-background" aria-hidden>
      <canvas ref={canvasRef} data-motion={reduced || !pageVisible ? "paused" : "playing"} />
    </div>
  );
}

import { test, expect } from "./fixtures";

test("receipt stage profile locates stalls across repeated exports", async ({ page }, info) => {
  test.skip(info.project.name !== "iphone-17-pro-max", "Sequential primary-device browser profile; native performance is separate.");
  test.setTimeout(150_000);
  await page.clock.setFixedTime(new Date("2026-09-29T12:00:00Z"));
  await page.addInitScript(() => {
    localStorage.setItem("hint_anon_id", "receipt-profile-fictional");
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint-language", "en");
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: false, soundAndHaptics: false }));
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/app?hintPreview=embedded");
  await page.getByTestId("home-reveal-action").click();
  await expect(page.getByTestId("home-daily-reveal")).toBeVisible();
  await page.keyboard.press("Escape");
  const profiles = [];
  const repetitions = Number(process.env.HINT_RECEIPT_PROFILE_RUNS ?? 10);
  for (let run = 0; run < repetitions; run++) {
    await page.evaluate(() => {
      type Span = { stage: string; start: number; duration: number; canvas?: HTMLCanvasElement };
      const probe = { frames: [] as { at: number; gap: number }[], spans: [] as Span[], raf: 0, restore: [] as (() => void)[], start: performance.now(), feedback: 0 };
      Object.assign(window, { receiptProbe: probe });
      let previous = performance.now();
      const tick = (now: number) => { probe.frames.push({ at: now, gap: now - previous }); previous = now; probe.raf = requestAnimationFrame(tick); };
      probe.raf = requestAnimationFrame(tick);
      for (const name of ["measureText", "drawImage", "fillText", "fillRect"] as const) {
        const proto = CanvasRenderingContext2D.prototype as unknown as Record<string, (...args: any[]) => any>;
        const original = proto[name];
        proto[name] = function(this: CanvasRenderingContext2D, ...args: any[]) {
          const start = performance.now();
          try { return original.apply(this, args); }
          finally { probe.spans.push({ stage: name, start, duration: performance.now() - start, canvas: this.canvas }); }
        };
        probe.restore.push(() => { proto[name] = original; });
      }
      const original = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
        const start = performance.now(), canvas = this;
        original.call(this, blob => { probe.spans.push({ stage: "png-total", start, duration: performance.now() - start, canvas }); callback(blob); }, type, quality);
        probe.spans.push({ stage: "png-call", start, duration: performance.now() - start, canvas });
      };
      probe.restore.push(() => { HTMLCanvasElement.prototype.toBlob = original; });
      const originalBitmap = window.createImageBitmap;
      window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) => {
        const start = performance.now();
        const result = (originalBitmap as (...values: any[]) => Promise<ImageBitmap>)(...args);
        probe.spans.push({ stage: "bitmap-call", start, duration: performance.now() - start });
        void result.then(() => probe.spans.push({ stage: "bitmap-total", start, duration: performance.now() - start }));
        return result;
      }) as typeof createImageBitmap;
      probe.restore.push(() => { window.createImageBitmap = originalBitmap; });
      const OriginalWorker = window.Worker;
      window.Worker = class extends OriginalWorker {
        postMessage(message: any, transfer: Transferable[]) {
          const start = performance.now();
          this.addEventListener("message", () => probe.spans.push({ stage: "png-total", start, duration: performance.now() - start }), { once: true });
          super.postMessage(message, transfer);
          probe.spans.push({ stage: "png-call", start, duration: performance.now() - start });
        }
      } as typeof Worker;
      probe.restore.push(() => { window.Worker = OriginalWorker; });
      void document.fonts.ready.then(() => probe.spans.push({ stage: "fonts-ready", start: performance.now(), duration: 0 }));
      const observer = new MutationObserver(records => {
        if (!probe.feedback && document.querySelector(".receipt-share-dialog")) requestAnimationFrame(() => { if (!probe.feedback) probe.feedback = performance.now() - probe.start; });
        for (const record of records) if (record.target instanceof Element && record.target.matches(".receipt-printer")) {
          probe.spans.push({ stage: `print-${record.target.getAttribute("data-phase")}`, start: performance.now(), duration: 0 });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-phase"] });
      probe.restore.push(() => observer.disconnect());
      document.querySelector(".receipt-share-trigger")!.addEventListener("click", () => { probe.start = performance.now(); }, { once: true });
    });
    await page.getByRole("button", { name: "Share receipt", exact: true }).click();
    const dialog = page.getByTestId("receipt-share-dialog");
    await expect(dialog.getByRole("button", { name: "Share receipt", exact: true })).toBeEnabled();
    profiles.push(await page.evaluate(() => {
      const probe = (window as any).receiptProbe;
      cancelAnimationFrame(probe.raf);
      probe.restore.forEach((restore: () => void) => restore());
      const spans = probe.spans.filter((span: any) => !span.canvas || span.canvas.width === 1800).map(({ canvas, ...span }: any) => span);
      const gaps = probe.frames.slice(1).map((frame: any) => frame.gap).sort((a: number, b: number) => a - b);
      return { clickToFrameMs: probe.feedback, p95: gaps[Math.floor(gaps.length * .95)], max: gaps.at(-1), samples: gaps.length,
        stalls: probe.frames.filter((frame: any) => frame.gap >= 100).map((frame: any) => ({ ...frame, overlapping: spans.filter((span: any) => span.start + span.duration >= frame.at - frame.gap && span.start <= frame.at) })),
        stageTotals: Object.fromEntries([...new Set(spans.map((span: any) => span.stage))].map(stage => [stage, spans.filter((span: any) => span.stage === stage).reduce((sum: number, span: any) => sum + span.duration, 0)])),
      };
    }));
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => document.getAnimations().filter(animation => (animation.effect as KeyframeEffect | null)?.target instanceof Element && ((animation.effect as KeyframeEffect).target as Element).closest(".receipt-printer")).length)).toBe(0);
  }
  await info.attach("receipt-stage-profile", { body: JSON.stringify({ browserOnly: true, physicalIphoneVerified: false, profiles }, null, 2), contentType: "application/json" });
  expect(profiles).toHaveLength(repetitions);
  for (const profile of profiles) { expect(profile.samples).toBeGreaterThan(50); expect(profile.stageTotals["png-total"]).toBeGreaterThan(0); }
});

import { expect, test, type Page, type TestInfo } from "./fixtures";
import { writeFile } from "node:fs/promises";

type Metrics = { samples: number; p50: number; p95: number; max: number; over100: number; longestStallRun: number };
async function sample(page: Page, info: TestInfo, label: string, action: () => Promise<unknown>, baseline?: Metrics): Promise<Metrics> {
  await page.evaluate(() => {
    const state = window as unknown as { motionFrames: number[]; motionFrame: number; motionStart: number };
    state.motionFrames = []; state.motionStart = performance.now();
    let previous = state.motionStart;
    const tick = (time: number) => { state.motionFrames.push(time - previous); previous = time; state.motionFrame = requestAnimationFrame(tick); };
    state.motionFrame = requestAnimationFrame(tick);
  });
  await Promise.all([action(), page.evaluate(() => new Promise<void>(resolve => {
    const start = performance.now();
    const tick = (time: number) => time - start >= 1600 ? resolve() : requestAnimationFrame(tick);
    requestAnimationFrame(tick);
  }))]);
  const metrics = await page.evaluate(() => {
    const state = window as unknown as { motionFrames: number[]; motionFrame: number };
    cancelAnimationFrame(state.motionFrame);
    const frames = state.motionFrames.slice(1);
    const sorted = [...frames].sort((a, b) => a - b);
    let run = 0; let longestStallRun = 0;
    for (const gap of frames) { run = gap >= 100 ? run + 1 : 0; longestStallRun = Math.max(longestStallRun, run); }
    return { samples: frames.length, p50: sorted[Math.floor(sorted.length * 0.5)] ?? Infinity, p95: sorted[Math.floor(sorted.length * 0.95)] ?? Infinity,
      max: sorted.at(-1) ?? Infinity, over100: frames.filter(gap => gap >= 100).length, longestStallRun };
  });
  const path = info.outputPath(`${label}-web-frames.json`);
  await writeFile(path, JSON.stringify({ browserOnly: true, device: info.project.name, metrics, idleBaseline: baseline ?? null }, null, 2));
  await info.attach(`${label}-web-frame-samples`, { path, contentType: "application/json" });
  expect(metrics.samples).toBeGreaterThan(30);
  // Host-relative regression gates, not a claim about physical iPhone frame rate.
  expect(metrics.p95).toBeLessThan(Math.max(90, (baseline?.p95 ?? 0) * 3));
  expect(metrics.longestStallRun).toBeLessThan(2);
  expect(metrics.over100).toBeLessThanOrEqual(2);
  return metrics;
}

for (const [app, os] of [[false, false], [true, false], [false, true], [true, true]]) {
  test(`web frame regression app=${app} OS=${os}: Home, scroll, modal, Animal and Tarot`, async ({ page }, info) => {
    test.setTimeout(90000);
    await page.addInitScript(app => {
      localStorage.setItem("hint_onboarding_complete_v3", "1"); localStorage.setItem("hint_launch_seen_v2", "1");
      localStorage.setItem("hint-language", "en");
      localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: app, soundAndHaptics: false }));
    }, app);
    await page.emulateMedia({ reducedMotion: os ? "reduce" : "no-preference" });
    await page.route("**/api/tarot/spread-recommendation", route => route.fulfill({ json: { spreadType: "three", reason: "Three clear positions.", focusLabel: "Clear signal", confidence: "high", source: "api" } }));
    await page.goto("/app?hintPreview=embedded");
    await expect(page.getByRole("button", { name: "Reveal today's Hint card" })).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    const baseline = await sample(page, info, "home-idle", async () => {});
    await sample(page, info, "home-scroll", () => page.locator(".reference-home-crisp").evaluate(element => new Promise<void>(resolve => {
      let frame = 0;
      const scroll = () => { frame++; element.scrollTop = (element.scrollHeight - element.clientHeight) * Math.sin(Math.PI * frame / 60) ** 2; if (frame < 60) requestAnimationFrame(scroll); else resolve(); };
      requestAnimationFrame(scroll);
    })), baseline);
    await sample(page, info, "home-reveal", async () => {
      await page.getByRole("button", { name: "Reveal today's Hint card" }).click();
      await expect(page.getByRole("link", { name: "Read interpretation" })).toBeVisible();
    }, baseline);
    await page.keyboard.press("Escape");
    await page.goto("/app/animal-tarot?hintPreview=embedded");
    await expect(page.getByRole("button", { name: "Draw animal card" })).toBeEnabled();
    await sample(page, info, "animal-reveal", async () => {
      await page.getByRole("button", { name: "Draw animal card" }).click();
      await expect(page.getByRole("button", { name: "Save to Collection" })).toBeVisible();
    }, baseline);
    await page.goto("/app/tarot?hintPreview=embedded");
    await page.getByPlaceholder("Type your question...").fill("What is opening now?");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: /Use this spread/i }).click();
    await page.getByRole("button", { name: /^Customize/i }).click();
    await page.getByTestId("tarot-room-background-sea").click();
    await page.getByRole("button", { name: /Begin the ritual/i }).click();
    await expect(page.getByRole("button", { name: "Auto Wash" })).toBeVisible();
    await sample(page, info, "tarot-auto-wash", async () => {
      await page.getByRole("button", { name: "Auto Wash" }).click();
      await expect(page.getByRole("heading", { name: "Pick Cards" })).toBeVisible();
    }, baseline);
  });
}

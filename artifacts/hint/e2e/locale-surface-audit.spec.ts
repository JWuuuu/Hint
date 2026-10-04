import { test, expect } from "./fixtures";
import { writeFile } from "node:fs/promises";

const routes = ["/app", "/app/daily", "/app/astrology", "/app/animal-tarot", "/app/collection", "/app/personalities", "/app/ask", "/app/readings", "/app/profile", "/app/rooms", "/app/journal", "/app/dream", "/app/compatibility", "/app/login", "/about", "/privacy", "/terms", "/disclaimer", "/contact"];

type Navigation = { from: string; to: string; startedAt: number };
type RuntimeError = { kind: "error" | "unhandledrejection"; message: string; stack?: string; url: string };

export function isWebKitNavigationDiagnostic(error: Error, browserName: string, navigation: Navigation | null) {
  if (browserName !== "webkit" || !navigation || error.name !== "Fetch API cannot load http") return false;
  const firstLine = error.stack?.split("\n")[0];
  const match = firstLine?.match(/^Fetch API cannot load (http:\/\/127\.0\.0\.1:\d+\/api\/(?:readings|reading-days)(?:\?[^\s]*)?) due to access control checks\.$/);
  if (!match || error.message !== `${match[1].slice("http:/".length)} due to access control checks.`) return false;
  const request = new URL(match[1]);
  const departingPage = new URL(navigation.from);
  const expectedPage = request.pathname === "/api/readings" ? "/app/readings" : "/app/daily";
  return request.origin === departingPage.origin && departingPage.pathname.endsWith(expectedPage);
}

for (const language of ["zh", "es", "ja", "ko"]) for (const theme of ["bright", "dark"]) {
  test(`${language} ${theme}: main screens, forms and unavailable states remain reachable`, async ({ page, browserName }, info) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    const runtimeErrors: RuntimeError[] = [];
    const navigationDiagnostics: unknown[] = [];
    let navigation: Navigation | null = null;
    await page.exposeBinding("__hintSurfaceRuntimeError", (_source, error: RuntimeError) => runtimeErrors.push(error));
    await page.addInitScript(() => {
      const report = (error: RuntimeError) => {
        const auditWindow = window as typeof window & { __hintSurfaceRuntimeError: (error: RuntimeError) => Promise<unknown> };
        // This observer never prevents or handles the application's error event.
        void auditWindow.__hintSurfaceRuntimeError(error).catch(() => {});
      };
      addEventListener("error", event => report({ kind: "error", message: event.message, stack: event.error?.stack, url: location.href }));
      addEventListener("unhandledrejection", event => report({ kind: "unhandledrejection", message: String(event.reason?.message ?? event.reason), stack: event.reason?.stack, url: location.href }));
    });
    await page.addInitScript(({ language, theme }) => {
      localStorage.setItem("hint_onboarding_complete_v3", "1");
      localStorage.setItem("hint-language", language); localStorage.setItem("hint-theme", theme);
      localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
    }, { language, theme });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/**", route => {
      if (new URL(route.request().url()).pathname === "/api/profile") return route.fulfill({ json: null });
      return route.fulfill({ status: 503, json: { code: "FIXTURE_OFFLINE", error: "Isolated unavailable service" } });
    });
    page.on("pageerror", error => {
      // WebKit promotes a handled fetch's native pagehide diagnostic to pageerror.
      // Only the two reproduced local fixture endpoints during this exact goto are
      // classified separately. True window errors/rejections above still fail.
      if (isWebKitNavigationDiagnostic(error, browserName, navigation)) {
        navigationDiagnostics.push({ name: error.name, message: error.message, stack: error.stack, navigation, elapsedMs: performance.now() - navigation!.startedAt });
      } else {
        errors.push(error.message);
      }
    });
    const report: unknown[] = [];
    try {
      for (const route of routes) {
        navigation = { from: page.url(), to: `${route}?hintPreview=embedded`, startedAt: performance.now() };
        try {
          await page.goto(navigation.to);
        } finally {
          navigation = null;
        }
        await expect(page.locator("h1,h2").first()).toBeVisible();
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all(document.getAnimations().filter(animation => Number.isFinite(Number(animation.effect?.getTiming().iterations))).map(animation => animation.finished.catch(() => {})));
        });
        const frames: unknown[] = [];
        for (const [position, ratio] of [["top", 0], ["middle", 0.5], ["bottom", 1]] as const) {
          await page.evaluate(async ratio => {
            for (const element of document.querySelectorAll<HTMLElement>(".hint-app-scroll, main, .overflow-y-auto")) {
              if (element.scrollHeight > element.clientHeight) element.scrollTop = (element.scrollHeight - element.clientHeight) * ratio;
            }
            await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
          }, ratio);
          const frame = await page.evaluate(() => {
            const visible = (element: Element) => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight && getComputedStyle(element).visibility !== "hidden"; };
            return {
              headings: [...document.querySelectorAll("h1,h2")].filter(visible).map(element => element.textContent),
              overflow: [...document.querySelectorAll(".hint-app-scroll, main")].filter(visible).filter(element => element.scrollWidth > element.clientWidth + 2).map(element => ({ className: element.className, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth })),
              // Reviewed with screenshots: summaries may intentionally be clipped and have a detail entry.
              clippedSummaries: [...document.querySelectorAll("h1,h2,h3,p,button,label")].filter(visible).filter(element => ["hidden", "clip"].includes(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 3).map(element => element.textContent),
              controls: [...document.querySelectorAll("button,input,textarea,select")].filter(visible).map(element => { const box = element.getBoundingClientRect(); return { label: element.getAttribute("aria-label") ?? element.textContent, width: box.width, height: box.height }; }),
            };
          });
          expect.soft(frame.overflow, `${route} ${position}`).toEqual([]);
          frames.push({ position, ...frame });
          await page.screenshot({ path: info.outputPath(`${route.replaceAll("/", "-")}-${position}.png`) });
        }
        report.push({ route, frames });
      }
    } finally {
      await writeFile(info.outputPath("surface-audit.json"), JSON.stringify({ language, theme, report, errors, runtimeErrors, navigationDiagnostics }, null, 2));
    }
    expect(errors).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  });
}

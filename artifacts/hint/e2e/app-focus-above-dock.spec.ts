import { test, expect, type Page } from "./fixtures";

async function prepare(page: Page, route: string, scale = 100) {
  await page.addInitScript(() => {
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_anon_id", "focus-fictional-reader");
    localStorage.setItem("hint-language", "en");
    localStorage.setItem("hint-theme", "bright");
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
  });
  await page.route("**/api/profile", route => route.fulfill({ status: 404, json: { error: "PROFILE_NOT_FOUND" } }));
  await page.route("**/api/journal", route => route.fulfill({ json: [] }));
  await page.goto(`${route}?hintPreview=embedded`);
  if (route === "/app/profile") await page.getByTestId("button-edit-profile").click();
  await expect(page.locator(".hint-app-scroll input").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  if (scale === 200) await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>("h1,h2,h3,p,button,a,span,small,label,strong,input,textarea")]
      .filter(n => !n.closest('[aria-hidden="true"],.sr-only') && n.getBoundingClientRect().height > 0)
      .map(n => [n, parseFloat(getComputedStyle(n).fontSize)] as const);
    for (const [node, size] of nodes) node.style.fontSize = `${size * 2}px`;
  });
}

async function settleFocus(page: Page) {
  await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
}

async function focusPosition(page: Page) {
  await settleFocus(page);
  return page.evaluate(() => {
    const target = document.activeElement;
    if (!target?.closest(".hint-app-scroll")) return null;
    const box = target.getBoundingClientRect();
    const dock = document.querySelector("[data-app-tabbar]")!.getBoundingClientRect();
    return { name: target.getAttribute("placeholder") || target.textContent?.trim().slice(0, 30) || target.tagName, top: box.top, under: box.bottom - dock.top };
  });
}

for (const route of ["/app/compatibility", "/app/journal", "/app/profile"]) {
  for (const scale of [100, 200]) {
    test(`form focus stays above the dock in both directions: ${route}, ${scale}% text`, async ({ page }) => {
      await prepare(page, route, scale);
      let reached = 0;
      for (const key of ["Tab", "Shift+Tab"]) {
        let inPage = false;
        for (let i = 0; i < 40; i++) {
          await page.keyboard.press(key);
          const stop = await focusPosition(page);
          if (!stop) { if (inPage) break; continue; }
          inPage = true;
          reached++;
          expect(stop.top, `${key}: ${stop.name} above viewport`).toBeGreaterThanOrEqual(0);
          expect(stop.under, `${key}: ${stop.name} under dock`).toBeLessThanOrEqual(1);
        }
      }
      expect(reached).toBeGreaterThan(0);
      // WebKit's Windows Tab cycle omits links; use native focus to cover them too.
      const controls = page.locator(".hint-app-scroll button:not([disabled]),.hint-app-scroll a[href],.hint-app-scroll input:not([disabled]),.hint-app-scroll textarea:not([disabled]),.hint-app-scroll select:not([disabled])");
      for (const control of await controls.all()) {
        if (!await control.isVisible()) continue;
        await control.focus();
        const stop = (await focusPosition(page))!;
        expect(stop.top, `${stop.name} above viewport`).toBeGreaterThanOrEqual(0);
        expect(stop.under, `${stop.name} under dock`).toBeLessThanOrEqual(1);
      }
    });
  }
}

test("rapid focus changes keep the latest field visible and do not scroll later", async ({ page }) => {
  await prepare(page, "/app/compatibility", 200);
  await page.evaluate(() => {
    const inputs = [...document.querySelectorAll<HTMLInputElement>(".hint-app-scroll input")];
    inputs.at(-1)!.focus(); inputs[0]!.focus(); inputs.at(-1)!.focus();
  });
  const stop = (await focusPosition(page))!;
  expect(stop.under).toBeLessThanOrEqual(1);
  expect(stop.top).toBeGreaterThanOrEqual(0);
  const scroll = await page.locator(".hint-app-scroll").evaluate(n => n.scrollTop);
  await page.waitForTimeout(200);
  expect(await page.locator(".hint-app-scroll").evaluate(n => n.scrollTop)).toBe(scroll);
});

for (const event of ["wheel", "touchmove", "pointerdown"]) {
  test(`a ${event} gesture cancels pending focus correction`, async ({ page }) => {
    await prepare(page, "/app/journal", 200);
    const scroll = await page.evaluate(event => {
      const scroller = document.querySelector<HTMLElement>(".hint-app-scroll")!;
      // Isolate the app's deferred correction from WebKit's own deferred caret scroll.
      document.querySelector<HTMLTextAreaElement>(".hint-app-scroll textarea")!.focus({ preventScroll: true });
      scroller.dispatchEvent(new Event(event, { bubbles: true }));
      scroller.scrollTop = 40;
      return scroller.scrollTop;
    }, event);
    await settleFocus(page);
    expect(await page.locator(".hint-app-scroll").evaluate(n => n.scrollTop)).toBe(scroll);
  });
}

test("leaving a form discards its pending focus correction", async ({ page }) => {
  await prepare(page, "/app/journal", 200);
  await page.evaluate(() => {
    document.querySelector<HTMLTextAreaElement>(".hint-app-scroll textarea")!.focus();
    document.querySelector<HTMLAnchorElement>('.hint-app-scroll a[href$="/app/rooms"]')!.click();
  });
  await expect(page).toHaveURL(/\/app\/rooms/);
  await settleFocus(page);
  expect(await page.locator(".hint-app-scroll").evaluate(n => n.scrollTop)).toBe(0);
});

test("form focus accounts for top and bottom safe-area clearance", async ({ page }) => {
  await prepare(page, "/app/journal", 200);
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--hint-safe-top", "47px");
    document.documentElement.style.setProperty("--hint-safe-bottom", "34px");
  });
  for (const field of await page.locator(".hint-app-scroll input,.hint-app-scroll textarea").all()) {
    await field.focus();
    const stop = (await focusPosition(page))!;
    expect(stop.top).toBeGreaterThanOrEqual(47);
    expect(stop.under).toBeLessThanOrEqual(1);
  }
});

test("a field taller than the usable viewport keeps native caret scrolling in charge", async ({ page }) => {
  await prepare(page, "/app/journal");
  const scroll = await page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>(".hint-app-scroll")!;
    const field = document.querySelector<HTMLTextAreaElement>(".hint-app-scroll textarea")!;
    field.style.height = `${innerHeight * 2}px`;
    scroller.scrollTop = 40;
    // Suppress the browser's scroll to observe whether the app forces an impossible fit.
    field.focus({ preventScroll: true });
    return scroller.scrollTop;
  });
  await settleFocus(page);
  expect(await page.locator(".hint-app-scroll").evaluate(n => n.scrollTop)).toBe(scroll);
  await expect(page.locator(".hint-app-scroll textarea")).toBeFocused();
});

import { expect, test, type Page, type TestInfo } from "./fixtures";

type EntranceRecord = {
  feature: string | null;
  motion: string | null;
  hidden: string | null;
  pointerEvents: string;
  pathname: string;
  startedAt: number;
  removedAt?: number;
  animationDuration: number;
  contentTarget: boolean;
  minOpacity: number;
  maxOpacity: number;
  launchVisible: boolean;
};
type EntranceProbe = {
  records: EntranceRecord[];
  originalWrapper: Element | null;
  backgroundOnEntry: boolean;
  restoreVisibility: () => void;
  stop: () => void;
};
declare global { interface Window { roomEntranceProbe: EntranceProbe } }

async function seed(page: Page, appReduced = false, systemReduced = false, firstVisit = false) {
  await page.addInitScript(({ appReduced, firstVisit }) => {
    const owner = "room-entrance-fictional-reader";
    localStorage.setItem("hint_anon_id", owner);
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    if (!firstVisit) localStorage.setItem("hint_launch_seen_v2", "1");
    localStorage.setItem("hint-language", "en");
    localStorage.setItem("hint-theme", "bright");
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: appReduced, soundAndHaptics: false }));
  }, { appReduced, firstVisit });
  await page.emulateMedia({ reducedMotion: systemReduced ? "reduce" : "no-preference" });
  await page.route("**/api/profile**", route => route.fulfill({ status: 404, json: { error: "PROFILE_NOT_FOUND" } }));
  // The shared context fixture fails every other unmocked API; these journeys
  // use fictional local state and never initiate a paid reading or calculation.
  await page.goto("/app?hintPreview=embedded");
  await expect(page.locator(".reference-home-crisp")).toBeVisible();
  await expect(page.locator("[data-room-transitions]")).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  await installProbe(page);
}

async function installProbe(page: Page) {
  await page.evaluate(() => {
    window.roomEntranceProbe?.stop();
    const entries = new Map<Element, EntranceRecord>();
    const originalVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
    let frame = 0;
    const restoreVisibility = () => {
      if (originalVisibility) Object.defineProperty(document, "visibilityState", originalVisibility);
      else Reflect.deleteProperty(document, "visibilityState");
      document.dispatchEvent(new Event("visibilitychange"));
    };
    const inspect = () => {
      for (const element of document.querySelectorAll<HTMLElement>("[data-room-entrance]")) {
        const prior = entries.get(element);
        if (!prior || prior.removedAt !== undefined || prior.feature !== element.getAttribute("data-room-entrance")) {
          if (prior && prior.removedAt === undefined) prior.removedAt = performance.now();
          const record: EntranceRecord = {
            feature: element.getAttribute("data-room-entrance"), motion: element.getAttribute("data-motion"),
            hidden: element.getAttribute("aria-hidden"), pointerEvents: getComputedStyle(element).pointerEvents,
            pathname: location.pathname, startedAt: performance.now(), animationDuration: 0,
            contentTarget: element.hasAttribute("data-room-content"), minOpacity: Number(getComputedStyle(element).opacity), maxOpacity: Number(getComputedStyle(element).opacity),
            launchVisible: !!document.querySelector(".hint-launch-intro"),
          };
          entries.set(element, record); window.roomEntranceProbe.records.push(record);
          if (window.roomEntranceProbe.backgroundOnEntry) {
            window.roomEntranceProbe.backgroundOnEntry = false;
            // Exercise the browser lifecycle signal while the entrance is live.
            // Native application lifecycle remains a separate device check.
            queueMicrotask(() => {
              Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
              document.dispatchEvent(new Event("visibilitychange"));
            });
          }
        }
        const record = entries.get(element)!;
        record.minOpacity = Math.min(record.minOpacity, Number(getComputedStyle(element).opacity));
        record.maxOpacity = Math.max(record.maxOpacity, Number(getComputedStyle(element).opacity));
        for (const animation of element.getAnimations()) {
          const timing = animation.effect?.getComputedTiming();
          if (timing && Number.isFinite(Number(timing.endTime))) record.animationDuration = Math.max(record.animationDuration, Number(timing.endTime));
        }
      }
      for (const [element, record] of entries) if ((!element.isConnected || !element.hasAttribute("data-room-entrance") || element.getAttribute("data-room-entrance") !== record.feature) && record.removedAt === undefined) record.removedAt = performance.now();
    };
    const observer = new MutationObserver(inspect);
    const tick = () => { inspect(); frame = requestAnimationFrame(tick); };
    window.roomEntranceProbe = {
      records: [], originalWrapper: document.querySelector("[data-room-transitions]"), backgroundOnEntry: false,
      restoreVisibility, stop: () => { observer.disconnect(); cancelAnimationFrame(frame); restoreVisibility(); },
    };
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-room-entrance", "data-motion", "data-room-arrival-id"] });
    frame = requestAnimationFrame(tick);
  });
}

async function records(page: Page) { return page.evaluate(() => window.roomEntranceProbe.records); }
async function assertEntrance(page: Page, feature: string, reduced = false) {
  if (reduced) {
    expect(await records(page)).toEqual([]);
    await expect(page.locator("[data-room-entrance]")).toHaveCount(0);
  } else {
    await expect.poll(async () => (await records(page)).map(record => record.feature)).toEqual([feature]);
    await expect(page.locator("[data-room-entrance]")).toHaveCount(0, { timeout: 2_000 });
    const [entry] = await records(page);
    expect(entry).toMatchObject({ motion: "full", hidden: null, contentTarget: true, minOpacity: 1, maxOpacity: 1 });
    expect(entry.pointerEvents).not.toBe("none");
    // The actual destination has committed before its transform starts.
    expect(entry.pathname).toMatch(new RegExp(`/app/${feature}$`));
    expect(entry.animationDuration).toBeGreaterThanOrEqual(1200);
    expect(entry.animationDuration).toBeLessThanOrEqual(1400);
    expect(entry.removedAt).toBeDefined();
    // Natural settlement is about 1.3s; direct input can end it immediately.
    expect(entry.removedAt! - entry.startedAt).toBeLessThan(1750);
  }
  expect(await page.evaluate(() => window.roomEntranceProbe.originalWrapper === document.querySelector("[data-room-transitions]"))).toBe(true);
  await expect(page.locator("[data-room-content]")).toHaveCount(1);
  await expect(page.locator(".hint-room-entrance-surface,.hint-room-entrance-mark")).toHaveCount(0);
  expect(await page.locator("[data-room-content]").evaluate(element => getComputedStyle(element).opacity)).toBe("1");
}

async function attachEvidence(page: Page, info: TestInfo, label: string) {
  await info.attach(`${label}-entrance-observations`, { body: JSON.stringify(await records(page), null, 2), contentType: "application/json" });
  await page.screenshot({ path: info.outputPath(`${label}-destination.png`) });
}

const homeEntries = [
  { feature: "tarot", ready: (page: Page) => page.getByPlaceholder("Type your question...") },
  { feature: "astrology", ready: (page: Page) => page.getByRole("heading", { name: "Twelve ways of being", exact: true }) },
  { feature: "collection", ready: (page: Page) => page.getByRole("heading", { name: "Your deck memory", exact: true }) },
  { feature: "personalities", ready: (page: Page) => page.getByRole("heading", { name: "Find Your Type", exact: true }) },
] as const;

test("a quick first Home entry does not start a second launch sequence over Tarot", async ({ page }) => {
  await seed(page, false, false, true);
  await page.locator('.reference-home-crisp a[href$="/app/tarot"]').click();
  await assertEntrance(page, "tarot");
  expect((await records(page))[0]!.launchVisible).toBe(false);
  await expect(page.getByPlaceholder("Type your question...")).toBeVisible();
});

for (const entry of homeEntries) {
  test(`Home ${entry.feature} entrance reaches its working room and cleans up`, async ({ page }, info) => {
    await seed(page);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const link = page.locator(`.reference-home-crisp a[href$="/app/${entry.feature}"]`).last();
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/app/${entry.feature}(?:[?#]|$)`));
    await assertEntrance(page, entry.feature);
    await expect(entry.ready(page)).toBeVisible();
    expect(errors).toEqual([]);
    await attachEvidence(page, info, entry.feature);
  });
}

for (const [app, system] of [[false, false], [true, false], [false, true], [true, true]] as const) {
  test(`room entrance respects app=${app} OS=${system} without blocking Tarot input`, async ({ page }, info) => {
    await seed(page, app, system);
    await page.locator('.reference-home-crisp a[href$="/app/tarot"]').click();
    const input = page.getByPlaceholder("Type your question...");
    await input.fill("A fictional question retained after entering the room");
    await assertEntrance(page, "tarot", app || system);
    await expect(input).toHaveValue("A fictional question retained after entering the room");
    await info.attach("motion-policy-observations", { body: JSON.stringify(await records(page), null, 2), contentType: "application/json" });
  });
}

test("rapid repeated Home taps create one navigation and Back does not replay an entrance", async ({ page }) => {
  await seed(page);
  const link = page.locator('.reference-home-crisp a[href$="/app/tarot"]');
  await link.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => history.length);
  // Dispatch two complete activations in one event turn, before React can remove
  // the source card. This deterministically reproduces the duplicate-tap race.
  await link.evaluate(element => { (element as HTMLElement).click(); (element as HTMLElement).click(); });
  await expect(page.getByPlaceholder("Type your question...")).toBeVisible();
  await assertEntrance(page, "tarot");
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
  await page.goBack();
  await expect(page.locator(".reference-home-crisp")).toBeVisible();
  await expect(page.locator("[data-room-entrance]")).toHaveCount(0);
  expect((await records(page)).map(record => record.feature)).toEqual(["tarot"]);
  // A fresh, deliberate visit remains available after the first one completes.
  await installProbe(page);
  await page.locator('.reference-home-crisp a[href$="/app/astrology"]').last().click();
  await assertEntrance(page, "astrology");
  await expect(page.getByTestId("astrology-screen")).toBeVisible();
});

test("backgrounding a live entrance dismisses it and foregrounding does not replay it", async ({ page }) => {
  await seed(page);
  await page.evaluate(() => { window.roomEntranceProbe.backgroundOnEntry = true; });
  await page.locator('.reference-home-crisp a[href$="/app/tarot"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-hint-motion-paused", "true");
  await expect(page.locator("[data-room-entrance]")).toHaveCount(0);
  expect((await records(page)).map(record => record.feature)).toEqual(["tarot"]);
  await page.evaluate(() => window.roomEntranceProbe.restoreVisibility());
  await expect(page.locator("html")).toHaveAttribute("data-hint-motion-paused", "false");
  await expect(page.getByPlaceholder("Type your question...")).toBeVisible();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator("[data-room-entrance]")).toHaveCount(0);
  expect((await records(page)).length).toBe(1);
});

test("query-only navigation keeps the live room and unsent input without a new entrance", async ({ page }) => {
  await seed(page);
  await page.locator('.reference-home-crisp a[href$="/app/tarot"]').click();
  const input = page.getByPlaceholder("Type your question...");
  await input.fill("Do not remount this unfinished question");
  await assertEntrance(page, "tarot");
  const originalInput = await input.elementHandle();
  await page.evaluate(() => {
    const url = new URL(location.href); url.searchParams.set("entrance-fixture", "query-only");
    history.pushState({}, "", url);
  });
  await expect(page).toHaveURL(/entrance-fixture=query-only/);
  await expect(input).toHaveValue("Do not remount this unfinished question");
  expect(await originalInput!.evaluate(element => element.isConnected)).toBe(true);
  await expect(page.locator("[data-room-entrance]")).toHaveCount(0);
  expect((await records(page)).length).toBe(1);
  await page.goBack();
  await expect(input).toHaveValue("Do not remount this unfinished question");
  expect(await originalInput!.evaluate(element => element.isConnected)).toBe(true);
});

const roomsEntries = [
  { feature: "animal-tarot", ready: (page: Page) => page.getByRole("button", { name: "Draw animal card", exact: true }) },
  { feature: "journal", ready: (page: Page) => page.getByTestId("input-journal-body") },
  { feature: "compatibility", ready: (page: Page) => page.getByRole("heading", { name: "Shared chart room", exact: true }) },
  { feature: "dream", ready: (page: Page) => page.getByRole("heading", { name: "Dream Decoder", exact: true }) },
] as const;

for (const entry of roomsEntries) {
  test(`supplemental Rooms ${entry.feature} entry opens the intended feature`, async ({ page }, info) => {
    await seed(page);
    await page.goto("/app/rooms?hintPreview=embedded");
    await expect(page.getByRole("heading", { name: "Choose the kind of room you need.", exact: true })).toBeVisible();
    // Dream remains an explicitly labelled preview. Include that existing entry
    // whether the room library defaults to showing or hiding previews.
    if (entry.feature === "dream") await page.getByRole("checkbox").check();
    const link = page.locator(`a[href$="/app/${entry.feature}"]`).filter({ has: page.locator("h3") });
    await link.scrollIntoViewIfNeeded();
    await installProbe(page);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/app/${entry.feature}(?:[?#]|$)`));
    await assertEntrance(page, entry.feature);
    await expect(entry.ready(page)).toBeVisible();
    if (entry.feature === "dream") await expect(page.getByText("This is a preview with example dream fragments. You can record a dream in your journal now.", { exact: true })).toBeVisible();
    await attachEvidence(page, info, `rooms-${entry.feature}`);
  });
}

const meEntries = [
  { space: "chart", feature: "astrology", ready: (page: Page) => page.getByRole("button", { name: "Create my birth chart", exact: true }) },
  { space: "history", feature: "readings", ready: (page: Page) => page.getByRole("heading", { name: "Readings", exact: true }) },
  { space: "collection", feature: "collection", ready: (page: Page) => page.getByRole("heading", { name: "Your deck memory", exact: true }) },
] as const;

for (const entry of meEntries) {
  test(`supplemental Me ${entry.space} entry preserves its destination`, async ({ page }, info) => {
    await seed(page);
    await page.goto("/app/profile?hintPreview=embedded");
    await expect(page.getByRole("heading", { name: "Your space", exact: true })).toBeVisible();
    const link = page.locator(`.me-personal-links a[data-space="${entry.space}"]`);
    await link.scrollIntoViewIfNeeded();
    await installProbe(page);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/app/${entry.feature}(?:[?#]|$)`));
    await assertEntrance(page, entry.feature);
    await expect(entry.ready(page)).toBeVisible();
    if (entry.space === "chart") {
      expect(new URL(page.url()).searchParams.get("tab")).toBe("chart");
      await expect(page.getByRole("navigation", { name: "Astrology sections" }).getByRole("button", { name: "My chart", exact: true })).toHaveAttribute("aria-pressed", "true");
    }
    await attachEvidence(page, info, `me-${entry.space}`);
  });
}

const dockEntries = [
  { feature: "ask", ready: (page: Page) => page.getByRole("textbox") },
  { feature: "daily", ready: (page: Page) => page.getByTestId("input-pull-note") },
  { feature: "profile", ready: (page: Page) => page.getByRole("heading", { name: "Your space", exact: true }) },
] as const;

for (const entry of dockEntries) {
  test(`supplemental Home dock ${entry.feature} entry stays directly usable`, async ({ page }, info) => {
    await seed(page);
    const link = page.locator(`[data-app-tabbar] a[href$="/app/${entry.feature}"]`);
    await expect(link).toBeInViewport();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/app/${entry.feature}(?:[?#]|$)`));
    if (entry.feature === "ask") {
      const heading = page.getByRole("heading", { level: 1 });
      await expect(heading).toBeVisible();
      const opacity = await heading.evaluate(element => {
        const values: number[] = [];
        for (let node: Element | null = element; node; node = node.parentElement) {
          values.push(Number(getComputedStyle(node).opacity));
          if (node.hasAttribute("data-room-content")) break;
        }
        return values;
      });
      expect(opacity.every(value => value === 1), "The incoming Ask heading is readable immediately, without a second opacity ceremony").toBe(true);
    }
    await assertEntrance(page, entry.feature);
    await expect(entry.ready(page)).toBeVisible();
    await attachEvidence(page, info, `home-dock-${entry.feature}`);
  });
}

for (const entry of [
  { from: "collection", feature: "tarot", link: 'a[href="/app/tarot"]', ready: (page: Page) => page.getByPlaceholder("Type your question...") },
  { from: "animal-tarot", feature: "collection", link: '.animal-action-card[href="/app/collection"]', ready: (page: Page) => page.getByRole("heading", { name: "Your deck memory", exact: true }) },
  { from: "compatibility", feature: "astrology", link: 'a[href="/app/astrology"]', ready: (page: Page) => page.getByTestId("astrology-screen") },
  { from: "dream", feature: "journal", link: 'a[href="/app/journal"]', ready: (page: Page) => page.getByTestId("input-journal-body") },
]) {
  test(`cross-room ${entry.from} to ${entry.feature} keeps the entrance and direct navigation`, async ({ page }, info) => {
    await seed(page);
    await page.goto(`/app/${entry.from}?hintPreview=embedded`);
    const link = page.locator(entry.link);
    await link.scrollIntoViewIfNeeded();
    await installProbe(page);
    await link.click();
    await assertEntrance(page, entry.feature);
    await expect(entry.ready(page)).toBeVisible();
    await attachEvidence(page, info, `${entry.from}-to-${entry.feature}`);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/app/${entry.from}(?:[?#]|$)`));
    await expect(page.locator("[data-room-entrance]")).toHaveCount(0);
    expect((await records(page)).map(record => record.feature)).toEqual([entry.feature]);
  });
}

type EntranceFrameMetrics = { samples: number; p50: number; p95: number; max: number; over100: number; elapsed: number };
declare global { interface Window { roomEntranceFrames?: { done: boolean; metrics?: EntranceFrameMetrics } } }

test("the arriving Tarot question accepts pointer input within its first 300ms", async ({ page }, info) => {
  await seed(page);
  // Home warms only local code while idle; this case isolates interaction from download time.
  await page.waitForTimeout(700);
  await page.locator('.reference-home-crisp a[href$="/app/tarot"]').click();
  const input = page.getByPlaceholder("Type your question...");
  await expect(input).toBeVisible();
  await expect(page.locator('[data-room-content][data-room-entrance="tarot"]')).toHaveCount(1);
  const box = (await input.boundingBox())!;
  expect(await input.evaluate(element => { const r = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); })).toBe(true);
  await page.evaluate(() => {
    document.addEventListener("focusin", () => { (window as unknown as { arrivalInputAt: number }).arrivalInputAt = performance.now(); }, { once: true });
  });
  // Coordinates use the current real hitbox; Locator.click would wait for a moving parent to settle.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(input).toBeFocused();
  const elapsed = await page.evaluate(() => (window as unknown as { arrivalInputAt: number }).arrivalInputAt - window.roomEntranceProbe.records[0]!.startedAt);
  expect(elapsed).toBeLessThan(300);
  await page.keyboard.type("This question is editable while the room arrives.");
  await expect(input).toHaveValue("This question is editable while the room arrives.");
  await expect(page.locator("[data-room-entrance]")).toHaveCount(0);
  expect(await page.locator("[data-room-content]").evaluate(element => getComputedStyle(element).transform)).toBe("none");
  await assertEntrance(page, "tarot");
  await info.attach("input-during-arrival", { body: JSON.stringify({ elapsedToFocusMs: elapsed, browserOnly: true }), contentType: "application/json" });
});

test("a slow room chunk shows its real loading state and never waits behind a cover", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let held = false;
  // Identify the local Tarot module by its stable public screen marker, not a build hash.
  await page.route(/\/assets\/[^/]+\.js(?:\?|$)/, async route => {
    const response = await route.fetch();
    const body = await response.text();
    if (body.includes('"tarot-phone-frame-shell"')) { held = true; await gate; }
    await route.fulfill({ response, body });
  });
  try {
    await seed(page);
    await page.locator('.reference-home-crisp a[href$="/app/tarot"]').click();
    await expect.poll(() => held).toBe(true);
    await expect(page).toHaveURL(/\/app\/tarot$/);
    await expect(page.locator("[data-room-loading]")).toBeVisible();
    const wrapper = await page.locator("[data-room-content]").elementHandle();
    await page.waitForTimeout(1450);
    expect(await records(page)).toEqual([]);
    await expect(page.locator(".hint-room-entrance-surface,.hint-room-entrance-mark")).toHaveCount(0);
    expect(await page.locator("[data-room-content]").evaluate(element => getComputedStyle(element).opacity)).toBe("1");
    await expect(page.getByText("Opening the room…", { exact: true })).toBeVisible();
    release();
    const input = page.getByPlaceholder("Type your question...");
    await expect(input).toBeVisible();
    await assertEntrance(page, "tarot");
    await input.fill("A slow connection keeps this question.");
    expect(await wrapper!.evaluate(element => element === document.querySelector("[data-room-content]"))).toBe(true);
    await expect(page.locator("[data-room-entrance]")).toHaveCount(0);
    expect((await records(page)).map(record => record.feature)).toEqual(["tarot"]);
    await expect(input).toHaveValue("A slow connection keeps this question.");
  } finally { release(); }
});

test("rapid room changes settle only the current room and keep navigation fixed", async ({ page }) => {
  await seed(page);
  await page.locator('.reference-home-crisp a[href$="/app/collection"]').click();
  await expect(page.getByRole("heading", { name: "Your deck memory", exact: true })).toBeVisible();
  const nav = page.locator("[data-app-tabbar]");
  const before = await nav.boundingBox();
  await page.locator('[data-app-tabbar] a[href$="/app/profile"]').click();
  await expect(page.getByRole("heading", { name: "Your space", exact: true })).toBeVisible();
  await page.locator('[data-app-tabbar] a[href$="/app/daily"]').click();
  await expect(page.getByTestId("input-pull-note")).toBeVisible();
  await expect.poll(async () => (await records(page)).map(record => record.feature)).toEqual(["collection", "profile", "daily"]);
  await expect(page.locator("[data-room-entrance]")).toHaveCount(0, { timeout: 2_000 });
  await expect(page).toHaveURL(/\/app\/daily$/);
  const after = await nav.boundingBox();
  expect(after!.x).toBe(before!.x); expect(after!.y).toBe(before!.y); expect(after!.width).toBe(before!.width);
  expect(await page.locator("[data-room-content]").evaluate(element => getComputedStyle(element).transform)).toBe("none");
});

test("switching system reduction on during arrival settles immediately and does not replay", async ({ page }) => {
  await seed(page);
  await page.locator('.reference-home-crisp a[href$="/app/tarot"]').click();
  await expect(page.locator('[data-room-content][data-room-entrance="tarot"]')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-room-entrance]")).toHaveCount(0);
  await expect(page.getByPlaceholder("Type your question...")).toBeVisible();
  expect(await page.locator("[data-room-content]").evaluate(element => getComputedStyle(element).transform)).toBe("none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForTimeout(150);
  await expect(page.locator("[data-room-entrance]")).toHaveCount(0);
  expect((await records(page)).map(record => record.feature)).toEqual(["tarot"]);
});

test("host RAF sample for repeated warm room entrances", async ({ page }, info) => {
  test.setTimeout(60_000);
  await seed(page);
  const warmed = homeEntries.filter(entry => entry.feature === "tarot" || entry.feature === "astrology");
  for (const entry of warmed) {
    await page.locator(`.reference-home-crisp a[href$="/app/${entry.feature}"]`).last().click();
    await expect(entry.ready(page)).toBeVisible();
    await expect(page.locator("[data-room-entrance]")).toHaveCount(0);
    await page.goBack();
    await expect(page.locator(".reference-home-crisp")).toBeVisible();
  }
  const samples: Array<{ feature: string; visit: number; metrics: EntranceFrameMetrics }> = [];
  for (let visit = 1; visit <= 3; visit++) for (const entry of warmed) {
    const link = page.locator(`.reference-home-crisp a[href$="/app/${entry.feature}"]`).last();
    await link.scrollIntoViewIfNeeded();
    await installProbe(page);
    await page.evaluate(() => {
      const state: { done: boolean; metrics?: EntranceFrameMetrics } = { done: false };
      window.roomEntranceFrames = state;
      // Begin on the real activation, excluding Playwright's actionability wait.
      document.addEventListener("click", () => {
        const startedAt = performance.now();
        const gaps: number[] = [];
        let previous: number | undefined;
        const sample = (time: number) => {
          if (previous !== undefined) gaps.push(time - previous);
          previous = time;
          if (time - startedAt < 1550) { requestAnimationFrame(sample); return; }
          const sorted = [...gaps].sort((a, b) => a - b);
          state.metrics = { samples: gaps.length, p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
            p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0, max: sorted.at(-1) ?? 0,
            over100: gaps.filter(gap => gap >= 100).length, elapsed: time - startedAt };
          state.done = true;
        };
        requestAnimationFrame(sample);
      }, { capture: true, once: true });
    });
    await link.click();
    await assertEntrance(page, entry.feature);
    await expect(entry.ready(page)).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.roomEntranceFrames?.done)).toBe(true);
    const metrics = await page.evaluate(() => window.roomEntranceFrames!.metrics!);
    expect(metrics.samples, "The short browser interval supplies actual frame observations").toBeGreaterThan(4);
    for (const value of [metrics.p50, metrics.p95, metrics.max]) expect(Number.isFinite(value) && value >= 0).toBe(true);
    samples.push({ feature: entry.feature, visit, metrics });
    await page.goBack();
    await expect(page.locator(".reference-home-crisp")).toBeVisible();
    await expect(page.locator("[data-room-entrance]")).toHaveCount(0);
  }
  await info.attach("warm-room-entrance-web-frames", { body: JSON.stringify({ browserOnly: true,
    physicalDeviceEvidence: false, device: info.project.name, intervalMs: 1550, samples }, null, 2), contentType: "application/json" });
});

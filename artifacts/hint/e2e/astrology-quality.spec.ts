import { expect, test, type Locator, type Page, type TestInfo } from "./fixtures";
import { at } from "../src/modules/astrology/astrologyCopy";
import { bodyName, signName } from "../src/modules/astrology/astrologyLibrary";

type Language = "en" | "zh" | "es" | "ja" | "ko";
const languages: Language[] = ["en", "zh", "es", "ja", "ko"];
const policies = [[false, false], [true, false], [false, true], [true, true]] as const;
const owner = "astrology-quality-fictional-owner";
const profile = { id: owner, name: "Alexandra — fictional quality review", birthDate: "1995-05-15", birthTime: "10:20", birthPlace: "Chicago, Illinois, United States", latitude: 41.87, longitude: -87.62, timezone: "America/Chicago", timezoneOffset: -5, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" };
const bodyIds = ["sun", "moon", "rising", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const signs = ["taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces", "aries"];
// Deliberately clustered, fictional provider data exercises leader placement and long lists.
const natal = { source: "astrologyapi", mode: "live", cached: false, fetchedAt: "2026-09-10T12:00:00Z", profileHash: "fictional-dense-chart", calculation: { zodiacSystem: "tropical", requestedHouseSystem: "placidus", houseSystem: null, returned: { placements: 11, houses: 12, aspects: 2 } }, chart: {
  placements: bodyIds.map((body, i) => ({ body, sign: "taurus", degree: i * 0.1, house: 1, retrograde: body === "mercury" })),
  houses: signs.map((sign, i) => ({ house: i + 1, sign, degree: 0.2 })),
  aspects: [{ from: "sun", to: "moon", type: "conjunction", orb: 0.1 }, { from: "moon", to: "rising", type: "conjunction", orb: 0.1 }],
  elementBalance: {}, modalityBalance: {},
} };
const transitRows = [
  { id: "ascendant", transitPlanet: "Venus", natalPlanet: "Ascendant", aspect: "trine", orb: 1.5, startDate: "2026-09-10T01:00:00Z", peakDate: "2026-09-10T12:00:00Z", endDate: "2026-09-10T23:00:00Z" },
  { id: "not-returned", transitPlanet: "Mars", natalPlanet: "MC", aspect: "square" },
];

async function seed(page: Page, language: Language, theme: string, appReduced: boolean, systemReduced: boolean) {
  await page.addInitScript(({ owner, profile, language, theme, appReduced }) => {
    localStorage.setItem("hint_anon_id", owner);
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_launch_seen_v2", "1");
    localStorage.setItem("hint-language", language);
    localStorage.setItem("hint-theme", theme);
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: appReduced, soundAndHaptics: false }));
    localStorage.setItem(`hint_birth_profile_v3:${owner}`, JSON.stringify(profile));
  }, { owner, profile, language, theme, appReduced });
  await page.emulateMedia({ reducedMotion: systemReduced ? "reduce" : "no-preference" });
  await page.route("**/api/astro/natal", route => route.fulfill({ json: natal }));
  await page.route("**/api/astro/transits", route => route.fulfill({ json: { source: "astrologyapi", mode: "live", date: "2026-09-10", transits: transitRows } }));
  await page.route("**/api/profile**", route => route.fulfill({ json: { ...profile, anonId: owner } }));
}

async function reachable(control: Locator) {
  await control.evaluate(el => el.scrollIntoView({ block: "center", behavior: "instant" }));
  const metrics = await control.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const text = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Node | null; let outside = false;
    while ((node = text.nextNode())) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange(); range.selectNode(node);
      outside ||= [...range.getClientRects()].some(line => line.left < rect.left - 1 || line.right > rect.right + 1 || line.top < rect.top - 1 || line.bottom > rect.bottom + 1);
    }
    return { width: rect.width, height: rect.height, hit: el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)), outside };
  });
  expect(metrics.width, "Control retains a 44px touch width").toBeGreaterThanOrEqual(44);
  expect(metrics.height, "Control retains a 44px touch height").toBeGreaterThanOrEqual(44);
  expect(metrics.hit, "Control center is not blocked by a fixed layer").toBe(true);
  expect(metrics.outside, "Control retains every text line inside its boundary").toBe(false);
}

async function capturePositions(page: Page, info: TestInfo, label: string) {
  const scroll = page.locator(".hint-app-scroll").last();
  for (const [position, fraction] of [["top", 0], ["middle", 0.5], ["bottom", 1]] as const) {
    await scroll.evaluate((el, fraction) => { el.scrollTop = (el.scrollHeight - el.clientHeight) * fraction; }, fraction);
    await page.evaluate(async () => {
      await Promise.allSettled(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().iterations ?? Infinity)).map(animation => animation.finished));
    });
    await page.screenshot({ path: info.outputPath(`${label}-${position}.png`) });
  }
  const footer = page.getByTestId("astrology-screen").locator(":scope > p").last();
  const bounds = await footer.boundingBox();
  const dock = await page.locator("[data-app-tabbar]").boundingBox();
  expect(bounds, "The final content is reachable at the end of the scroll").not.toBeNull();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(dock?.y ?? page.viewportSize()!.height);
}

async function magnifyText(page: Page) {
  // Web text reflow is evidence for this renderer, not proof of iOS Dynamic Type.
  await page.locator(".astro-guide, .astro-detail-dialog").evaluateAll(roots => {
    const elements = roots.flatMap(root => [...root.querySelectorAll<HTMLElement>("p,h1,h2,h3,h4,button,strong,small,span,summary,dt,dd")]);
    const sizes = elements.map(element => [element, parseFloat(getComputedStyle(element).fontSize)] as const);
    for (const [element, size] of sizes) if (!element.closest("svg")) element.style.fontSize = `${size * 2}px`;
  });
}

// Every locale, theme and motion policy on both phone sizes.
for (const language of languages) for (const [app, os] of policies) for (const theme of ["bright", "dark"]) {
  test(`Astrology quality ${language} ${theme} app=${app} OS=${os}`, async ({ page }, info) => {
    test.setTimeout(90_000);
    await seed(page, language, theme, app, os);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto("/app/astrology?hintPreview=embedded&tab=chart");
    await expect(page.getByTestId("astro-wheel")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByTestId("astrology-screen")).toHaveAttribute("data-motion", app || os ? "off" : "on");
    const nav = page.getByRole("navigation", { name: at(language, "sections") });
    for (const control of await nav.getByRole("button").all()) await reachable(control);
    const sun = page.locator(".astro-core-grid").getByRole("button", { name: new RegExp(bodyName("sun", language)) });
    await reachable(sun); await sun.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { level: 2 })).toContainText(bodyName("sun", language));
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    if (app && os) await magnifyText(page);
    const dialogScroll = dialog.locator(".astro-dialog-scroll");
    await dialogScroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
    const box = await dialog.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await page.screenshot({ path: info.outputPath("placement-detail.png") });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page).not.toHaveURL(/body=/);
    await capturePositions(page, info, app && os ? "chart-200text" : "chart");

    await nav.getByRole("button", { name: at(language, "explore"), exact: true }).click();
    await expect(page.locator(".astro-sign-choice")).toHaveCount(12);
    const lastSign = page.locator(".astro-sign-choice").last();
    await reachable(lastSign); await lastSign.click();
    await expect(page.getByRole("heading", { name: signName("pisces", language), exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: at(language, "everyday"), exact: true })).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole("heading", { name: signName("pisces", language), exact: true })).toBeVisible();
    await capturePositions(page, info, "sign-story");
    await nav.getByRole("button", { name: at(language, "now"), exact: true }).click();
    const connections = page.locator(".astro-transit-connection");
    await expect(connections).toHaveCount(2);
    await expect(connections.nth(1).getByRole("button")).toHaveCount(0);
    const timing = page.locator("details").filter({ has: page.getByText(at(language, "timing"), { exact: true }) }).first();
    await timing.locator("summary").click();
    await expect(timing.locator("dt")).toHaveText([at(language, "starts"), at(language, "exact"), at(language, "ends")]);
    expect(new Set(await timing.locator("dd").allTextContents()).size).toBe(3);
    await page.screenshot({ path: info.outputPath("transit-timing.png") });
    const ascendant = connections.first().getByRole("button");
    await reachable(ascendant); await ascendant.click();
    await expect(page).toHaveURL(/body=rising/);
    await expect(page.getByRole("dialog")).toContainText(bodyName("rising", language));
    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });
}

test("Astrology unknown saved selection remains recoverable and does not invent a chart point", async ({ page }) => {
  await seed(page, "en", "bright", true, false);
  await page.goto("/app/astrology?hintPreview=embedded&tab=chart&body=Chiron");
  await expect(page.getByTestId("astro-wheel")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(at("en", "missingSelection"));
  await page.locator(".astro-core-grid").getByRole("button", { name: /Sun/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/body=/);
});

test("Astrology host frame samples during chart, detail and scrolling", async ({ page }, info) => {
  await seed(page, "en", "dark", false, false);
  await page.goto("/app/astrology?hintPreview=embedded&tab=chart");
  await expect(page.getByTestId("astro-wheel")).toBeVisible();
  const sample = () => page.evaluate(() => new Promise<{ samples: number; p95: number; max: number; consecutive100ms: number }>(resolve => {
    const gaps: number[] = []; let previous = performance.now(); const started = previous;
    function tick(now: number) {
      gaps.push(now - previous); previous = now;
      if (now - started < 1200) return requestAnimationFrame(tick);
      const measured = gaps.slice(1); const sorted = [...measured].sort((a, b) => a - b);
      let longest = 0; let run = 0; for (const gap of measured) { run = gap >= 100 ? run + 1 : 0; longest = Math.max(longest, run); }
      resolve({ samples: measured.length, p95: sorted[Math.floor(sorted.length * .95)] ?? Infinity, max: sorted.at(-1) ?? Infinity, consecutive100ms: longest });
    }
    requestAnimationFrame(tick);
  }));
  const idle = await sample();
  const active = sample();
  await page.locator(".astro-core-grid").getByRole("button", { name: /Sun/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator(".hint-app-scroll").last().evaluate(el => new Promise<void>(resolve => {
    let frame = 0; const tick = () => { frame++; el.scrollTop = (el.scrollHeight - el.clientHeight) * Math.sin(Math.PI * frame / 30) ** 2; if (frame < 30) requestAnimationFrame(tick); else resolve(); }; requestAnimationFrame(tick);
  }));
  const interaction = await active;
  await info.attach("astrology-host-frames", { body: JSON.stringify({ browserOnly: true, physicalIphoneVerified: false, idle, interaction }, null, 2), contentType: "application/json" });
  expect(idle.samples).toBeGreaterThan(20); expect(interaction.samples).toBeGreaterThan(20);
  expect(interaction.p95).toBeLessThan(Math.max(90, idle.p95 * 3));
  expect(interaction.consecutive100ms).toBeLessThan(2);
});

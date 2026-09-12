import { expect, test, type Page } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

const profile = { id: "astro-fixture", name: "Preview Reader", birthDate: "1995-05-15", birthTime: "10:20", birthPlace: "Chicago, Illinois, United States", latitude: 41.87, longitude: -87.62, timezone: "America/Chicago", timezoneOffset: -5, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" };
const natal = { source: "astrologyapi", mode: "live", cached: false, fetchedAt: "2026-09-09T00:00:00Z", profileHash: "test-calculation", chart: {
  placements: [{ body: "sun", sign: "taurus", degree: 24.5 }, { body: "moon", sign: "cancer", degree: 1.2 }, { body: "rising", sign: "libra", degree: 17.2, house: 1 }],
  houses: [{ house: 1, sign: "libra", degree: 17.2 }], aspects: [], elementBalance: { earth: 1, water: 1, air: 1, fire: 0, dominant: "earth" }, modalityBalance: { cardinal: 2, fixed: 1, mutable: 0, dominant: "cardinal" },
} };

async function seed(page: Page, options: { loggedIn?: boolean; timeKnown?: boolean; theme?: string; language?: string } = {}) {
  await page.addInitScript(({ profile, options }) => {
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_anon_id", "astro-browser-test");
    localStorage.setItem("hint-language", options.language ?? "en");
    localStorage.setItem("hint-theme", options.theme ?? "bright");
    if (options.loggedIn !== false) {
      localStorage.setItem("hint_local_auth_v1", JSON.stringify({ identifier: "astro@hint.test", provider: "email", name: profile.name, createdAt: profile.createdAt, lastSignedInAt: profile.createdAt }));
      localStorage.setItem("hint.birthProfile", JSON.stringify({ ...profile, birthTime: options.timeKnown === false ? undefined : profile.birthTime }));
    }
  }, { profile, options });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/profile") return options.loggedIn === false ? route.fulfill({ status: 404, json: { error: "PROFILE_NOT_FOUND" } }) : route.fulfill({ json: { anonId: "astro-browser-test", ...profile } });
    return route.fulfill({ status: 503, json: { error: "Unavailable for test" } });
  });
}
const go = (page: Page, tab = "chart") => page.goto(`/app/astrology?hintPreview=embedded&tab=${tab}`);

test("Together invalidates an existing result and ignores a late response after partner edits", async ({ page }) => {
  await seed(page);
  await page.route("**/api/astro/natal", route => route.fulfill({ json: natal }));
  let release: (() => void) | undefined;
  let delayed = false;
  await page.route("**/api/astro/synastry", async route => {
    const partner = route.request().postDataJSON().partnerProfile;
    if (delayed) await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { source: "astrologyapi", mode: "live", fetchedAt: new Date().toISOString(),
      summary: { comfort: "Soft", tension: "Low", communication: "Clear", attraction: "Warm", growth: "Open" },
      aspects: [], plainEnglish: { main: `Computed snapshot for ${partner.name}`, comfort: "Fixture", tension: "Fixture", advice: "Fixture" } } });
  });
  await go(page, "chart");
  await expect(page.getByTestId("astro-wheel")).toBeVisible();
  await page.getByRole("button", { name: /^The space between you/ }).click();
  await page.getByRole("checkbox").check();
  const form = page.locator("form");
  await form.getByRole("textbox", { name: "Name", exact: true }).fill("Partner A");
  await form.getByLabel("Birth date", { exact: true }).fill("2000-01-01");
  await form.getByLabel("Birth place", { exact: true }).fill("Tokyo");
  await form.getByLabel("Birth time", { exact: true }).fill("08:00");
  await form.getByText("Advanced location data", { exact: true }).click();
  await form.getByLabel("Latitude", { exact: true }).fill("35.67");
  await form.getByLabel("Longitude", { exact: true }).fill("139.65");
  await form.getByLabel("Timezone", { exact: true }).fill("Asia/Tokyo");
  await form.getByLabel("Timezone offset", { exact: true }).fill("9");
  await page.getByRole("button", { name: "Explore the connection", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preview Reader + Partner A" })).toBeVisible();
  await page.getByText("Original calculation notes", { exact: true }).click();
  await expect(page.getByText("Computed snapshot for Partner A")).toBeVisible();
  await form.getByRole("textbox", { name: "Name", exact: true }).fill("Partner B");
  await expect(page.getByText("Computed snapshot for Partner A")).not.toBeVisible();
  delayed = true;
  await page.getByRole("button", { name: "Explore the connection", exact: true }).click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await form.getByRole("textbox", { name: "Name", exact: true }).fill("Partner C");
  release!();
  await expect(page.getByText("Computed snapshot for Partner B")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Explore the connection", exact: true })).toBeEnabled();
});

test("zodiac learning works without an account and sections survive back and refresh", async ({ page }) => {
  await seed(page, { loggedIn: false });
  await go(page, "signs");
  await expect(page.getByRole("heading", { name: "Your sign is a beginning. Your chart is the whole conversation." })).toBeVisible();
  await expect(page.locator(".astro-sign-choice")).toHaveCount(12);
  for (const sign of ["Aries", "Virgo", "Sagittarius", "Pisces"]) {
    await page.locator(".astro-sign-choice").filter({ has: page.getByText(sign, { exact: true }) }).click();
    await expect(page.getByRole("heading", { name: sign, exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`sign=${sign.toLowerCase()}`));
    await expect(page.getByRole("heading", { name: "In everyday life", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "All twelve signs", exact: true }).click();
  }
  await page.getByRole("navigation", { name: "Astrology sections" }).getByRole("button", { name: "My chart", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The moment you arrived" })).toBeVisible();
  await page.getByRole("button", { name: "Create my birth chart", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /email/i })).toHaveCount(0);
  await page.goBack();
  await page.goBack();
  await expect(page.getByRole("navigation", { name: "Astrology sections" }).getByRole("button", { name: "Explore signs", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your sign is a beginning. Your chart is the whole conversation." })).toBeVisible();
  await expect(page.getByTestId("astro-wheel")).toHaveCount(0);
});

test("unknown birth time never produces an invented personal chart", async ({ page }) => {
  let requests = 0;
  await seed(page, { timeKnown: false });
  await page.route("**/api/astro/natal", (route) => { requests++; return route.fulfill({ json: natal }); });
  await go(page);
  await expect(page.getByText("Time unknown? Save what you know. We won’t invent a Moon, Ascendant or houses.", { exact: true })).toBeVisible();
  await expect(page.getByTestId("astro-wheel")).toHaveCount(0);
  await page.getByRole("navigation", { name: "Astrology sections" }).getByRole("button", { name: "Explore signs", exact: true }).click();
  await expect(page.locator(".astro-sign-choice")).toHaveCount(12);
  expect(requests).toBe(0);
});

test("fallback chart is never presented as personal and explicit retry recovers", async ({ page }) => {
  let calculated = false;
  await seed(page);
  await page.route("**/api/astro/natal", (route) => route.fulfill({ json: calculated ? natal : { ...natal, source: "fallback", mode: "fallback" } }));
  await go(page);
  await expect(page.getByRole("alert")).toContainText("calculated chart is unavailable");
  await expect(page.getByTestId("astro-wheel")).toHaveCount(0);
  calculated = true;
  await page.getByRole("button", { name: "Calculate birth chart", exact: true }).click();
  await expect(page.getByTestId("astro-wheel")).toBeVisible();
  await expect(page.locator(".astro-placement-list").first()).toContainText("24.5°");
  await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Aspects", exact: true }) })).toContainText("Not supplied");
  await page.reload();
  await expect(page.getByTestId("astro-wheel")).toBeVisible();
});

test("transit failure and empty success never insert sample rows or fabricated dates", async ({ page }) => {
  await seed(page);
  await page.route("**/api/astro/natal", (route) => route.fulfill({ json: natal }));
  let available = false;
  await page.route("**/api/astro/transits", (route) => route.fulfill({ json: available ? { source: "astrologyapi", mode: "live", date: "2026-09-09", transits: [] } : { source: "fallback", mode: "fallback", date: "2026-09-09", transits: [{ title: "FAKE SAMPLE" }] } }));
  await go(page);
  await expect(page.getByTestId("astro-wheel")).toBeVisible();
  await page.getByRole("navigation", { name: "Astrology sections" }).getByRole("button", { name: "Transits now", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Personal transits are unavailable");
  await expect(page.getByText("FAKE SAMPLE")).toHaveCount(0);
  available = true;
  await page.getByRole("button", { name: "Recalculate", exact: true }).click();
  await expect(page.getByText("No transits were returned for this calculation. This does not predict an easy or difficult day.", { exact: true })).toBeVisible();
  await expect(page.getByText("Calculated · Sep 9, 2026", { exact: true })).toBeVisible();
  await expect(page.locator('input[type="date"]')).toHaveCount(0);
});

test("a late chart response cannot overwrite changed birth details", async ({ page }) => {
  await seed(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let started = false;
  await page.route("**/api/astro/natal", async (route) => { started = true; await pending; await route.fulfill({ json: natal }); });
  await go(page);
  await expect.poll(() => started).toBe(true);
  await page.getByRole("button", { name: "Edit birth details", exact: true }).click();
  await page.getByLabel("Birth time", { exact: true }).fill("");
  await page.getByRole("button", { name: "Review birth details", exact: true }).click();
  await page.getByRole("button", { name: "Save on this device", exact: true }).click();
  release();
  await expect(page.getByText("Save an accurate birth time and a place with verified coordinates and time zone to calculate personal placements.", { exact: true })).toBeVisible();
  await expect(page.getByTestId("astro-wheel")).toHaveCount(0);
});

for (const theme of ["bright", "dark"]) {
  test(`${theme} astrology layouts and accessibility`, async ({ page }, testInfo) => {
    await seed(page, { theme });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/astro/natal", (route) => route.fulfill({ json: natal }));
    await go(page);
    await expect(page.getByTestId("astro-wheel")).toBeVisible();
    for (const tab of ["My chart", "Explore signs", "Edit birth details", "Read the full report"]) {
      const navigation = page.getByRole("navigation", { name: "Astrology sections" });
      if (tab === "My chart" || tab === "Explore signs") {
        await navigation.getByRole("button", { name: tab, exact: true }).click();
      } else {
        await navigation.getByRole("button", { name: "My chart", exact: true }).click();
        await page.getByRole("button", { name: tab, exact: true }).click();
      }
      const metrics = await page.getByTestId("astrology-screen").evaluate((el) => ({ width: el.clientWidth, scroll: el.scrollWidth }));
      expect(metrics.scroll).toBeLessThanOrEqual(metrics.width);
      const axe = await new AxeBuilder({ page }).include('[data-testid="astrology-screen"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(axe.violations).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`${theme}-${tab.replaceAll(" ", "-")}.png`) });
    }
  });
}

test("Rooms search and preview recovery have working destinations", async ({ page }) => {
  await seed(page, { loggedIn: false });
  await page.goto("/app/rooms?hintPreview=embedded");
  await page.getByRole("searchbox", { name: "Search rooms" }).fill("journal");
  await expect(page.getByRole("status")).toHaveText("Rooms: 1");
  await page.getByRole("link", { name: /Emotional Journal/ }).click();
  await expect(page.getByLabel("Your page", { exact: true })).toBeVisible();
  await page.goBack();
  await page.getByRole("searchbox", { name: "Search rooms" }).fill("no-such-room");
  await expect(page.getByRole("heading", { name: "No rooms found" })).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await page.goto("/app/dream?hintPreview=embedded");
  await page.getByRole("link", { name: "Write in my journal" }).click();
  await expect(page.getByLabel("Your page", { exact: true })).toBeVisible();
});

test("birth place edits clear old coordinates and ignore stale search matches", async ({ page }) => {
  await seed(page);
  await page.route("**/api/astro/natal", (route) => route.fulfill({ json: natal }));
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/astro/geo-details", async (route) => {
    await pending;
    await route.fulfill({ json: { mode: "live", results: [{ name: "Old search match", latitude: 25, longitude: 121 }] } });
  });
  await go(page, "birth");
  await page.getByLabel("Birth place", { exact: true }).fill("Taipei");
  await page.getByRole("button", { name: "Find place", exact: true }).click();
  await page.getByLabel("Birth place", { exact: true }).fill("Tokyo");
  release();
  await expect(page.getByRole("button", { name: /Old search match/ })).toHaveCount(0);
  await page.getByText("Advanced location data", { exact: true }).click();
  await expect(page.getByLabel("Latitude", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Longitude", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Review birth details", exact: true }).click();
  await page.getByRole("button", { name: "Save on this device", exact: true }).click();
  await expect(page.getByTestId("astro-wheel")).toHaveCount(0);
  await expect(page.getByText("Save an accurate birth time and a place with verified coordinates and time zone to calculate personal placements.", { exact: true })).toBeVisible();
});

test("Chinese sign learning does not trigger a personal calculation", async ({ page }) => {
  await seed(page, { language: "zh" });
  let requests = 0;
  await page.route("**/api/astro/natal", (route) => { requests++; return route.fulfill({ json: natal }); });
  await go(page, "signs");
  await expect(page.locator(".astro-sign-choice")).toHaveCount(12);
  await page.locator(".astro-sign-choice").last().click();
  await expect(page.getByRole("heading", { name: "双鱼座", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/sign=pisces/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "双鱼座", exact: true })).toBeVisible();
  expect(requests).toBe(0);
  const metrics = await page.getByTestId("astrology-screen").evaluate(el => [el.clientWidth, el.scrollWidth]);
  expect(metrics[1]).toBeLessThanOrEqual(metrics[0]);
});

test("dense chart and expanded details remain readable above bottom navigation", async ({ page }, testInfo) => {
  await seed(page);
  const bodies = ["sun", "moon", "rising", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
  await page.route("**/api/astro/natal", route => route.fulfill({ json: { ...natal, chart: { ...natal.chart, placements: bodies.map((body, i) => ({body, sign: "taurus", degree: i * 2})), aspects: [{from: "sun", to: "moon", type: "conjunction"}] } } }));
  await go(page);
  const wheel = page.getByTestId("astro-wheel");
  await expect(wheel).toBeVisible();
  expect(await wheel.locator("circle[r='84']").evaluate(el => getComputedStyle(el).fill)).not.toBe("rgb(0, 0, 0)");
  await wheel.scrollIntoViewIfNeeded();
  await page.screenshot({path: testInfo.outputPath("dense-chart-wheel.png")});
  await page.locator(".astro-placement-list").getByRole("button", { name: /Sun · Moon.*Conjunction/ }).click();
  await expect(page.getByRole("dialog", { name: "Sun · Conjunction · Moon" })).toBeVisible();
  await expect(page.getByRole("dialog")).not.toContainText("NaN");
  await expect(page.getByRole("dialog")).not.toContainText("0.0° orb");
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".astro-guide")).not.toContainText("NaN");
  await expect(page.locator(".astro-guide")).not.toContainText("0.0° orb");
  await page.getByText("Birth details", { exact: true }).click();
  const refresh = page.getByRole("button", {name: "Recalculate", exact:true});
  await page.locator(".hint-app-scroll").evaluate(el => { el.scrollTop = el.scrollHeight; });
  const button = await refresh.boundingBox();
  const nav = await page.getByRole("navigation", {name:"App", exact:true}).boundingBox();
  expect(button!.y + button!.height).toBeLessThanOrEqual(nav!.y);
  await page.screenshot({path: testInfo.outputPath("expanded-chart-bottom.png")});
});

test("chart points and enlarged chart support keyboard, history and direct detail reload", async ({ page }) => {
  await seed(page);
  await page.route("**/api/astro/natal", route => route.fulfill({ json: natal }));
  await go(page);
  const sun = page.getByTestId("astro-wheel").getByRole("button", { name: "Sun", exact: true });
  await sun.focus();
  await sun.press("Enter");
  await expect(page.getByRole("dialog", { name: "Sun · Taurus" })).toBeVisible();
  await expect(page).toHaveURL(/body=sun/);
  await expect(page.getByRole("dialog")).toContainText("24.5°");
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Sun · Taurus" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const enlarge = page.getByRole("button", { name: "Enlarge chart", exact: true });
  await enlarge.click();
  const dialog = page.getByRole("dialog", { name: "Your celestial signature", exact: true });
  await expect(dialog).toBeVisible();
  for (let step = 0; step < 5; step++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(enlarge).toBeFocused();
});

import { expect, test } from "./fixtures";

test("fresh Astrology journey verifies a birthplace, reviews details and restores a personal chart without email", async ({ page }, info) => {
  const owner = "fresh-chart-fictional-owner";
  await page.addInitScript(owner => {
    localStorage.setItem("hint_anon_id", owner);
    localStorage.setItem("hint-language", "en");
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
  }, owner);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/profile**", route => route.fulfill({ status: 404, json: { error: "PROFILE_NOT_FOUND" } }));
  await page.route("**/api/astro/geo-details", route => route.fulfill({ json: {
    source: "astrologyapi", mode: "live", cached: false, fetchedAt: "2026-09-10T12:00:00Z", query: "Chicago",
    results: [{ id: "fictional-chicago", name: "Chicago", label: "Chicago, Illinois, United States", latitude: 41.87, longitude: -87.62, timezoneId: "America/Chicago" }],
  } }));
  const timezoneRequests: unknown[] = [];
  await page.route("**/api/astro/timezone", route => {
    timezoneRequests.push(route.request().postDataJSON());
    return route.fulfill({ json: { source: "astrologyapi", mode: "live", cached: false, fetchedAt: "2026-09-10T12:00:00Z", latitude: 41.87, longitude: -87.62, timezoneId: "America/Chicago", timezoneOffset: -5 } });
  });
  const calculations: Array<{ profile: Record<string, unknown> }> = [];
  await page.route("**/api/astro/natal", route => {
    calculations.push(route.request().postDataJSON());
    return route.fulfill({ json: { source: "astrologyapi", mode: "live", cached: false, fetchedAt: "2026-09-10T12:00:00Z", profileHash: "fictional-calculation", chart: {
      placements: [{ body: "sun", sign: "taurus", degree: 24.5 }, { body: "moon", sign: "cancer", degree: 1.2 }, { body: "rising", sign: "libra", degree: 17.2 }],
      houses: [], aspects: [], elementBalance: {}, modalityBalance: {},
    } } });
  });
  await page.goto("/app/astrology?hintPreview=embedded");
  await page.locator(".astro-sign-choice").filter({ has: page.getByText("Aries", { exact: true }) }).click();
  await expect(page.getByRole("heading", { name: "Aries", exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Astrology sections" }).getByRole("button", { name: "My chart", exact: true }).click();
  await page.getByRole("button", { name: "Create my birth chart", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Fictional New Reader");
  await page.getByLabel("Birth date", { exact: true }).fill("1995-05-15");
  await page.getByLabel("Birth time", { exact: true }).fill("10:20");
  await page.getByLabel("Birth place", { exact: true }).fill("Chicago");
  await page.getByRole("button", { name: "Find place", exact: true }).click();
  await page.getByRole("button", { name: /Chicago, Illinois, United States/ }).click();
  const review = page.getByRole("button", { name: "Review birth details", exact: true });
  await expect(review).toBeEnabled(); await review.click();
  await expect(page.locator(".astro-review")).toContainText("Chicago, Illinois, United States");
  expect(calculations).toHaveLength(0);
  await page.screenshot({ path: info.outputPath("birth-details-review.png") });
  await page.getByRole("button", { name: "Save on this device", exact: true }).click();
  await expect(page.getByTestId("astro-wheel")).toBeVisible();
  expect(timezoneRequests).toEqual([{ latitude: 41.87, longitude: -87.62, dateISO: "1995-05-15" }]);
  expect(calculations).toHaveLength(1);
  expect(calculations[0].profile).toMatchObject({ id: owner, name: "Fictional New Reader", birthDate: "1995-05-15", birthTime: "10:20", latitude: 41.87, longitude: -87.62, timezone: "America/Chicago", timezoneOffset: -5 });
  await page.locator(".astro-core-grid").getByRole("button", { name: /Sun/ }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { level: 2 })).toHaveText("Sun · Taurus");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByTestId("astro-wheel")).toBeVisible();
  expect(calculations).toHaveLength(1);
  expect(await page.evaluate(owner => localStorage.getItem(`hint_local_auth_v2:${owner}`), owner)).toBeNull();
  expect(await page.evaluate(owner => JSON.parse(localStorage.getItem(`hint_birth_profile_v3:${owner}`)!).timezoneOffset, owner)).toBe(-5);
  await page.screenshot({ path: info.outputPath("created-personal-chart.png") });
});

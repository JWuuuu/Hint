import { expect, test } from "./fixtures";

const owner = "approved-astrology-fixture";
const profile = {
  id: owner,
  name: "Preview Reader",
  birthDate: "1998-02-11",
  birthTime: "08:00",
  birthPlace: "Changsha, Hunan, China",
  latitude: 28.23,
  longitude: 112.94,
  timezone: "Asia/Shanghai",
  timezoneOffset: 8,
  createdAt: "2026-11-09T12:00:00Z",
  updatedAt: "2026-11-09T12:00:00Z",
};
const natal = {
  source: "astrologyapi",
  mode: "live",
  cached: false,
  fetchedAt: "2026-11-09T12:00:00Z",
  profileHash: "fictional-approved-chart",
  calculation: {
    zodiacSystem: "tropical",
    requestedHouseSystem: "equal",
    houseSystem: "Equal",
    returned: { placements: 7, houses: 12, aspects: 3 },
  },
  chart: {
    placements: [
      { body: "sun", sign: "aquarius", degree: 21.83, house: 12 },
      { body: "moon", sign: "gemini", degree: 8.67, house: 4 },
      { body: "rising", sign: "pisces", degree: 6.25, house: 1 },
      { body: "mercury", sign: "capricorn", degree: 27.38, house: 11 },
      { body: "venus", sign: "capricorn", degree: 7.32, house: 11 },
      { body: "mars", sign: "sagittarius", degree: 15.98, house: 10 },
      { body: "jupiter", sign: "leo", degree: 11.95, house: 5, retrograde: true },
    ],
    additionalPlacements: [
      { body: "chiron", sign: "capricorn", degree: 14.68, house: 10 },
    ],
    houses: [
      "pisces", "aries", "taurus", "gemini", "cancer", "leo",
      "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius",
    ].map((sign, index) => ({ house: index + 1, sign, degree: 6.25 })),
    aspects: [
      { from: "sun", to: "mars", type: "sextile", orb: 5.85 },
      { from: "moon", to: "rising", type: "square", orb: 2.42 },
      { from: "venus", to: "rising", type: "sextile", orb: 1.07 },
    ],
    elementBalance: {},
    modalityBalance: {},
  },
};

test("Zodiac and My Chart share the calculated placements on mobile", async ({ page }, info) => {
  await page.addInitScript(profile => {
    localStorage.setItem("hint_anon_id", profile.id);
    localStorage.setItem(`hint_birth_profile_v3:${profile.id}`, JSON.stringify(profile));
    localStorage.setItem("hint-language", "en");
    localStorage.setItem("hint-theme", "bright");
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_launch_seen_v2", "1");
  }, profile);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/profile**", route => route.fulfill({ json: { ...profile, anonId: owner } }));
  const requests: unknown[] = [];
  await page.route("**/api/astro/natal", route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: natal });
  });

  await page.goto("/app/astrology?hintPreview=embedded");
  const nav = page.getByRole("navigation", { name: "Astrology sections" });
  await expect(nav.getByRole("button")).toHaveText(["Zodiac", "My Chart", "Together"]);
  await expect(nav.getByRole("button", { name: "Zodiac", exact: true })).toHaveAttribute("aria-pressed", "true");

  const portrait = page.getByTestId("zodiac-portrait");
  await expect(portrait.getByRole("button", { name: /Sun.*Aquarius/i })).toBeVisible();
  const home = await page.getByRole("link", { name: "Home", exact: true }).boundingBox();
  const title = await page.getByRole("heading", { name: /^astrology$/i, level: 1 }).boundingBox();
  const tabs = await nav.boundingBox();
  expect(title!.y).toBeGreaterThanOrEqual(home!.y);
  expect(title!.y + title!.height).toBeLessThanOrEqual(home!.y + home!.height);
  const tabGap = tabs!.y - (home!.y + home!.height);
  expect(tabGap).toBeGreaterThanOrEqual(0);
  expect(tabGap).toBeLessThanOrEqual(12);

  await expect(portrait.locator("[data-placement]")).toHaveCount(8);
  for (const [label, sign] of [
    ["Rising", "Pisces"], ["Moon", "Gemini"], ["Mercury", "Capricorn"],
    ["Venus", "Capricorn"], ["Mars", "Sagittarius"],
  ]) {
    await expect(portrait.getByRole("button", { name: new RegExp(`${label}.*${sign}`, "i") })).toBeVisible();
  }
  await expect(portrait.getByText("North Node", { exact: true })).toBeVisible();
  await expect(portrait.getByText("Juno", { exact: true })).toBeVisible();
  await expect(portrait.getByText(/^(Not supplied|Unavailable)$/i)).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Twelve ways of being", exact: true })).toHaveCount(0);
  expect(requests).toEqual([expect.objectContaining({ profile: expect.objectContaining({ id: owner, birthTime: "08:00" }) })]);
  const topCards = await Promise.all(["rising", "sun", "moon"].map(body =>
    portrait.locator(`[data-placement="${body}"]`).boundingBox()));
  expect(topCards[0]!.x).toBeLessThan(topCards[1]!.x);
  expect(topCards[1]!.x).toBeLessThan(topCards[2]!.x);
  for (const card of topCards) expect(card!.width).toBeLessThan(page.viewportSize()!.width * 0.4);
  const screen = page.getByTestId("astrology-screen");
  const horizontalOverflow = () => screen.evaluate(el => el.scrollWidth - el.clientWidth);
  expect(await horizontalOverflow()).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath("approved-zodiac.png") });
  const dock = await page.getByRole("navigation", { name: "App", exact: true }).boundingBox();
  const cardBottom = await portrait.locator("[data-placement]").evaluateAll(cards =>
    Math.max(...cards.map(card => card.getBoundingClientRect().bottom)));
  expect(cardBottom).toBeLessThanOrEqual(dock!.y);

  const readPortrait = portrait.getByRole("button", { name: "Read my portrait", exact: true });
  const trail = readPortrait.locator(".zodiac-portrait-cta-trail");
  await expect(trail).toHaveCSS("animation-name", "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(trail).toHaveCSS("animation-name", "zodiac-portrait-border-flow");
  const trailDistance = () => trail.evaluate(el => getComputedStyle(el).offsetDistance);
  const startingDistance = await trailDistance();
  await expect.poll(trailDistance).not.toBe(startingDistance);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(trail).toHaveCSS("animation-name", "none");
  await readPortrait.click();
  const portraitDetails = page.getByRole("dialog", { name: "Your zodiac portrait" });
  await expect(portraitDetails).toContainText("Aquarius");
  await portraitDetails.getByRole("button", { name: "Close", exact: true }).click();
  await expect(nav.getByRole("button", { name: "Zodiac", exact: true })).toHaveAttribute("aria-pressed", "true");

  await portrait.getByRole("button", { name: /Sun.*Aquarius/i }).click();
  await expect(page).toHaveURL(/tab=chart.*body=sun/);
  const placement = page.getByRole("dialog", { name: "Sun · Aquarius" });
  await expect(placement).toBeVisible();
  await expect(placement).toContainText("21.83°");
  await placement.getByRole("button", { name: "Close", exact: true }).click();
  await expect(nav.getByRole("button", { name: "My Chart", exact: true })).toHaveAttribute("aria-pressed", "true");

  const wheel = page.getByTestId("astro-wheel");
  const detailsButton = page.getByRole("button", { name: /^Chart details/ });
  await expect(wheel).toBeVisible();
  await expect(detailsButton).toBeVisible();
  expect((await wheel.boundingBox())!.y).toBeLessThan((await detailsButton.boundingBox())!.y);
  await expect(page.getByRole("heading", { name: "Symbol guide", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Aspects", exact: true })).toHaveCount(0);
  await expect(wheel.locator(".astro-aspect-line")).toHaveCount(3);
  expect(await horizontalOverflow()).toBeLessThanOrEqual(1);
  await wheel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("approved-natal-wheel.png") });

  await detailsButton.click();
  const parameters = page.getByRole("dialog", { name: "Chart details", exact: true });
  await expect(parameters).toBeVisible();
  const table = parameters.getByRole("table");
  await expect(table.getByRole("columnheader")).toHaveText(["Body", "Your placement", "House", "Rx"]);
  const sun = table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: /Sun$/ }) });
  await expect(sun.getByRole("cell").nth(0)).toContainText("Aquarius");
  await expect(sun.getByRole("cell").nth(0)).toContainText("21°50′");
  await expect(sun.getByRole("cell").nth(1)).toHaveText("12");
  await expect(table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: /Jupiter$/ }) }).getByRole("cell").last()).toHaveText("Rx");
  expect(await parameters.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath("approved-chart-planets.png") });

  await parameters.getByRole("button", { name: "Asteroids & points", exact: true }).click();
  const chiron = table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: /Chiron$/ }) });
  await expect(chiron.getByRole("cell").nth(0)).toContainText("Capricorn");
  await expect(chiron.getByRole("cell").nth(1)).toHaveText("10");
  const juno = table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: /Juno$/ }) });
  await expect(juno.getByRole("cell").nth(0)).not.toContainText(/[°]/);
  await page.screenshot({ path: info.outputPath("approved-chart-asteroids.png") });

  await parameters.getByRole("button", { name: "Planets & angles", exact: true }).click();
  await expect(sun).toBeVisible();
  await parameters.getByRole("button", { name: "Back to My Chart", exact: true }).click();
  await expect(parameters).toHaveCount(0);
  await expect(detailsButton).toBeFocused();
  expect(requests).toHaveLength(1);

  await page.getByRole("button", { name: /^The space between you/ }).click();
  await expect(nav.getByRole("button", { name: "Together", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/tab=together/);
  await expect(page.getByRole("button", { name: "Explore the connection", exact: true })).toBeVisible();
});

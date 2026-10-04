import { expect, test, type Locator, type Page, type TestInfo } from "./fixtures";
import { ME_COPY } from "../src/modules/me/meCopy";
import { QUALITY_COPY } from "../src/lib/qualityCopy";

type Language = keyof typeof ME_COPY;
const languages: Language[] = ["en", "zh", "es", "ja", "ko"];
const owner = "me-redesign-fictional-owner";
const profile = {
  anonId: owner, name: "Alexandra — fictional reader", birthDate: "1995-05-15", birthTime: "10:20",
  birthPlace: "Chicago, Illinois, United States", latitude: 41.87, longitude: -87.62,
  timezone: "America/Chicago", timezoneOffset: -5,
  createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z",
};

async function seed(page: Page, language: Language = "en", theme = "bright", details = profile) {
  await page.addInitScript(({ language, theme, owner, details }) => {
    // Keep the modified fictional profile and settings on reload; never seed real data.
    if (localStorage.getItem("me-redesign-fixture-seeded")) return;
    localStorage.setItem("me-redesign-fixture-seeded", "1");
    localStorage.setItem("hint_anon_id", owner);
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_launch_seen_v2", "1");
    localStorage.setItem("hint-language", language);
    localStorage.setItem("hint-theme", theme);
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: false, soundAndHaptics: false }));
    localStorage.setItem(`hint_profile_v2_${owner}`, JSON.stringify(details));
    localStorage.setItem(`hint_device_session_v1:${owner}`, JSON.stringify({ token: "isolated-fixture-token-000000000000000000000000000000", ownerId: "isolated-server-owner", expiresAt: "2099-01-01T00:00:00Z" }));
  }, { language, theme, owner, details });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // fixtures.ts also blocks every unmocked API for this isolated context.
  await page.route("**/api/profile**", route => route.fulfill({ json: details }));
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().iterations ?? Infinity)).map(animation => animation.finished));
  });
}

async function reachable(control: Locator) {
  await expect(control).toBeVisible();
  await control.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
  const metrics = await control.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const points = [[rect.x + rect.width / 2, rect.y + rect.height / 2], [rect.x + 4, rect.y + rect.height / 2], [rect.right - 4, rect.y + rect.height / 2], [rect.x + rect.width / 2, rect.top + 4], [rect.x + rect.width / 2, rect.bottom - 4]];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Node | null; let outside = false;
    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange(); range.selectNode(node);
      outside ||= [...range.getClientRects()].some(line => line.left < rect.left - 1 || line.right > rect.right + 1 || line.top < rect.top - 1 || line.bottom > rect.bottom + 1);
    }
    return { width: rect.width, height: rect.height, hit: points.every(([x, y]) => element.contains(document.elementFromPoint(x, y))), outside };
  });
  expect(metrics.width, "Touch target width").toBeGreaterThanOrEqual(44);
  expect(metrics.height, "Touch target height").toBeGreaterThanOrEqual(44);
  expect(metrics.hit, "Control center and edge centers remain actionable").toBe(true);
  expect(metrics.outside, "Complete control text stays inside its hitbox").toBe(false);
}

async function assertContentWidth(page: Page) {
  const overflow = await page.locator(".me-page").evaluate(root => {
    const outer = root.getBoundingClientRect();
    return [...root.querySelectorAll<HTMLElement>("h1,h2,h3,p,dt,dd,.me-link-copy,.me-row-copy,.me-setting-label,summary,button,a")]
      .filter(element => element.getClientRects().length)
      .flatMap(element => {
        const rect = element.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(element);
        // scrollWidth includes the clipped, invisible sparkle pseudo-element.
        // DOM ranges measure actual content, so check it against both its own
        // control/text container and the phone frame instead of that decoration.
        const textOutside = [...range.getClientRects()].some(line =>
          line.left < outer.left - 1 || line.right > outer.right + 1 ||
          line.left < rect.left - 1 || line.right > rect.right + 1);
        return rect.left < outer.left - 1 || rect.right > outer.right + 1 || textOutside
          ? [{ text: element.textContent?.trim().slice(0, 90), width: rect.width, contentOutside: textOutside }] : [];
      });
  });
  expect(overflow, "No visible text or controls exceed the phone content frame").toEqual([]);
}

async function capturePositions(page: Page, info: TestInfo, label: string) {
  const scroll = page.locator(".hint-app-scroll").last();
  for (const [position, fraction] of [["top", 0], ["middle", .5], ["bottom", 1]] as const) {
    await scroll.evaluate((element, fraction) => { element.scrollTop = (element.scrollHeight - element.clientHeight) * fraction; }, fraction);
    await settle(page);
    await page.screenshot({ path: info.outputPath(`${label}-${position}.png`) });
  }
  const footer = await page.locator(".me-footer").boundingBox();
  const dock = await page.locator("[data-app-tabbar]").boundingBox();
  expect(footer, "Last page content exists").not.toBeNull();
  expect(footer!.y, "Footer is inside the reachable scroll viewport").toBeGreaterThanOrEqual(0);
  expect(footer!.y + footer!.height, "The complete footer clears the navigation").toBeLessThanOrEqual(dock?.y ?? page.viewportSize()!.height);
}

async function expandDeviceAndHelp(page: Page, language: Language) {
  const copy = ME_COPY[language];
  const localProfiles = page.locator(".me-device-content > details").filter({ has: page.locator("summary").filter({ hasText: QUALITY_COPY[language]["quality.localProfiles"] }) });
  await reachable(localProfiles.locator("summary"));
  await localProfiles.locator("summary").click();
  await reachable(localProfiles.getByRole("button", { name: QUALITY_COPY[language]["quality.newLocalProfile"], exact: true }));
  await expect(page.locator(".me-beta-note")).toHaveText(copy.beta);

  const access = page.locator(".me-access");
  await reachable(access.locator("summary")); await access.locator("summary").click();
  for (const [name, href] of [[copy.create, "/app/signup"], [copy.open, "/app/login?mode=login"]]) {
    const link = access.getByRole("link", { name });
    await reachable(link); await expect(link).toHaveAttribute("href", new RegExp(href.replace("?", "\\?") + "$"));
  }
  const history = page.locator(".me-data-disclosure");
  await expect(history).not.toHaveAttribute("open", "");
  await reachable(history.locator("summary")); await history.locator("summary").click();
  const clear = page.getByTestId("button-clear-history");
  await reachable(clear); await expect(clear).toContainText(copy.clearDetail);

  const help = page.locator(".me-help");
  await reachable(help.locator("summary")); await help.locator("summary").click();
  for (const route of ["about", "contact", "privacy", "terms", "disclaimer"]) {
    const link = help.locator(`a[href$="/${route}"]`);
    await reachable(link); await expect(link.locator("strong")).not.toBeEmpty();
  }
}

// Ten locale/theme definitions run on both configured phone projects: 20 combinations.
for (const language of languages) for (const theme of ["bright", "dark"]) {
  test(`Me redesign ${language} ${theme}: layout, preferences and disclosures`, async ({ page }, info) => {
    test.setTimeout(90_000);
    await seed(page, language, theme);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const copy = ME_COPY[language];
    await page.goto("/app/me?hintPreview=embedded");
    await expect(page).toHaveURL(/\/app\/profile/);
    await expect(page.locator(".me-heading h1")).toHaveText(copy.title);
    await expect(page.locator(".me-identity-name")).toHaveText(profile.name);
    await expect(page.locator(".me-birth-summary dd").last()).toHaveText(profile.birthPlace);
    await settle(page);
    await capturePositions(page, info, `me-${language}-${theme}`);
    await reachable(page.getByTestId("button-edit-profile"));
    for (const [space, href] of [["chart", "/app/astrology?tab=chart"], ["history", "/app/readings"], ["collection", "/app/collection"]]) {
      const link = page.locator(`.me-personal-link[data-space="${space}"]`);
      await reachable(link); await expect(link).toHaveAttribute("href", new RegExp(href.replace("?", "\\?") + "$"));
    }

    const alternate = theme === "bright" ? "dark" : "bright";
    const themeButton = page.locator(`.me-theme-button[data-theme="${alternate}"]`);
    await reachable(themeButton); await themeButton.click();
    await expect(themeButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".me-page")).toHaveCSS("--me-ink", alternate === "dark" ? "#f3e9ed" : "#473542");
    await page.locator(`.me-theme-button[data-theme="${theme}"]`).click();

    const switches = page.locator(".me-preferences").getByRole("switch");
    await expect(switches).toHaveCount(2);
    for (const control of await switches.all()) { await reachable(control); await control.click(); await expect(control).toHaveAttribute("aria-checked", "true"); }
    await expect(page.locator(".me-page")).toHaveAttribute("data-reduced-motion", "true");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("hint.preferences.v1")!))).toMatchObject({ reduceMotion: true, soundAndHaptics: true });

    const languageButton = page.locator(".me-preferences").getByTestId("button-language-toggle");
    await reachable(languageButton); await languageButton.click();
    const menu = page.getByRole("listbox");
    await expect(menu).toBeVisible(); await expect(menu.getByRole("option")).toHaveCount(5);
    for (const option of await menu.getByRole("option").all()) { await expect(option).toBeInViewport(); await reachable(option); }
    await page.screenshot({ path: info.outputPath(`me-${language}-${theme}-languages.png`) });
    await page.keyboard.press("End"); await expect(menu.getByRole("option").last()).toBeFocused();
    await page.keyboard.press("Escape"); await expect(menu).toHaveCount(0); await expect(languageButton).toBeFocused();
    await languageButton.click(); await menu.locator('[aria-selected="true"]').click(); await expect(menu).toHaveCount(0);

    await expandDeviceAndHelp(page, language);
    await assertContentWidth(page);
    await capturePositions(page, info, `me-${language}-${theme}-expanded`);
    // These reversible settings survive a fresh mount without a profile/API mutation.
    await page.reload();
    await expect(page.locator(".me-identity-name")).toHaveText(profile.name);
    await expect(page.locator(".me-page")).toHaveAttribute("data-reduced-motion", "true");
    expect(await page.evaluate(() => localStorage.getItem("hint-language"))).toBe(language);
    expect(errors).toEqual([]);
  });
}

test("Me editor retains failed local saves, retries, and returns focus on cancel", async ({ page }, info) => {
  await seed(page);
  let saves = 0;
  await page.route("**/api/profile**", route => {
    if (route.request().method() === "POST") {
      saves++;
      return route.fulfill({ json: { ...profile, ...route.request().postDataJSON(), updatedAt: new Date().toISOString() } });
    }
    return route.fulfill({ json: profile });
  });
  await page.goto("/app/profile?hintPreview=embedded");
  const edit = page.getByTestId("button-edit-profile");
  await edit.click(); await expect(page.locator("#me-edit-heading")).toBeFocused();
  const name = page.getByTestId("input-name");
  await name.fill("Mira — a retained fictional edit");
  await page.getByTestId("input-birthdate").fill("20000229");
  await page.getByTestId("input-birthtime").fill("");
  await page.getByTestId("input-birthplace").fill("Wellington, Aotearoa New Zealand");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).__restoreMeStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith("hint_birth_profile_v3:") || key.startsWith("hint_profile_v2_")) throw new DOMException("Isolated full storage", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  const save = page.getByTestId("button-save-profile");
  await reachable(save); await save.click();
  await expect(page.getByRole("alert")).toContainText("Could not save your birth details");
  await expect(name).toHaveValue("Mira — a retained fictional edit");
  await expect(page.getByTestId("input-birthdate")).toHaveValue("2000-02-29");
  await expect(page.getByTestId("input-birthtime")).toHaveValue("");
  expect(saves, "Storage failure does not claim a server save").toBe(0);
  expect(await page.evaluate(owner => JSON.parse(localStorage.getItem(`hint_profile_v2_${owner}`)!).name, owner)).toBe(profile.name);
  await page.screenshot({ path: info.outputPath("me-edit-storage-failure.png") });

  await page.evaluate(() => (window as any).__restoreMeStorage());
  await save.click();
  await expect(page.locator(".me-identity-name")).toHaveText("Mira — a retained fictional edit");
  await expect(page.locator(".me-save-status")).toHaveAttribute("data-status", "synced");
  await expect(edit).toBeFocused(); expect(saves).toBe(1);
  const saved = await page.evaluate(owner => JSON.parse(localStorage.getItem(`hint_profile_v2_${owner}`)!), owner);
  expect(saved.birthTime).toBeNull(); expect(saved.latitude).toBeNull(); expect(saved.longitude).toBeNull(); expect(saved.timezone).toBeNull();
  await edit.click(); await name.fill("Discard this unsaved edit");
  const cancel = page.getByRole("button", { name: "Cancel", exact: true });
  await reachable(cancel); await cancel.click();
  await expect(edit).toBeFocused(); await expect(page.locator(".me-identity-name")).toHaveText("Mira — a retained fictional edit");
  expect(saves).toBe(1);
  await page.reload(); await expect(page.locator(".me-identity-name")).toHaveText("Mira — a retained fictional edit");
  await edit.click(); await expect(page.getByTestId("input-birthtime")).toHaveValue("");
  await page.getByRole("button", { name: ME_COPY.en.back, exact: true }).click(); await expect(edit).toBeFocused();
});

test("Me editor identifies an offline save as local and keeps it after reload", async ({ page }) => {
  await seed(page);
  await page.route("**/api/profile**", route => route.fulfill({ status: 503, json: { error: "ISOLATED_OFFLINE" } }));
  await page.goto("/app/profile?hintPreview=embedded");
  await page.getByTestId("button-edit-profile").click();
  await page.getByTestId("input-name").fill("Mira — locally saved fictional reader");
  await page.getByTestId("button-save-profile").click();
  await expect(page.locator(".me-identity-name")).toHaveText("Mira — locally saved fictional reader");
  await expect(page.locator(".me-save-status")).toHaveAttribute("data-status", "local");
  await expect(page.locator(".me-save-status")).toHaveText(QUALITY_COPY.en["quality.savedLocal"]);
  await page.reload();
  await expect(page.locator(".me-identity-name")).toHaveText("Mira — locally saved fictional reader");
  await expect(page.locator(".me-save-status")).toHaveAttribute("data-status", "local");
});

test("Me Spanish SE 200% text retains long names, places and expanded details", async ({ page }, info) => {
  test.skip(info.project.name !== "iphone-se", "200% text stress is targeted at the smaller phone; both sizes cover all locales and themes above.");
  test.setTimeout(90_000);
  const longName = "MaríaAlexandraFernándezDelValle".repeat(3);
  const longPlace = "San Cristóbal de las Casas, Chiapas — https://fictional.example/" + "longbirthplace".repeat(6);
  await seed(page, "es", "bright", { ...profile, name: longName, birthPlace: longPlace });
  await page.goto("/app/profile?hintPreview=embedded");
  await expect(page.locator(".me-identity-name")).toHaveText(longName); await settle(page);
  // Text-only web reflow: this is not a substitute for physical iOS Dynamic Type.
  await page.locator(".me-page, [data-app-tabbar]").evaluateAll(roots => {
    const elements = roots.flatMap(root => [...root.querySelectorAll<HTMLElement>("p,h1,h2,h3,strong,span,summary,button,a,dt,dd,input")]).filter(element => !element.closest("svg"));
    const sizes = elements.map(element => [element, parseFloat(getComputedStyle(element).fontSize)] as const);
    for (const [element, size] of sizes) element.style.fontSize = `${size * 2}px`;
  });
  await assertContentWidth(page);
  await capturePositions(page, info, "me-es-200text");
  await reachable(page.getByTestId("button-edit-profile"));
  await expandDeviceAndHelp(page, "es");
  await assertContentWidth(page);
  await capturePositions(page, info, "me-es-200text-expanded");
  await expect(page.locator(".me-identity-name")).toHaveText(longName);
  await expect(page.locator(".me-birth-summary dd").last()).toHaveText(longPlace);
});

for (const reopen of [false, true]) {
  test(`Me delayed save preserves ${reopen ? "a reopened editor" : "newer input in the current editor"} and its focus`, async ({ page }) => {
    await seed(page);
    let releaseFirstSave!: () => void;
    const submittedNames: string[] = [];
    await page.route("**/api/profile**", async route => {
      if (route.request().method() !== "POST") return route.fulfill({ json: profile });
      const input = route.request().postDataJSON();
      submittedNames.push(input.name);
      if (submittedNames.length === 1) await new Promise<void>(resolve => { releaseFirstSave = resolve; });
      return route.fulfill({ json: { ...profile, ...input, updatedAt: new Date().toISOString() } });
    });
    await page.goto("/app/profile?hintPreview=embedded");
    const edit = page.getByTestId("button-edit-profile");
    const name = page.getByTestId("input-name");
    const save = page.getByTestId("button-save-profile");
    const firstName = "Mira — fictional submitted version A";
    const newerName = "Mira — fictional newer draft B";
    await edit.click(); await name.fill(firstName); await save.click();
    await expect.poll(() => Boolean(releaseFirstSave)).toBe(true);
    await expect(save).toBeDisabled();
    if (reopen) {
      await page.getByRole("button", { name: ME_COPY.en.back, exact: true }).click();
      await expect(page.locator(".me-identity-name")).toHaveText(firstName);
      await edit.click();
      await expect(page.locator("#me-edit-heading")).toBeFocused();
      await expect(name).toHaveValue(firstName);
    }
    await name.fill(newerName); await expect(name).toBeFocused();
    releaseFirstSave();
    // Enabled save proves the delayed mutation completed. Its completion must
    // neither dismiss this editor nor restore A over the newer unsaved B input.
    await expect(save).toBeEnabled();
    await expect(name).toHaveValue(newerName); await expect(name).toBeFocused();
    await expect(page.locator("#me-edit-heading")).toBeVisible();
    expect(submittedNames).toEqual([firstName]);
    expect(await page.evaluate(owner => JSON.parse(localStorage.getItem(`hint_profile_v2_${owner}`)!).name, owner)).toBe(firstName);
    await save.click();
    await expect(page.locator(".me-identity-name")).toHaveText(newerName);
    await expect(page.locator(".me-save-status")).toHaveAttribute("data-status", "synced");
    await expect(edit).toBeFocused();
    expect(submittedNames).toEqual([firstName, newerName]);
    await page.reload(); await expect(page.locator(".me-identity-name")).toHaveText(newerName);
  });
}

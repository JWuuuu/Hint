import { test, expect } from "./fixtures";
import {
  installLetters,
  letterOwner,
  letterSynastry,
} from "./astrology-reports.fixture";
import { rt } from "../src/modules/astrology/reportCopy";
const goReport = async (page: import("./fixtures").Page) => {
  await page.goto("/app/astrology?hintPreview=embedded&tab=chart");
  await expect(page.getByTestId("astro-wheel")).toBeVisible();
  await page
    .getByRole("button", { name: "Read the full report", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Your birth chart, unfolded/ })
    .click();
  await expect(page.getByTestId("celestial-report")).toBeVisible();
};
test("report evidence keeps long titles and explanations reachable at 200 percent text", async ({
  page,
}, info) => {
  await installLetters(page);
  await page.addInitScript((owner) => {
    const key = `hint_birth_profile_v3:${owner}`;
    const profile = JSON.parse(localStorage.getItem(key) || "null");
    if (profile) {
      profile.name = "Alexandra Celestial Moonlight ".repeat(4).trim();
      localStorage.setItem(key, JSON.stringify(profile));
    }
  }, letterOwner);
  await goReport(page);
  await page
    .locator("#letter-overview")
    .getByRole("button", { name: "See this in the chart" })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.evaluate((root) => {
    const sizes = [...root.querySelectorAll<HTMLElement>("h2,h3,p,button,span")]
      .filter((el) => !el.closest("svg"))
      .map((el) => [el, parseFloat(getComputedStyle(el).fontSize)] as const);
    sizes.forEach(([el, size]) => {
      el.style.fontSize = `${size * 2}px`;
    });
  });
  await dialog.evaluate(async (el) => {
    await Promise.allSettled(
      el.getAnimations().map((animation) => animation.finished),
    );
  });
  await page.screenshot({ path: info.outputPath("report-evidence-200.png") });
  const scroll = dialog.locator(".astro-dialog-scroll");
  expect(await scroll.evaluate((el) => el.clientHeight)).toBeGreaterThanOrEqual(
    96,
  );
  await scroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const last = scroll.locator("p").last();
  const lastBox = (await last.boundingBox())!,
    dialogBox = (await dialog.boundingBox())!;
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(
    dialogBox.y + dialogBox.height,
  );
  expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
test("natal letters save once, restore offline and retain exact snapshot evidence", async ({
  page,
}) => {
  await installLetters(page);
  await goReport(page);
  await expect(page.locator(".astro-letter-chapter")).toHaveCount(8);
  await page
    .getByRole("button", { name: "Save this letter", exact: true })
    .dblclick();
  await expect(
    page.getByRole("button", { name: "Saved on this device", exact: true }),
  ).toBeDisabled();
  const evidence = page
    .locator("#letter-overview")
    .getByRole("button", { name: "See this in the chart" })
    .first();
  await evidence.click();
  await expect(page.getByRole("dialog")).toContainText("29.9999°");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(evidence).toBeFocused();
  await page
    .getByRole("button", { name: "Your celestial letters", exact: true })
    .click();
  const saved = page.getByTestId("saved-letters");
  await expect(saved.locator(".astro-letter-list > button")).toHaveCount(1);
  await saved.locator(".astro-letter-list > button").click();
  const url = page.url();
  expect(new URL(url).searchParams.get("report")).not.toBe("current");
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 503, json: { error: "OFFLINE" } }),
  );
  await page.reload();
  await expect(page.getByTestId("celestial-report")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Saved on this device", exact: true }),
  ).toBeDisabled();
  await page
    .locator("#letter-overview")
    .getByRole("button", { name: "See this in the chart" })
    .first()
    .click();
  await page.reload();
  await expect(page.getByRole("dialog")).toContainText("29.9999°");
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/body=/);
  await page.goto("/app/readings?hintPreview=embedded");
  await page.getByRole("button", { name: /Astrology/ }).click();
  await expect(page.getByTestId("saved-letters").getByRole("link")).toHaveCount(
    1,
  );
});
test("storage failure keeps the report readable and retry persists it", async ({
  page,
}) => {
  await installLetters(page);
  await goReport(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as any).restoreLetterStorage = () => {
      IDBObjectStore.prototype.put = original;
    };
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page
    .getByRole("button", { name: "Save this letter", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("could not be saved");
  await expect(page.locator(".astro-letter-chapter")).toHaveCount(8);
  await page.evaluate(() => (window as any).restoreLetterStorage());
  await page
    .getByRole("alert")
    .getByRole("button", { name: "Try again" })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved on this device", exact: true }),
  ).toBeDisabled();
});
test("history deletion hides reports immediately and cannot resurrect them on refresh", async ({
  page,
}) => {
  await installLetters(page);
  await goReport(page);
  await page
    .getByRole("button", { name: "Save this letter", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved on this device" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Your celestial letters", exact: true })
    .click();
  await page.getByTestId("saved-letters").locator("button").click();
  const url = page.url();
  await page.evaluate((owner) => {
    localStorage.setItem(
      `hint_history_clear_version_v1:${owner}`,
      "deleted-generation",
    );
    window.dispatchEvent(new Event("storage"));
  }, letterOwner);
  await expect(page.getByTestId("celestial-report")).toHaveCount(0);
  await page.goto(url);
  await expect(page.getByTestId("celestial-report")).toHaveCount(0);
  await expect(page.getByTestId("saved-letters")).toContainText(
    "Letters you save will be here",
  );
});
test("two-person charts expose every cross aspect, individual points and a saved relationship letter", async ({
  page,
}) => {
  await installLetters(page);
  await page.goto("/app/astrology?hintPreview=embedded&tab=together");
  await page.getByRole("checkbox").check();
  const form = page.locator("form");
  await form.getByLabel("Name", { exact: true }).fill("Beatrice");
  await form.getByLabel("Birth date", { exact: true }).fill("1993-07-02");
  await form.getByLabel("Birth time", { exact: true }).fill("08:30");
  await form.getByLabel("Birth place", { exact: true }).fill("Tokyo");
  await form.getByText("Advanced location data", { exact: true }).click();
  for (const [label, value] of [
    ["Latitude", "35.67"],
    ["Longitude", "139.65"],
    ["Timezone", "Asia/Tokyo"],
    ["Timezone offset", "9"],
  ])
    await form.getByLabel(label, { exact: true }).fill(value);
  await page
    .getByRole("button", { name: "Explore the connection", exact: true })
    .click();
  const result = page.getByTestId("together-result");
  await expect(result.getByTestId("synastry-wheel")).toBeVisible();
  await result
    .getByRole("button", { name: "Enlarge chart", exact: true })
    .click();
  const zoom = page.getByRole("dialog");
  await expect(zoom.locator(".astro-placement-list > button")).toHaveCount(22);
  await zoom.getByRole("button", { name: /Beatrice.*Sun/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Beatrice");
  await page.keyboard.press("Escape");
  await result
    .getByRole("button", { name: "All connections", exact: true })
    .click();
  const connections = result.locator("details .astro-placement-list > button");
  await expect(connections).toHaveCount(letterSynastry.aspects.length);
  await connections.first().click();
  await expect(page.getByRole("dialog")).toContainText("Alexandra");
  await expect(page.getByRole("dialog")).toContainText("Beatrice");
  await expect(page.getByRole("dialog")).toContainText("Angular separation");
  await page.keyboard.press("Escape");
  await result
    .locator(".astro-chart-modes")
    .getByRole("button", { name: /Alexandra/ })
    .click();
  await result
    .getByTestId("astro-wheel")
    .getByRole("button", { name: /Sun/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("29.9999°");
  await page.keyboard.press("Escape");
  await result
    .getByRole("button", { name: "Read the full report", exact: true })
    .click();
  await expect(result.getByTestId("celestial-report")).toBeVisible();
  await result
    .getByRole("button", { name: "Save this letter", exact: true })
    .click();
  await expect(
    result.getByRole("button", { name: "Saved on this device", exact: true }),
  ).toBeDisabled();
  await form.getByLabel("Name", { exact: true }).fill("Another person");
  await expect(page.getByTestId("together-result")).toHaveCount(0);
  await page.goto("/app/astrology?hintPreview=embedded&tab=reports");
  await page
    .getByTestId("saved-letters")
    .locator(".astro-letter-list > button")
    .click();
  await expect(page.locator(".astro-letter-recipient")).toContainText(
    "Alexandra & Beatrice",
  );
});
test("switching local identity cannot open another profile's saved report", async ({
  page,
}) => {
  await installLetters(page);
  await goReport(page);
  await page
    .getByRole("button", { name: "Save this letter", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved on this device" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Your celestial letters", exact: true })
    .click();
  await page.getByTestId("saved-letters").locator("button").click();
  const url = page.url();
  await page.evaluate(() => {
    localStorage.setItem("hint_anon_id", "another-fictional-owner");
    localStorage.setItem("hint_identity_generation_v1", "switched-owner");
    window.dispatchEvent(new Event("storage"));
  });
  await page.goto(url);
  await expect(page.getByTestId("celestial-report")).toHaveCount(0);
  await expect(page.getByTestId("saved-letters")).toContainText(
    "Letters you save will be here",
  );
});

test("clearing history commits before deleting stored letters and keeps birth details", async ({
  page,
}) => {
  await installLetters(page);
  await goReport(page);
  await page
    .getByRole("button", { name: "Save this letter", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved on this device" }),
  ).toBeDisabled();
  let fail = true;
  await page.route("**/api/history**", (route) =>
    route.fulfill({
      status: fail ? 503 : 200,
      json: fail ? { error: "OFFLINE" } : { success: true },
    }),
  );
  const count = () =>
    page.evaluate(
      () =>
        new Promise<number>((resolve, reject) => {
          const request = indexedDB.open("hint-celestial-letters-v1", 1);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("letters", "readonly"),
              query = tx.objectStore("letters").count();
            tx.oncomplete = () => {
              db.close();
              resolve(query.result);
            };
            tx.onerror = () => reject(tx.error);
          };
          request.onerror = () => reject(request.error);
        }),
    );
  await page.goto("/app/me?hintPreview=embedded");
  await page.locator(".me-data-disclosure > summary").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Clear Local History/ }).click();
  await expect(
    page.locator(".me-data-disclosure").getByRole("alert"),
  ).toBeVisible();
  expect(await count()).toBe(1);
  fail = false;
  page.once("dialog", (dialog) => dialog.accept());
  const reload = page.waitForEvent("framenavigated", frame => frame === page.mainFrame());
  await page
    .locator(".me-data-disclosure")
    .getByRole("button", { name: "Retry", exact: true })
    .click();
  await reload;
  await page.waitForLoadState("load");
  await expect(page.locator(".me-data-disclosure > summary")).toBeVisible();
  await expect.poll(count).toBe(0);
  const retained = await page.evaluate(
    (owner) => ({
      owner: localStorage.getItem("hint_anon_id"),
      profile: localStorage.getItem(`hint_birth_profile_v3:${owner}`),
      language: localStorage.getItem("hint-language"),
      preferences: localStorage.getItem("hint.preferences.v1"),
    }),
    letterOwner,
  );
  expect(retained.owner).toBe(letterOwner);
  expect(retained.profile).toContain("Alexandra");
  expect(retained.language).toBe("en");
  expect(retained.preferences).not.toBeNull();
  await page.goto("/app/astrology?hintPreview=embedded&tab=reports");
  await expect(page.getByTestId("saved-letters")).toContainText(
    "Letters you save will be here",
  );
});
for (const language of ["en", "zh", "es", "ja", "ko"] as const)
  test(`illustrated report ${language} retains readable sections at large text`, async ({
    page,
  }, info) => {
    await installLetters(page, language, "dark", true, true);
    await page.goto("/app/astrology?hintPreview=embedded&tab=signs");
    await expect(page.locator(".astro-sign-choice img")).toHaveCount(12);
    await expect
      .poll(() =>
        page
          .locator(".astro-sign-choice img")
          .evaluateAll((images) =>
            images
              .slice(0, 4)
              .every((img) => (img as HTMLImageElement).naturalWidth > 0),
          ),
      )
      .toBe(true);
    await page.screenshot({ path: info.outputPath("gallery.png") });
    await page.goto("/app/astrology?hintPreview=embedded&tab=chart");
    await expect(page.getByTestId("astro-wheel")).toBeVisible();
    await page
      .getByRole("button", { name: rt(language, "open"), exact: true })
      .click();
    await page
      .getByRole("button", { name: new RegExp(rt(language, "natal")) })
      .click();
    await page.evaluate(() => {
      const elements = [
        ...document.querySelectorAll<HTMLElement>(
          ".astro-theme, .astro-theme *",
        ),
      ].filter((el) => !el.closest("svg"));
      const sizes = elements.map(
        (el) => [el, parseFloat(getComputedStyle(el).fontSize)] as const,
      );
      for (const [el, size] of sizes) el.style.fontSize = `${size * 2}px`;
    });
    await expect(page.getByTestId("celestial-report")).toBeVisible();
    await page.screenshot({ path: info.outputPath("report-top.png") });
    for (const index of [0, 3, 7]) {
      const chapter = page.locator(".astro-letter-chapter").nth(index);
      await chapter.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: info.outputPath(`report-chapter-${index}.png`),
      });
      const rect = await chapter.boundingBox();
      expect(rect!.width).toBeLessThanOrEqual(info.project.use.viewport!.width);
    }
    const action = page
      .locator(".astro-letter-chapter")
      .last()
      .getByRole("button")
      .last();
    await action.evaluate((el) =>
      el.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    const hit = await action.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        height: rect.height,
        width: rect.width,
        reachable: el.contains(
          document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          ),
        ),
      };
    });
    expect(hit.height).toBeGreaterThanOrEqual(44);
    expect(hit.width).toBeGreaterThanOrEqual(44);
    expect(hit.reachable).toBe(true);
    await action.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("dialog")
      .locator(".astro-dialog-scroll")
      .evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
    await page.screenshot({ path: info.outputPath("report-detail.png") });
    await page.keyboard.press("Escape");
    const last = page.locator(".astro-letter > details");
    await last.evaluate((el) =>
      el.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    const bottom = await last.boundingBox(),
      dock = await page.locator("[data-app-tabbar]").boundingBox();
    expect(bottom!.y + bottom!.height).toBeLessThanOrEqual(
      dock?.y ?? page.viewportSize()!.height,
    );
    await page.screenshot({ path: info.outputPath("report-bottom.png") });
  });

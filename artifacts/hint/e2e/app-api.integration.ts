// This suite intentionally DOES NOT import fixtures.ts: credentials and every
// private response come from the actual local Express API and disposable DB.
import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const { Pool } = require("pg");
const url = "postgresql://hint_test:isolated-test-only@127.0.0.1:55439/hint_quality";
if (process.env.HINT_APP_API_QA !== "1" || process.env.DATABASE_URL !== url) throw new Error("Real API tests require the guarded isolated runner.");
const pool = new Pool({ connectionString: url });
test.afterAll(async () => { await pool.end(); });

async function setup(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_launch_seen_v2", "1");
    localStorage.setItem("hint-language", "en");
    localStorage.setItem("hint-theme", "dark");
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
  });
  // Also prevent the browser itself from reaching any non-local services.
  await page.route("**/*", route => new URL(route.request().url()).origin === "http://127.0.0.1:5256" ? route.continue() : route.abort());
}
async function credentials(page: Page): Promise<{ ownerId: string; token: string }> {
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith("hint_device_session_v1:")))).toBe(true);
  return page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(key => key.startsWith("hint_device_session_v1:"))!)!));
}
async function saveProfile(page: Page, name: string) {
  await page.goto("/app/profile?hintPreview=embedded");
  await page.getByTestId("button-edit-profile").click();
  await page.getByTestId("input-name").fill(name);
  await page.getByTestId("input-birthdate").fill("20000229");
  await page.getByTestId("input-birthtime").fill("");
  await page.getByTestId("input-birthplace").fill("");
  await page.getByTestId("button-save-profile").click();
  await expect(page.locator(".me-save-status")).toHaveAttribute("data-status", "synced");
  return credentials(page);
}
async function rows(sql: string, owner: string) { return (await pool.query(sql, [owner])).rows; }

test("real API: profile, same daily card, note reload, failed clear rollback and successful clear fence", async ({ page }, info) => {
  await setup(page);
  const { ownerId } = await saveProfile(page, `Fictional ${info.project.name} Reader`);
  const [profile] = await rows("SELECT name, birth_date, birth_time, latitude, longitude FROM profiles WHERE anon_id=$1", ownerId);
  expect(profile).toMatchObject({ birth_date: "2000-02-29", birth_time: null, latitude: null, longitude: null });
  await page.goto("/app?hintPreview=embedded");
  await page.getByTestId("home-reveal-action").click();
  await expect(page.getByTestId("home-daily-reveal")).toBeVisible();
  await page.keyboard.press("Escape");
  const card = await page.locator(".hint-home-hero").getAttribute("data-daily-card-id");
  await expect.poll(async () => (await rows("SELECT assigned_card_id FROM daily_receipts WHERE anonymous_device_id=$1 AND feature_type='daily-card' AND opened_at IS NOT NULL", ownerId))[0]?.assigned_card_id).toBe(card);
  await page.goto("/app/daily?hintPreview=embedded");
  const note = page.getByTestId("input-pull-note");
  await note.fill("A fictional reflection that must survive reload.");
  await note.blur();
  await expect.poll(async () => (await rows("SELECT note FROM daily_pulls WHERE anon_id=$1", ownerId))[0]?.note).toBe("A fictional reflection that must survive reload.");
  await page.reload();
  await expect(note).toHaveValue("A fictional reflection that must survive reload.");
  expect((await rows("SELECT card_id FROM daily_pulls WHERE anon_id=$1", ownerId))[0].card_id).toBe(card);
  await page.goto("/app/profile?hintPreview=embedded");
  const localOwner = await page.evaluate(() => localStorage.getItem("hint_anon_id"));
  const triggerName = `qa_clear_${ownerId.replaceAll("-", "")}`;
  // A database failure, not an HTTP mock: the real transaction must roll back
  // its tombstone and receipt exclusion before the UI can retry safely.
  await pool.query(`CREATE FUNCTION ${triggerName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.anon_id = '${ownerId}' THEN RAISE EXCEPTION 'isolated clear failure'; END IF; RETURN OLD; END $$`);
  await pool.query(`CREATE TRIGGER ${triggerName} BEFORE DELETE ON daily_pulls FOR EACH ROW EXECUTE FUNCTION ${triggerName}()`);
  try {
    await page.locator(".me-data-disclosure > summary").click();
    page.on("dialog", dialog => dialog.accept());
    await page.getByTestId("button-clear-history").click();
    await expect(page.locator(".me-error")).toBeVisible();
    expect(await rows("SELECT note FROM daily_pulls WHERE anon_id=$1", ownerId)).toHaveLength(1);
    expect(await rows("SELECT owner_id FROM history_clears WHERE owner_id=$1", ownerId)).toHaveLength(0);
    expect((await rows("SELECT history_excluded FROM daily_receipts WHERE anonymous_device_id=$1 AND feature_type='daily-card'", ownerId))[0].history_excluded).toBe(false);
  } finally {
    await pool.query(`DROP TRIGGER ${triggerName} ON daily_pulls`);
    await pool.query(`DROP FUNCTION ${triggerName}()`);
  }
  await page.locator(".me-error").getByRole("button", { name: "Retry", exact: true }).click();
  await expect.poll(async () => (await rows("SELECT owner_id FROM history_clears WHERE owner_id=$1", ownerId)).length).toBe(1);
  // Reload reads the canonical local profile, so the truthful label is local.
  // The SQL assertion independently proves the server profile was preserved.
  await expect(page.locator(".me-save-status")).toHaveAttribute("data-status", "local");
  await expect(page.locator(".me-identity-name")).toHaveText(profile.name);
  expect((await rows("SELECT name, birth_date, birth_time, latitude, longitude FROM profiles WHERE anon_id=$1", ownerId))[0]).toEqual(profile);
  expect(await page.evaluate(() => localStorage.getItem("hint_anon_id"))).toBe(localOwner);
  await expect(page.locator("html")).toHaveAttribute("data-hint-theme", "dark");
  await page.goto("/app?hintPreview=embedded");
  await expect(page.locator(".hint-home-hero")).toHaveAttribute("data-daily-card-id", card!);
  // The retained daily lock exposes the existing result, not a new reveal.
  await page.getByTestId("home-reveal-trigger").click();
  await expect(page.getByTestId("home-daily-reveal")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/app/daily?hintPreview=embedded");
  await expect(note).toHaveValue("");
  expect(await rows("SELECT id FROM daily_pulls WHERE anon_id=$1", ownerId)).toHaveLength(0);
  expect((await rows("SELECT assigned_card_id, history_excluded FROM daily_receipts WHERE anonymous_device_id=$1 AND feature_type='daily-card'", ownerId))[0]).toMatchObject({ assigned_card_id: card, history_excluded: true });
  await info.attach("bridge-result", { body: JSON.stringify({ device: info.project.name, card, realProfile: true, realNote: true, rollback: true, deletionFence: true }), contentType: "application/json" });
});

test("real API: another device cannot read or overwrite a profile using its old anonymous ID", async ({ page, browser }, info) => {
  await setup(page);
  const first = await saveProfile(page, "Fictional First Reader");
  const context = await browser.newContext({ viewport: info.project.use.viewport, isMobile: true, hasTouch: true });
  try {
    const secondPage = await context.newPage(); await setup(secondPage);
    const second = await saveProfile(secondPage, "Fictional Second Reader");
    expect(second.ownerId).not.toBe(first.ownerId);
    const result = await secondPage.evaluate(async ({ token, victim }) => {
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      const get = await fetch(`/api/profile?anonId=${victim}`, { headers });
      const read = await get.json();
      const post = await fetch("/api/profile", { method: "POST", headers, body: JSON.stringify({ anonId: victim, name: "Fictional Own Update", birthDate: "2000-02-29" }) });
      const unauthenticated = await fetch(`/api/profile?anonId=${victim}`);
      return { readName: read.name, updateStatus: post.status, unauthenticatedStatus: unauthenticated.status };
    }, { token: second.token, victim: first.ownerId });
    expect(result).toEqual({ readName: "Fictional Second Reader", updateStatus: 200, unauthenticatedStatus: 401 });
    expect((await rows("SELECT name FROM profiles WHERE anon_id=$1", first.ownerId))[0].name).toBe("Fictional First Reader");
    expect((await rows("SELECT name FROM profiles WHERE anon_id=$1", second.ownerId))[0].name).toBe("Fictional Own Update");
  } finally { await context.close(); }
});

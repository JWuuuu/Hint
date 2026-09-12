import { test, expect, type Locator, type Page } from "./fixtures";

async function settled(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(animation => Number.isFinite(Number(animation.effect?.getTiming().iterations))).map(animation => animation.finished.catch(() => {})));
  });
}
async function usableTarget(control: Locator) {
  await control.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await expect.poll(() => control.evaluate(element => {
    const box = element.getBoundingClientRect();
    const front = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return front === element || element.contains(front);
  })).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint-language", "en");
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
  });
  await page.route("**/api/profile**", route => route.fulfill({ json: null }));
});

test("Login mode and method controls and Profile edit have reachable 44px targets", async ({ page }) => {
  await page.goto("/app/login?hintPreview=embedded");
  await settled(page);
  for (const name of ["Sign up", "Log in", "Email", "Phone"]) await usableTarget(page.getByRole("button", { name, exact: true }));
  await page.goto("/app/profile?hintPreview=embedded");
  await settled(page);
  await usableTarget(page.getByTestId("button-edit-profile"));
  await page.getByTestId("button-edit-profile").click();
  await expect(page.getByTestId("input-name")).toBeVisible();
  for (const id of ["input-name", "input-birthdate", "input-birthtime", "input-birthplace"]) {
    const field = page.getByTestId(id);
    await usableTarget(field);
    expect(await field.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  }
  const cancel = page.getByRole("button", { name: "Cancel", exact: true });
  await usableTarget(cancel);
  await cancel.click();
  await expect(page.getByTestId("button-edit-profile")).toBeVisible();
});

test("Ask text input and Send are at least 44px while long drafts can still grow", async ({ page }) => {
  await page.goto("/app/ask?hintPreview=embedded");
  await settled(page);
  const input = page.getByRole("textbox");
  await usableTarget(input);
  expect(await input.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  const initial = (await input.boundingBox())!.height;
  await input.fill("A fictional question\nwith another line\nand one more line\nto check the growing draft.");
  await expect.poll(async () => (await input.boundingBox())!.height).toBeGreaterThan(initial);
  await usableTarget(page.getByRole("button", { name: "Send", exact: true }));
  await input.fill("");
  await usableTarget(input);
});

test("Rooms preview checkbox uses its complete 44px label hit area", async ({ page }) => {
  await page.goto("/app/rooms?hintPreview=embedded");
  await settled(page);
  const checkbox = page.getByRole("checkbox");
  const label = checkbox.locator("..");
  await usableTarget(label);
  await expect(checkbox).not.toBeChecked();
  await label.click({ position: { x: 100, y: 22 } });
  await expect(checkbox).toBeChecked();
  await label.click({ position: { x: 100, y: 22 } });
  await expect(checkbox).not.toBeChecked();
});

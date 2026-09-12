import { expect, test, type Page } from "./fixtures";

async function seed(page: Page, spreadId?: string) {
  await page.addInitScript(({ spreadId }) => {
    const owner = "letter-layout-fictional";
    localStorage.setItem("hint_anon_id", owner);
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_launch_seen_v2", "1");
    localStorage.setItem("hint-language", "en");
    localStorage.setItem("hint-theme", "bright");
    if (spreadId) sessionStorage.setItem("hint_active_tarot_reading_v1", JSON.stringify({
      version: 1, savedAt: Date.now(), phase: "pick", question: "What deserves my attention?", spreadId, focusLabel: "Reflection",
      design: { id: "stars", label: "Star Field", mood: "Quiet", deckStyleId: "ivory", backStyle: "ivory",
        cardBackId: "01_Final_Eight_Set/05_Dawn_Gate_Ivory_Gold.png", cardArtId: "hint-card-2", backgroundId: "stars", background: "", glow: "" },
      selectedCards: [], revealedIds: [], deck: Array.from({ length: 78 }, (_, index) => ({
        visualId: "fiction-" + index, cardId: "0-fool", name: "The Fool", orientation: "upright",
        x: 0, y: 0, rotation: 0, rotate: 0, zIndex: index, selected: false, revealed: false,
      })),
    }));
  }, { spreadId });
}

for (const spread of ["single", "three", "relationship", "futureLover", "peachBlossom", "reconciliation", "trueHeart", "loveTree", "xRelationship"]) {
  test(`selected ${spread} layout has its own space above the complete card arc`, async ({ page }, info) => {
    await seed(page, spread);
    await page.goto("/app/tarot?hintPreview=embedded");
    await expect(page.getByRole("heading", { name: "Pick Cards" })).toBeVisible();
    const tray = page.getByTestId("tarot-pick-tray");
    await expect(tray).toBeVisible();
    await page.waitForTimeout(400);
    const geometry = await page.evaluate(() => {
      const tray = document.querySelector('[data-testid="tarot-pick-tray"]')!.getBoundingClientRect();
      const cards = [...document.querySelectorAll<HTMLElement>("button[data-visual-id]")].map(e => e.getBoundingClientRect())
        .filter(r => r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight);
      return { bottom: tray.bottom, tops: cards.map(r => r.top) };
    });
    expect(geometry.tops.length).toBeGreaterThan(3);
    for (const top of geometry.tops) expect(top).toBeGreaterThanOrEqual(geometry.bottom + 18);
    await page.screenshot({ path: info.outputPath(`pick-${spread}.png`) });
    const wheel = page.getByLabel("Rotating tarot deck wheel");
    await expect(wheel).toHaveAttribute("data-deck-size", "78");
    const card = page.locator("button[data-visual-id]").filter({ visible: true }).nth(3);
    // Keyboard picks the exact mounted identity without depending on tiny fan edges.
    await card.press("Enter"); await card.press("Enter");
    await expect(wheel).toHaveAttribute("data-deck-size", "77");
    await page.reload();
    await expect(wheel).toHaveAttribute("data-deck-size", "77");
  });
}

test("production preview switches phones without losing the current room or question", async ({ page }) => {
  await seed(page);
  await page.goto("/app/tarot?hintPreview=frame");
  const device = page.getByLabel("Preview device");
  await expect(device).toBeVisible();
  const phone = page.frameLocator("iframe");
  await phone.getByPlaceholder("Type your question...").fill("A letter I can return to");
  await device.selectOption("iphone-se");
  await expect(page.locator("iframe")).toHaveAttribute("title", "iPhone SE preview");
  await expect(phone.getByPlaceholder("Type your question...")).toHaveValue("A letter I can return to");
  await device.selectOption("iphone-17-pro-max");
  await expect(page.locator("iframe")).toHaveAttribute("title", "iPhone 17 Pro Max preview");
  await expect(phone.getByPlaceholder("Type your question...")).toHaveValue("A letter I can return to");
  // A link changes the embedded route without creating a second simulated frame.
  await phone.getByRole("link", { name: "Home", exact: true }).click();
  const leaveDialog = phone.getByRole("dialog", { name: "Leave this space?" });
  await expect(leaveDialog).toBeVisible();
  await expect(leaveDialog).toContainText("Your unfinished Tarot reading will reset.");
  await leaveDialog.getByRole("button", { name: "Stay here", exact: true }).click();
  await expect(leaveDialog).toHaveCount(0);
  await expect(phone.getByPlaceholder("Type your question...")).toHaveValue("A letter I can return to");
  await expect(page.locator("iframe")).toHaveCount(1);
  await phone.getByRole("link", { name: "Home", exact: true }).click();
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole("button", { name: "Leave and start fresh", exact: true }).click();
  await expect(phone.locator(".reference-home-crisp")).toBeVisible();
  await expect(phone.locator("iframe")).toHaveCount(0);
});

test("Me Tarot setup has a visible bounded entrance into the ready room", async ({ page }, info) => {
  await seed(page);
  await page.goto("/app/profile?hintPreview=embedded");
  const link = page.getByRole("link", { name: /Tarot room setup/ });
  await link.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    (window as any).letterEntrance = [];
    const started = performance.now();
    const inspectFrame = () => {
      const layer = document.querySelector('[data-room-entrance="tarot"]');
      if (layer) (window as any).letterEntrance.push({
        at: performance.now(), hasLoader: !!document.querySelector('[role="status"]')?.textContent?.includes("Opening the room"),
        markWidth: layer.querySelector(".hint-room-entrance-mark")?.getBoundingClientRect().width,
      });
      if (performance.now() - started < 2000) requestAnimationFrame(inspectFrame);
    };
    requestAnimationFrame(inspectFrame);
  });
  await link.click();
  await expect(page.getByRole("button", { name: "Save room", exact: true })).toBeVisible();
  await expect(page.locator("[data-room-entrance]")).toHaveCount(0);
  const records = await page.evaluate(() => (window as any).letterEntrance);
  expect(records.length).toBeGreaterThan(0);
  expect(records.some((r: any) => r.hasLoader)).toBe(false);
  await info.attach("Me-entry-observations", { body: JSON.stringify(records), contentType: "application/json" });
});

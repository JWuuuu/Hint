import { expect, test, type Page } from "./fixtures";
import { writeFile } from "node:fs/promises";

// Independent expected positions: these are part of each spread's user contract.
// Do not import app spread data or seed a pick/reading session: every card below
// must be selected through the real question -> setup -> ritual UI.
const spreads = [
  { id: "single", label: "One card", positions: ["The Message"], room: "stars" },
  { id: "three", label: "Three cards", positions: ["Past", "Present", "Next"], room: "dawn" },
  { id: "relationship", label: "Connection", positions: ["You", "Them", "Between"], room: "sea" },
  { id: "futureLover", label: "Future Lover", positions: ["Arrival", "Signal", "Pull", "Approach", "Challenge", "Gain", "Direction"], room: "stars" },
  { id: "peachBlossom", label: "Peach Blossom", positions: ["Appears", "Image", "Block", "Trend", "Gain"], room: "dawn" },
  { id: "reconciliation", label: "Reconciliation", positions: ["You now", "Them now", "Break", "Positive", "Barrier", "Future", "Advice"], room: "sea" },
  { id: "trueHeart", label: "True Heart", positions: ["Outer signal", "Inner feeling", "Block", "True view", "Future"], room: "stars" },
  { id: "loveTree", label: "Love Tree", positions: ["Root", "Trunk", "Environment", "Past", "Future", "Crown", "Fruit"], room: "dawn" },
  { id: "xRelationship", label: "X Relationship", positions: ["Root", "Cause", "You", "Them", "Obstacle", "Help", "Block", "Action", "Result"], room: "sea" },
] as const;

type DrawnCard = { visualId: string; cardId: string; name: string; orientation: "upright" | "reversed" };
type ReadingRequest = { question: string; spreadType: string; requiredCardCount: number; cards: Array<DrawnCard & { position: string }> };
type SavedReading = { id: string; spreadType: string; question: string; roomDesign: { backgroundId: string }; cards: Array<DrawnCard & { positionLabel: string }>; interpretationStatus: string; structuredReading: { overall_summary: string; cards: Array<{ position: string; card_name: string; orientation: string }> } };

async function archive(page: Page): Promise<SavedReading[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("hint_local_tarot_readings_v1") ?? "[]"));
}
function identity(cards: DrawnCard[]) {
  return cards.map(({ visualId, cardId, name, orientation }) => ({ visualId, cardId, name, orientation }));
}
async function chooseCard(page: Page) {
  // Existing wheel supports keyboard activation, avoiding a forced click on the
  // visually overlapping edge of the fan while still using its real handlers.
  await page.getByRole("button", { name: /Lift card/ }).first().press("Enter");
  const confirm = page.getByRole("button", { name: /Confirm card/ }).first();
  await expect(confirm).toBeVisible();
  await confirm.press("Enter");
}

for (const [spreadIndex, spread] of spreads.entries()) {
  test(`complete ${spread.id}: select ${spread.positions.length} cards, read, save and restore exact positions`, async ({ page }, info) => {
    test.skip(info.project.name !== "iphone-17-pro-max", "Complete nine-spread journey on ProMax; both phone sizes retain the existing nine-layout regressions.");
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem("hint_onboarding_complete_v3", "1");
      localStorage.setItem("hint_launch_seen_v2", "1");
      localStorage.setItem("hint-language", "en");
      localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: false, soundAndHaptics: false }));
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.route("**/api/profile**", route => route.fulfill({ json: { anonId: "all-spreads-fictional", name: "Fictional Reader", birthDate: "2000-02-29", birthTime: null, birthPlace: null, createdAt: "2026-09-09T00:00:00Z" } }));
    await page.route("**/api/readings**", route => route.fulfill({ json: [] }));
    // Recommend the same known middle option; each test manually selects its
    // own spread through the visible Previous/Next controls.
    await page.route("**/api/tarot/spread-recommendation", route => route.fulfill({ json: {
      spreadType: "three", reason: "Three cards make a clear starting point for this fictional reading.", focusLabel: "Fictional reflection", confidence: "high", source: "api",
    } }));
    const requests: ReadingRequest[] = [];
    const summary = `Fictional ${spread.label} reading: one calm and deliberate next step.`;
    await page.route("**/api/tarot/structured-reading", route => {
      const request = route.request().postDataJSON() as ReadingRequest;
      requests.push(request);
      return route.fulfill({ json: {
        source: "api", signal_type: "clear_signal", overall_summary: summary,
        cards: request.cards.map(card => ({ position: card.position, card_name: card.name, orientation: card.orientation, meaning: `${card.name} gives ${card.position} a grounded direction in this fictional fixture.` })),
        final_action_advice: "Choose a small practical next step.", follow_up_invitation: "Reflect on one position at a time.",
      } });
    });

    await page.goto("/app/tarot?hintPreview=embedded");
    const question = `What can the ${spread.label} spread help me reflect on today?`;
    await page.getByPlaceholder("Type your question...").fill(question);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator('[data-spread-preview="three"]')).toBeVisible();
    if (spreadIndex === 0) await page.getByRole("button", { name: "Previous spread" }).click();
    for (let index = 1; index < spreadIndex; index++) await page.getByRole("button", { name: "Next spread" }).click();
    const preview = page.locator(`[data-spread-preview="${spread.id}"]`);
    await expect(preview).toBeVisible();
    await expect(preview.locator(".tarot-spread-card-art")).toHaveCount(spread.positions.length);
    await page.getByRole("button", { name: "Use this spread", exact: true }).click();
    await page.getByRole("button", { name: /^Customize/i }).click();
    await page.getByTestId(`tarot-room-background-${spread.room}`).click();
    await page.getByRole("button", { name: /Begin the ritual/i }).click();
    await page.getByRole("button", { name: "Auto Wash", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Cutting the deck." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Shuffling the deck." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The deck is ready." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pick Cards", exact: true })).toBeVisible();
    await expect(page.getByLabel("Rotating tarot deck wheel")).toHaveAttribute("data-deck-size", "78");
    for (let index = 0; index < spread.positions.length; index++) {
      await chooseCard(page);
      await expect(page.getByText(`${spread.label} - ${index + 1} of ${spread.positions.length} chosen`, { exact: true })).toBeVisible();
    }
    const picked = await page.evaluate(() => JSON.parse(localStorage.getItem(`hint_active_tarot_reading_v2:${localStorage.getItem("hint_anon_id")}`)!).selectedCards as DrawnCard[]);
    expect(picked).toHaveLength(spread.positions.length);
    expect(new Set(picked.map(card => card.cardId)).size).toBe(spread.positions.length);
    await page.getByRole("button", { name: /Reveal Reading/i }).click();
    await expect(page.getByText("The cards are open.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Read my Hint", exact: true }).click();
    await expect(page.getByText(summary, { exact: true })).toBeVisible();
    await expect(page.getByText("Saved in History. You can leave and come back later.", { exact: true })).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ question, spreadType: spread.id, requiredCardCount: spread.positions.length });
    expect(requests[0]!.cards.map(card => card.position)).toEqual([...spread.positions]);
    expect(requests[0]!.cards.map(({ cardId, name, orientation }) => ({ cardId, name, orientation }))).toEqual(picked.map(({ cardId, name, orientation }) => ({ cardId, name, orientation })));
    await expect.poll(async () => (await archive(page))[0]?.interpretationStatus).toBe("ready");
    const saved = (await archive(page))[0]!;
    expect(saved).toMatchObject({ question, spreadType: spread.id, roomDesign: { backgroundId: spread.room } });
    expect(identity(saved.cards)).toEqual(identity(picked));
    expect(saved.cards.map(card => card.positionLabel)).toEqual([...spread.positions]);
    expect(saved.structuredReading.cards.map(card => card.position)).toEqual([...spread.positions]);
    await expect(page.getByRole("button", { name: /^Preview / })).toHaveCount(spread.positions.length);

    await page.getByRole("button", { name: "Open reading history", exact: true }).click();
    const leaveDialog = page.getByRole("dialog", { name: "Leave this space?" });
    await expect(leaveDialog).toBeVisible();
    await expect(leaveDialog).toContainText("Saved readings, personal details and today’s cards are kept.");
    await leaveDialog.getByRole("button", { name: "Leave and start fresh", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/readings$/);
    // Remove only the fictional active-session cache: History must restore from
    // its durable archive, not accidentally succeed from still-mounted state.
    await page.evaluate(() => {
      const key = `hint_active_tarot_reading_v2:${localStorage.getItem("hint_anon_id")}`;
      for (const storage of [localStorage, sessionStorage]) {
        storage.removeItem("hint_active_tarot_reading_v1");
        storage.removeItem(key);
      }
    });
    await page.getByRole("link", { name: new RegExp(spread.label, "i") }).first().click();
    await expect(page.getByTestId("tarot-history-detail")).toHaveAttribute("data-room-background", spread.room);
    await expect(page.getByText(summary, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Return to chat/i }).click();
    await expect(page.getByText(summary, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(summary, { exact: true })).toBeVisible();
    const restored = await archive(page);
    expect(restored).toHaveLength(1);
    expect(restored[0]!.id).toBe(saved.id);
    expect(identity(restored[0]!.cards)).toEqual(identity(picked));
    expect(restored[0]!.cards.map(card => card.positionLabel)).toEqual([...spread.positions]);
    expect(restored[0]!.structuredReading.overall_summary).toBe(summary);
    expect(requests).toHaveLength(1);
    const visibleCards = page.getByRole("button", { name: /^Preview / });
    await expect(visibleCards).toHaveCount(spread.positions.length);
    for (let index = 0; index < picked.length; index++) {
      await expect(visibleCards.nth(index)).toHaveAttribute("aria-label", `Preview ${spread.positions[index]}, ${picked[index]!.name}, ${picked[index]!.orientation}`);
    }
    expect(errors).toEqual([]);
    const evidencePath = info.outputPath("completed-spread-evidence.json");
    await writeFile(evidencePath, JSON.stringify({ spread: spread.id, phone: info.project.name, language: "en", motion: "normal", room: spread.room, readingId: saved.id, positions: spread.positions, cards: identity(picked), readingRequests: requests.length }, null, 2));
    await info.attach("completed-spread-evidence", { path: evidencePath, contentType: "application/json" });
  });
}

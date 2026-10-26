import { readFileSync } from "node:fs";
import { expect, test, type Page } from "../e2e/fixtures";
import { replyWav } from "./fakeAudio";

const SUMMARY = "A clear opening is present, but it asks for one calm and deliberate next step.";
const REPLY = "Start with one honest conversation this week, then notice how your body responds.";
const reply = readFileSync(replyWav);

async function seed(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: undefined });
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: undefined });
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_local_auth_v1", JSON.stringify({
      identifier: "tester@hint.local", provider: "email", email: "tester@hint.local", name: "Preview User",
      verifiedAt: "2026-09-02T00:00:00.000Z", createdAt: "2026-09-02T00:00:00.000Z", lastSignedInAt: "2026-09-02T00:00:00.000Z",
    }));
    const cards = [["0-fool", "The Fool"], ["3-empress", "The Empress"], ["knight-cups", "Knight of Cups"]].map(([cardId, name], index) => ({
      visualId: `voice-${index + 1}`, cardId, name, orientation: index === 0 ? "reversed" : "upright",
      x: 0, y: 0, rotation: 0, rotate: 0, zIndex: index, selected: true, revealed: true,
    }));
    if (localStorage.getItem("hint_voice_e2e_seeded") === "1") return;
    localStorage.setItem("hint_voice_e2e_seeded", "1");
    sessionStorage.setItem("hint_active_tarot_reading_v1", JSON.stringify({
      version: 1, savedAt: Date.now(), phase: "reading", question: "What is opening now?", spreadId: "three", focusLabel: "Clear signal",
      design: {
        id: "dawn", label: "Soft Dawn", mood: "Bright and calm.", deckStyleId: "ivory", backStyle: "ivory",
        cardBackId: "01_Final_Eight_Set/05_Dawn_Gate_Ivory_Gold.png", cardArtId: "hint-classic", backgroundId: "dawn",
        background: "linear-gradient(180deg,#fff8ef,#f5ece5 46%,#e9f3ec)", glow: "rgba(236,198,129,0.48)",
      },
      selectedCards: cards, revealedIds: cards.map((card) => card.visualId),
    }));
  });
  await page.route("**/api/profile**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    anonId: "preview", name: "Preview User", birthDate: "1996-08-18", birthTime: null, birthPlace: null, createdAt: "2026-09-02T00:00:00.000Z",
  }) }));
  await page.route("**/api/readings**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/tarot/structured-reading", async (route) => {
    const request = route.request().postDataJSON() as { cards: Array<{ name: string; orientation: string; position: string }> };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      source: "api", signal_type: "clear_signal", overall_summary: SUMMARY,
      cards: request.cards.map((card) => ({ position: card.position, card_name: card.name, orientation: card.orientation, meaning: `${card.name} gives this position a grounded direction.` })),
      final_action_advice: "Choose the smallest honest action.", follow_up_invitation: "Ask about any card.",
    }) });
  });
}

test("voice conversation: microphone turn -> server transcript -> chat reply -> spoken reply -> listens again", async ({ page }) => {
  await seed(page);
  const transcribeCalls: string[] = [];
  const chatFollowUps: string[] = [];
  const speechTexts: string[] = [];
  await page.route("**/api/transcribe**", async (route) => {
    transcribeCalls.push(route.request().headers()["content-type"] ?? "");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: "How do I start the conversation with my sister?" }) });
  });
  await page.route("**/api/tarot/chat", async (route) => {
    chatFollowUps.push((route.request().postDataJSON() as { followUp: string }).followUp);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: REPLY, source: "api" }) });
  });
  await page.route("**/api/speech", async (route) => {
    speechTexts.push((route.request().postDataJSON() as { text: string }).text);
    await route.fulfill({ status: 200, contentType: "audio/wav", body: reply });
  });

  await page.goto("/app/tarot?hintPreview=embedded");
  await expect(page.getByText(SUMMARY, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start voice conversation" }).click();
  const room = page.getByTestId("tarot-voice-conversation");
  await expect(room).toBeVisible();
  await expect(room.getByRole("status")).toHaveText("I’m listening…");

  // The fake microphone plays ~1.8 s of speech then silence: the turn ends, uploads and is answered.
  await expect.poll(() => chatFollowUps, { timeout: 25_000 }).toEqual(["How do I start the conversation with my sister?"]);
  await expect.poll(() => speechTexts, { timeout: 15_000 }).toEqual([REPLY]);
  await page.getByRole("button", { name: "Show transcript" }).click();
  const transcript = page.locator("#tarot-voice-transcript");
  await expect(transcript).toContainText("How do I start the conversation with my sister?");
  await expect(transcript).toContainText(REPLY);

  // After the spoken reply finishes, the room opens the microphone for the next turn.
  await expect.poll(() => transcribeCalls.length, { timeout: 30_000 }).toBeGreaterThanOrEqual(2);
  expect(transcribeCalls.every((type) => type.startsWith("audio/webm"))).toBe(true);
  await page.getByRole("button", { name: "End voice conversation" }).click();
  await expect(room).toHaveCount(0);
});

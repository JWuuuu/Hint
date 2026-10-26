import { expect, test } from "../e2e/fixtures";

test("tarot voice question records with the microphone and uses the server transcript", async ({ page }) => {
  const uploads: Array<{ type: string; bytes: number; url: string; auth: string | null }> = [];
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: undefined });
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: undefined });
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_local_auth_v1", JSON.stringify({
      identifier: "tester@hint.local", provider: "email", email: "tester@hint.local", name: "Preview User",
      verifiedAt: "2026-09-02T00:00:00.000Z", createdAt: "2026-09-02T00:00:00.000Z", lastSignedInAt: "2026-09-02T00:00:00.000Z",
    }));
    const tracks: MediaStreamTrack[] = [];
    (window as Window & { __hintTracks?: MediaStreamTrack[] }).__hintTracks = tracks;
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      tracks.push(...stream.getTracks());
      return stream;
    };
  });
  await page.route("**/api/profile**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    anonId: "preview", name: "Preview User", birthDate: "1996-08-18", birthTime: null, birthPlace: null, createdAt: "2026-09-02T00:00:00.000Z",
  }) }));
  await page.route("**/api/transcribe**", async (route) => {
    const request = route.request();
    uploads.push({ type: request.headers()["content-type"] ?? "", bytes: request.postDataBuffer()?.byteLength ?? 0, url: request.url(), auth: request.headers()["authorization"] ?? null });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: "Will my new job feel right?" }) });
  });

  await page.goto("/app/tarot?hintPreview=embedded");
  await page.getByRole("button", { name: "Voice input" }).click();
  const sheet = page.getByRole("dialog", { name: "Voice input" });
  await expect(sheet.getByText("I'm listening...", { exact: true })).toBeVisible();

  await expect(sheet.getByText("Will my new job feel right?", { exact: true })).toBeVisible();
  await expect(sheet.getByText("Your question is ready.", { exact: true })).toBeVisible();

  expect(uploads).toHaveLength(1);
  expect(uploads[0]!.type).toMatch(/^audio\/webm/);
  expect(uploads[0]!.bytes).toBeGreaterThan(2000);
  expect(uploads[0]!.url).toContain("language=en-US");
  expect(uploads[0]!.auth).toBe("Bearer isolated-fixture-token-000000000000000000000000000000");

  // The microphone is released once the turn is transcribed.
  const trackStates = await page.evaluate(() => ((window as Window & { __hintTracks?: MediaStreamTrack[] }).__hintTracks ?? []).map((track) => track.readyState));
  expect(trackStates.length).toBeGreaterThan(0);
  expect(trackStates.every((state) => state === "ended")).toBe(true);
});

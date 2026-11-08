import { expect, test, type Page, type Route } from "./fixtures";

const OWNER = "ask-reliability-fictional-reader";

/** 25 saved exchanges: more than the old 40-message request ceiling. */
function longThread() {
  return {
    id: "long-fictional-thread", anonId: OWNER, createdAt: "2026-09-10T20:00:00Z", updatedAt: "2026-09-10T21:00:00Z",
    messages: Array.from({ length: 50 }, (_, index) => ({
      id: `saved-${index}`, role: index % 2 ? "assistant" : "user", createdAt: "2026-09-10T20:00:00Z",
      content: index % 2 ? `A fictional earlier answer number ${index}.` : `A fictional earlier question number ${index}?`,
    })),
  };
}

async function seed(page: Page, withThread = false) {
  await page.addInitScript(({ owner, thread }) => {
    if (localStorage.getItem("ask-reliability-fixture")) return;
    localStorage.setItem("ask-reliability-fixture", "1");
    localStorage.setItem("hint_anon_id", owner);
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_launch_seen_v2", "1");
    localStorage.setItem("hint-language", "en");
    localStorage.setItem("hint-theme", "bright");
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
    if (thread) localStorage.setItem(`hint_ask_history_v1:${encodeURIComponent(owner)}`, JSON.stringify([thread]));
  }, { owner: OWNER, thread: withThread ? longThread() : null });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/profile**", route => route.fulfill({ status: 404, json: { error: "PROFILE_NOT_FOUND" } }));
  await page.route("**/api/journal**", route => route.fulfill({ json: [] }));
}

async function send(page: Page, text: string) {
  await page.locator("textarea").fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
}

test("Ask continues a conversation past 25 exchanges and sends only a bounded recent context", async ({ page }) => {
  await seed(page, true);
  const bodies: { messages: { role: string; content: string }[]; followUp: string }[] = [];
  await page.route("**/api/hint/chat", (route: Route) => {
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ json: { message: "A fictional reply after a long talk.", source: "api", createdAt: "2026-09-11T12:00:00Z" } });
  });
  await page.goto("/app/ask?conversation=long-fictional-thread&hintPreview=embedded");
  await expect(page.getByText("A fictional earlier answer number 49.", { exact: true })).toBeVisible();
  await send(page, "A fictional twenty-sixth question");
  await expect(page.getByText("A fictional reply after a long talk.", { exact: true })).toBeVisible();
  expect(bodies).toHaveLength(1);
  expect(bodies[0]!.followUp).toBe("A fictional twenty-sixth question");
  expect(bodies[0]!.messages.length).toBeLessThanOrEqual(16);
  expect(bodies[0]!.messages.at(-1)).toEqual({ role: "assistant", content: "A fictional earlier answer number 49." });
  await expect(page.locator("textarea")).toHaveValue("");
});

test("Ask shows a service fallback as an error, keeps the question, and saves only the real answer", async ({ page }) => {
  await seed(page);
  let calls = 0;
  await page.route("**/api/hint/chat", (route: Route) => route.fulfill({ json: ++calls === 1
    ? { message: "A fictional offline fallback that must not be saved.", source: "local", createdAt: "2026-09-11T12:00:00Z" }
    : { message: "A fictional real answer.", source: "api", createdAt: "2026-09-11T12:01:00Z" } }));
  await page.clock.install();
  await page.goto("/app/ask?hintPreview=embedded");
  await send(page, "A fictional question during an outage");
  await expect(page.getByText("The reading service is temporarily unavailable.", { exact: false })).toBeVisible();
  await expect(page.getByText("A fictional offline fallback that must not be saved.", { exact: true })).toHaveCount(0);
  await expect(page.locator("textarea")).toHaveValue("A fictional question during an outage");
  // Every attempt counts toward the daily allowance, so Retry waits out a short cooldown.
  const retry = page.getByRole("button", { name: "Retry", exact: true });
  await expect(retry).toBeDisabled();
  await page.clock.fastForward(61_000);
  await expect(retry).toBeEnabled();
  await retry.click();
  await expect(page.getByText("A fictional real answer.", { exact: true })).toBeVisible();
  await expect(page.getByText("The reading service is temporarily unavailable.", { exact: false })).toHaveCount(0);
  await page.reload();
  const thread = page.locator(".hint-app-scroll");
  await expect(thread.getByText("A fictional real answer.", { exact: true })).toBeVisible();
  await expect(thread.getByText("A fictional question during an outage", { exact: true })).toHaveCount(1);
  await expect(page.getByText("A fictional offline fallback that must not be saved.", { exact: true })).toHaveCount(0);
  expect(calls).toBe(2);
});

test("Ask says when it can't reach the server, keeps the question, and shows why above the composer", async ({ page }) => {
  await seed(page);
  // The isolated fixture answers every unmocked API call with 503, as a server that is down would.
  await page.goto("/app/ask?hintPreview=embedded");
  await send(page, "A fictional question while the server is down");
  const error = page.getByTestId("ask-error");
  await expect(error).toContainText("Hint can't reach its server right now.");
  await expect(error).toBeInViewport();
  await expect(page.locator("textarea")).toHaveValue("A fictional question while the server is down");
  const [box, composer] = await Promise.all([error.boundingBox(), page.locator("textarea").boundingBox()]);
  expect(box!.y + box!.height).toBeLessThanOrEqual(composer!.y);
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
});

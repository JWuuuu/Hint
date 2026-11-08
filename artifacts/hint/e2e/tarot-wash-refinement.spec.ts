import { expect, test, type Page, type TestInfo } from "./fixtures";

async function enterWash(page: Page) {
  await page.addInitScript(() => {
    let randomState = 173;
    Math.random = () => {
      randomState = (randomState * 1664525 + 1013904223) >>> 0;
      return randomState / 0x1_0000_0000;
    };
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_local_auth_v1", JSON.stringify({
      identifier: "wash-preview@hint.local", provider: "email", email: "wash-preview@hint.local",
      name: "Fictional Reader", verifiedAt: "2026-09-10T00:00:00.000Z",
      createdAt: "2026-09-10T00:00:00.000Z", lastSignedInAt: "2026-09-10T00:00:00.000Z",
    }));
  });
  await page.route("**/api/profile**", route => route.fulfill({ status: 200, json: {
    anonId: "isolated-wash-reader", name: "Fictional Reader", birthDate: null,
    birthTime: null, birthPlace: null, createdAt: "2026-09-10T00:00:00.000Z",
  } }));
  await page.route("**/api/tarot/spread-recommendation", route => route.fulfill({ status: 200, json: {
    spreadType: "three", reason: "Three moments for a quiet reflection.", focusLabel: "A quiet letter",
    confidence: "high", source: "api",
  } }));
  await page.goto("/app/tarot?hintPreview=embedded");
  await page.getByPlaceholder("Type your question...").fill("What would help me make space today?");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: /Use this spread/i }).click();
  await page.getByRole("button", { name: /^Customize/i }).click();
  await page.getByTestId("tarot-room-background-sea").click();
  await page.getByRole("button", { name: /Begin the ritual/i }).click();
  await expect(page.getByRole("button", { name: "Auto Wash", exact: true })).toBeVisible();
  await page.waitForTimeout(500);
}

async function washByHand(page: Page) {
  const table = page.getByTestId("tarot-wash-table");
  const bounds = await table.boundingBox();
  if (!bounds) throw new Error("Wash table was not laid out");
  const points = Array.from({ length: 25 }, (_, index) => ({
    x: bounds.x + bounds.width * (0.5 + Math.cos(index / 24 * Math.PI * 2) * 0.27),
    y: bounds.y + bounds.height * (0.52 + Math.sin(index / 24 * Math.PI * 2) * 0.25),
  }));
  await page.mouse.move(points[0]!.x, points[0]!.y);
  await page.mouse.down();
  for (const point of points.slice(1)) {
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(24);
  }
}

async function capture(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`) });
  await info.attach(name, { path: info.outputPath(`${name}.png`), contentType: "image/png" });
}

test("manual wash uses the full table and keeps its geometry while gathering", async ({ page }, info) => {
  await enterWash(page);
  const table = page.getByTestId("tarot-wash-table");
  const sample = () => table.locator("[data-wash-card]").evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y };
  }));
  const before = await sample();
  const tableBefore = await table.boundingBox();
  const headingClearance = await page.getByTestId('tarot-deck-count').evaluate(badge => {
    const section = badge.closest('section')!;
    const chrome = [...document.querySelectorAll<HTMLElement>('button, a')]
      .filter(node => !section.contains(node))
      .map(node => node.getBoundingClientRect())
      .filter(rect => rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < 100);
    return { count: chrome.length, gap: badge.getBoundingClientRect().top - Math.max(...chrome.map(rect => rect.bottom)) };
  });
  expect(headingClearance.count).toBeGreaterThan(0);
  expect(headingClearance.gap).toBeGreaterThanOrEqual(8);
  await capture(page, info, "wash-ready");
  await washByHand(page);
  const moved = await sample();
  expect(moved.every((point, index) => Math.hypot(point.x - before[index]!.x, point.y - before[index]!.y) > 2)).toBe(true);
  const footprint = await table.locator("[data-wash-card-face]").evaluateAll(nodes => {
    const bounds = nodes.map(node => node.getBoundingClientRect());
    return Math.max(...bounds.map(rect => rect.right)) - Math.min(...bounds.map(rect => rect.left));
  });
  expect(footprint).toBeGreaterThan(tableBefore!.width * 0.55);
  await capture(page, info, "wash-in-motion");
  await page.mouse.up();
  await expect(page.locator('[data-ritual-stage="gathering"]')).toBeVisible();
  const tableGather = await table.boundingBox();
  expect(Math.abs(tableGather!.height - tableBefore!.height)).toBeLessThan(1);
  expect(Math.abs(tableGather!.width - tableBefore!.width)).toBeLessThan(1);
  expect(Math.abs(tableGather!.y - tableBefore!.y)).toBeLessThan(1);
  await capture(page, info, "wash-gathering");
  await expect(page.getByRole("heading", { name: "Cutting the deck." })).toBeVisible({ timeout: 1500 });
  await capture(page, info, "wash-to-cut");
});

test("release reaches cutting promptly even if the WebView drops transition events", async ({ page }) => {
  await enterWash(page);
  await page.evaluate(() => window.addEventListener("transitionend", event => event.stopImmediatePropagation(), true));
  await washByHand(page);
  const startedAt = Date.now();
  await page.mouse.up();
  await expect(page.getByRole("heading", { name: "Cutting the deck." })).toBeVisible({ timeout: 1500 });
  expect(Date.now() - startedAt).toBeLessThan(1500);
});

test("the post-cut shuffle opens the deck into two halves and riffles every card back one at a time before picking", async ({ page }, info) => {
  await enterWash(page);
  await page.getByRole('button', { name: 'Auto Wash', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cutting the deck.', exact: true })).toBeVisible();
  await page.getByTestId('tarot-cut-table').evaluate(table => {
    const state = window as Window & { shuffleFrames?: Array<{ time: number; shuffling: boolean; cards: number[] }> };
    state.shuffleFrames = [];
    const sample = (time: number) => {
      if (!table.isConnected) return;
      const bounds = table.getBoundingClientRect();
      const shuffling = table.closest('section')!.querySelector('h1')?.textContent === 'Shuffling the deck.';
      const cards = [...table.querySelectorAll('[data-cut-packet], [data-shuffle-card]')].map(card => {
        const rect = card.getBoundingClientRect();
        return rect.x + rect.width / 2 - bounds.x - bounds.width / 2;
      });
      state.shuffleFrames!.push({ time, shuffling, cards });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  // "The deck is ready." shows for about 0.36 s, which a busy page can finish before a visibility
  // poll sees it. The sampler records every frame, so wait for it to log the end of the shuffle.
  await expect.poll(() => page.evaluate(() => {
    const frames = (window as Window & { shuffleFrames?: Array<{ shuffling: boolean }> }).shuffleFrames ?? [];
    const start = frames.findIndex(frame => frame.shuffling);
    return start >= 0 && frames.slice(start).some(frame => !frame.shuffling);
  }), { timeout: 12_000, message: 'The shuffle finished' }).toBe(true);
  const rows = await page.evaluate(() => (window as Window & {
    shuffleFrames?: Array<{ time: number; shuffling: boolean; cards: number[] }>;
  }).shuffleFrames!);
  const moving = rows.filter(row => row.shuffling);
  expect(moving.length).toBeGreaterThan(0);
  // Since Nov 4 the shuffle is a riffle (RitualDeckInterleave): the deck splits into two halves, holds,
  // then the cards drop into one stack one at a time, alternating halves from the bottom, and the deck
  // is squared. Split 0.56 s + hold 0.36 s + riffle 3 s + square 0.24 s = 4.16 s.
  const duration = moving.at(-1)!.time - moving[0]!.time;
  const cardCount = moving[0]!.cards.length;
  const separations = moving.map(row => Math.max(...row.cards) - Math.min(...row.cards));
  const widestSeparation = Math.max(...separations);
  const peak = moving[separations.indexOf(widestSeparation)]!;
  const departedAt = new Map<number, number>();
  const arrivedAt = new Map<number, number>();
  moving.forEach((row, rowIndex) => row.cards.forEach((x, index) => {
    if (Math.abs(x) > 45 && !departedAt.has(index)) departedAt.set(index, rowIndex);
    if (departedAt.has(index) && Math.abs(x) < 8 && !arrivedAt.has(index)) arrivedAt.set(index, row.time);
  }));
  const spread = (rows: Map<number, number>) => Math.max(...rows.values()) - Math.min(...rows.values());
  const halves = { left: peak.cards.filter(x => x < -45).length, right: peak.cards.filter(x => x > 45).length };
  const arrivals = [...arrivedAt.entries()].sort((a, b) => a[1] - b[1]).map(([index]) => index);
  await info.attach('visible-shuffle-motion', { body: JSON.stringify({ duration, cardCount, widestSeparation, halves,
    departureSpread: spread(departedAt), arrivalSpreadMs: spread(arrivedAt), firstArrivals: arrivals.slice(0, 6), lastArrivals: arrivals.slice(-6) }), contentType: 'application/json' });
  expect(duration).toBeGreaterThanOrEqual(3600);
  expect(duration).toBeLessThan(5600);
  expect(cardCount).toBe(78);
  // At its widest, every card sits in one of two equal halves, more than two card widths apart.
  expect(halves.left + halves.right).toBe(cardCount);
  expect(Math.abs(halves.left - halves.right)).toBeLessThanOrEqual(1);
  expect(widestSeparation).toBeGreaterThan(168);
  // Every card leaves the centre together, then comes back one at a time over the riffle.
  expect(departedAt.size).toBe(cardCount);
  expect(spread(departedAt)).toBeLessThanOrEqual(1);
  expect(arrivedAt.size).toBe(cardCount);
  expect(spread(arrivedAt)).toBeGreaterThan(1800);
  // Within each half, cards land bottom first: a card never lands before the one beneath it.
  for (let index = 0; index + 2 < cardCount; index++) expect(arrivedAt.get(index + 2)!).toBeGreaterThanOrEqual(arrivedAt.get(index)!);
  // Both halves feed the stack throughout: the first and last ten cards to land come from both sides.
  for (const group of [arrivals.slice(0, 10), arrivals.slice(-10)]) {
    expect(group.some(index => index % 2 === 0)).toBe(true);
    expect(group.some(index => index % 2 === 1)).toBe(true);
  }
  expect(Math.max(...moving.at(-1)!.cards.map(Math.abs))).toBeLessThan(8);
  await capture(page, info, 'shuffle-squared');
  await expect(page.getByRole('heading', { name: 'Pick Cards', exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('Rotating tarot deck wheel')).toHaveAttribute('data-deck-size', '78');
});

test("wash explains the fixed deck in a dismissible dialog without starting the ritual", async ({ page }, info) => {
  await enterWash(page);
  const note = page.getByTestId("tarot-deck-choice-note");
  await expect(note).toHaveText("A full deck. The choice is yours.");
  const bounds = await note.boundingBox();
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  await capture(page, info, "wash-deck-note");
  await note.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("All 78 cards are already in the deck.");
  await expect(dialog).toContainText("tapping does not generate a new card.");
  await page.keyboard.press("Tab");
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(note).toBeFocused();
  await expect(page.locator('[data-ritual-stage="washing"]')).toBeVisible();
  await page.getByRole("button", { name: "Auto Wash", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pick Cards", exact: true })).toBeVisible({ timeout: 20_000 });
});

for (const mode of ['system', 'app', 'both'] as const) {
test(`reduced motion (${mode}) keeps Auto Wash functional without playing the decorative wash`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: mode === 'app' ? 'no-preference' : 'reduce' });
  if (mode !== 'system') await page.addInitScript(() => {
    localStorage.setItem('hint.preferences.v1', JSON.stringify({ soundAndHaptics: false, reduceMotion: true }));
  });
  await enterWash(page);
  const auto = page.getByRole("button", { name: "Auto Wash", exact: true });
  await auto.evaluate(button => {
    const state = window as Window & { reducedWashTiming?: { started: number; cut: number | null } };
    state.reducedWashTiming = { started: 0, cut: null };
    button.addEventListener('click', () => { state.reducedWashTiming!.started = performance.now(); }, { once: true });
    const observer = new MutationObserver(() => {
      if (document.querySelector('[data-ritual-stage="cutting"]')) {
        state.reducedWashTiming!.cut = performance.now();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
  await auto.click();
  // Reduced motion intentionally makes the cut heading shorter than polling
  // intervals. Record its occurrence and timing; assert the stable destination.
  await expect(page.getByRole("heading", { name: "Pick Cards", exact: true })).toBeVisible({ timeout: 3000 });
  const timing = await page.evaluate(() => (window as Window & { reducedWashTiming?: { started: number; cut: number | null } }).reducedWashTiming!);
  expect(timing.cut).not.toBeNull();
  expect(timing.cut! - timing.started).toBeLessThan(1200);
});
}

test("wash and cut meet at the same opaque card without a size or position jump", async ({ page }, info) => {
  await enterWash(page);
  await washByHand(page);
  await page.evaluate(() => {
    const state = window as Window & { washSeam?: Array<{ stage: string; x: number; y: number; width: number; height: number; opacity: number }> };
    state.washSeam = [];
    const sample = () => {
      const stage = document.querySelector('[data-ritual-stage]')?.getAttribute('data-ritual-stage') ?? '';
      const card = [...document.querySelectorAll<HTMLElement>('[data-wash-card-face] > div, [data-cut-packet]')].at(-1);
      if (card) {
        const rect = card.getBoundingClientRect();
        let opacity = 1;
        for (let el: HTMLElement | null = card; el; el = el.parentElement) opacity *= Number(getComputedStyle(el).opacity);
        state.washSeam!.push({ stage, x: rect.x, y: rect.y, width: rect.width, height: rect.height, opacity });
      }
      if (stage !== 'cutting') requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.mouse.up();
  await expect(page.getByRole('heading', { name: 'Cutting the deck.', exact: true })).toBeVisible();
  const rows = await page.evaluate(() => (window as Window & { washSeam?: Array<{ stage: string; x: number; y: number; width: number; height: number; opacity: number }> }).washSeam ?? []);
  const cut = rows.find(row => row.stage === 'cutting');
  const gathered = rows.filter(row => row.stage === 'gathering').at(-1);
  expect(cut).toBeDefined();
  expect(gathered).toBeDefined();
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(cut![key] - gathered![key])).toBeLessThan(2);
  expect(cut!.opacity).toBe(1);
  await info.attach('wash-cut-seam', { body: JSON.stringify({ gathered, cut }), contentType: 'application/json' });
  await expect(page.getByRole('heading', { name: 'Pick Cards', exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('Rotating tarot deck wheel')).toHaveAttribute('data-deck-size', '78');
});

test("a stationary hand lets the cards rest and keeps only clockwise guidance", async ({ page }) => {
  await enterWash(page);
  await washByHand(page);
  const table = page.getByTestId('tarot-wash-table');
  const sample = () => table.locator('[data-wash-card]').evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect(); return { x: r.x, y: r.y };
  }));
  await expect(page.getByText('Wash clockwise', { exact: true })).toBeVisible();
  await expect(page.getByText('Wash counterclockwise', { exact: true })).toHaveCount(0);
  await page.waitForTimeout(500);
  const resting = await sample();
  await page.waitForTimeout(300);
  const later = await sample();
  expect(Math.max(...later.map((p, i) => Math.hypot(p.x - resting[i]!.x, p.y - resting[i]!.y)))).toBeLessThan(0.5);
  await page.mouse.up();
  await expect(page.getByRole('heading', { name: 'Pick Cards', exact: true })).toBeVisible({ timeout: 20_000 });
});

test("a delayed squaring timer recovers even when transition events are lost", async ({ page }) => {
  await enterWash(page);
  await page.evaluate(() => {
    window.addEventListener('transitionend', event => event.stopImmediatePropagation(), true);
    const schedule = window.setTimeout.bind(window);
    // Simulate the WebView delaying the gather-phase timer independently.
    window.setTimeout = ((handler: TimerHandler, delay = 0, ...args: unknown[]) =>
      schedule(handler, delay === 540 ? delay + 240 : delay, ...args)) as typeof window.setTimeout;
  });
  await washByHand(page);
  await page.mouse.up();
  await expect(page.getByRole('heading', { name: 'Cutting the deck.', exact: true })).toBeVisible({ timeout: 2000 });
  await expect(page.getByRole('heading', { name: 'Pick Cards', exact: true })).toBeVisible({ timeout: 20_000 });
});

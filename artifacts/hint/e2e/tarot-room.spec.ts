import { expect, test, type Page } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const READING_SUMMARY =
  "A clear opening is present, but it asks for one calm and deliberate next step.";
const LATE_READING_SUMMARY =
  "This response arrived after the reading had already settled locally.";

const VISUAL_CARDS = [
  ["0-fool", "The Fool"],
  ["3-empress", "The Empress"],
  ["knight-cups", "Knight of Cups"],
  ["17-star", "The Star"],
  ["6-lovers", "The Lovers"],
  ["9-hermit", "The Hermit"],
  ["11-justice", "Justice"],
  ["18-moon", "The Moon"],
  ["19-sun", "The Sun"],
] as const;

type VisualCase = {
  spreadId: string;
  cardCount: number;
  backgroundId: "stars" | "dawn" | "sea";
  cardArtId: "hint-card-2" | "hint-classic" | "original";
  cardBackId: string;
};

const VISUAL_CASES = [
  {
    spreadId: "single",
    cardCount: 1,
    backgroundId: "stars",
    cardArtId: "hint-card-2",
    cardBackId: "07_Zodiac_Set_A_Detailed/11_Aquarius_Waterbearer_Teal_Gold.png",
  },
  {
    spreadId: "three",
    cardCount: 3,
    backgroundId: "dawn",
    cardArtId: "hint-classic",
    cardBackId: "01_Final_Eight_Set/05_Dawn_Gate_Ivory_Gold.png",
  },
  {
    spreadId: "peachBlossom",
    cardCount: 5,
    backgroundId: "sea",
    cardArtId: "original",
    cardBackId: "01_Final_Eight_Set/02_Moon_Tide_Lavender_Gold.png",
  },
  {
    spreadId: "futureLover",
    cardCount: 7,
    backgroundId: "stars",
    cardArtId: "hint-classic",
    cardBackId: "02_Premium_Refined/01_Star_Orbit_Realm_Rich_Navy_Gold.png",
  },
  {
    spreadId: "xRelationship",
    cardCount: 9,
    backgroundId: "dawn",
    cardArtId: "hint-card-2",
    cardBackId: "03_Minimal_Balanced/01_Minimal_Ivory_Gold.png",
  },
] as const satisfies readonly VisualCase[];

const ALL_SPREAD_LAYOUT_CASES: readonly VisualCase[] = [
  ...VISUAL_CASES,
  {
    spreadId: "relationship",
    cardCount: 3,
    backgroundId: "sea",
    cardArtId: "original",
    cardBackId: "07_Zodiac_Set_A_Detailed/11_Aquarius_Waterbearer_Teal_Gold.png",
  },
  {
    spreadId: "reconciliation",
    cardCount: 7,
    backgroundId: "dawn",
    cardArtId: "hint-classic",
    cardBackId: "01_Final_Eight_Set/05_Dawn_Gate_Ivory_Gold.png",
  },
  {
    spreadId: "trueHeart",
    cardCount: 5,
    backgroundId: "stars",
    cardArtId: "hint-card-2",
    cardBackId: "02_Premium_Refined/01_Star_Orbit_Realm_Rich_Navy_Gold.png",
  },
  {
    spreadId: "loveTree",
    cardCount: 7,
    backgroundId: "sea",
    cardArtId: "original",
    cardBackId: "01_Final_Eight_Set/02_Moon_Tide_Lavender_Gold.png",
  },
];

async function seedApp(page: Page) {
  await page.addInitScript(() => {
    let randomState = 0x5f3759df;
    Math.random = () => {
      randomState = (randomState * 1664525 + 1013904223) >>> 0;
      return randomState / 0x1_0000_0000;
    };
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: undefined,
    });
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem(
      "hint_local_auth_v1",
      JSON.stringify({
        identifier: "tester@hint.local",
        provider: "email",
        email: "tester@hint.local",
        name: "Preview User",
        verifiedAt: "2026-09-02T00:00:00.000Z",
        createdAt: "2026-09-02T00:00:00.000Z",
        lastSignedInAt: "2026-09-02T00:00:00.000Z",
      }),
    );
  });

  await page.context().route("**/api/profile**", (route) => {
    const anonId = new URL(route.request().url()).searchParams.get("anonId") ?? "preview";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        anonId,
        name: "Preview User",
        birthDate: "1996-08-18",
        birthTime: null,
        birthPlace: null,
        createdAt: "2026-09-02T00:00:00.000Z",
      }),
    });
  });
  await page.route("**/api/tarot/spread-recommendation", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        spreadType: "three",
        reason: "Three cards keep this signal focused and readable.",
        focusLabel: "Clear signal",
        confidence: "high",
        source: "api",
      }),
    }),
  );
  await page.route("**/api/tarot/structured-reading", async (route) => {
    const request = route.request().postDataJSON() as {
      cards: Array<{ name: string; orientation: "upright" | "reversed"; position: string }>;
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "api",
        signal_type: "clear_signal",
        overall_summary: READING_SUMMARY,
        cards: request.cards.map((card) => ({
          position: card.position,
          card_name: card.name,
          orientation: card.orientation,
          meaning: `${card.name} gives this position a grounded, readable direction.`,
        })),
        final_action_advice: "Choose the smallest honest action and take it without rushing.",
        follow_up_invitation: "Ask about any card when you want the next layer.",
      }),
    });
  });
  await page.route("**/api/tarot/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Choose the smallest honest action, then leave enough space to notice what changes.",
      }),
    }),
  );
  await page.route("**/api/readings**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
}

async function seedReadingSession(page: Page, visualCase: VisualCase) {
  const selectedCards = VISUAL_CARDS.slice(0, visualCase.cardCount).map(
    ([cardId, name], index) => ({
      visualId: `visual-regression-${index + 1}`,
      cardId,
      name,
      orientation: index % 3 === 0 ? "reversed" : "upright",
      x: 0,
      y: 0,
      rotation: 0,
      rotate: 0,
      zIndex: index,
      selected: true,
      revealed: true,
    }),
  );

  await page.addInitScript(
    ({ selectedCards: cards, visual }) => {
      const seedKey = `hint_e2e_reading_seed_${visual.spreadId}_${visual.backgroundId}_${visual.cardArtId}`;
      if (localStorage.getItem(seedKey) === "1") return;
      localStorage.setItem(seedKey, "1");
      localStorage.removeItem("hint_active_tarot_reading_v1");
      localStorage.removeItem(`hint_active_tarot_reading_v2:${localStorage.getItem("hint_anon_id")}`);
      sessionStorage.removeItem(`hint_active_tarot_reading_v2:${localStorage.getItem("hint_anon_id")}`);
      const palette = {
        stars: {
          label: "Star Field",
          mood: "Soft celestial focus.",
          background: "linear-gradient(180deg,#fff8f1,#f6e8ed 42%,#ece4ff)",
          glow: "rgba(171,151,255,0.42)",
        },
        dawn: {
          label: "Soft Dawn",
          mood: "Bright and calm.",
          background: "linear-gradient(180deg,#fff8ef,#f5ece5 46%,#e9f3ec)",
          glow: "rgba(236,198,129,0.48)",
        },
        sea: {
          label: "Deep Sea",
          mood: "Cool and dreamlike.",
          background: "linear-gradient(180deg,#f8fbf6,#edf4f1 42%,#e9e1f8)",
          glow: "rgba(83,194,194,0.38)",
        },
      }[visual.backgroundId];
      const backStyle = visual.cardBackId.includes("Ivory")
        ? "ivory"
        : visual.cardBackId.includes("Lavender")
          ? "rose"
          : "nocturne";

      sessionStorage.setItem(
        "hint_active_tarot_reading_v1",
        JSON.stringify({
          version: 1,
          savedAt: Date.now(),
          phase: "reading",
          question: "What is opening now?",
          spreadId: visual.spreadId,
          focusLabel: "Clear signal",
          design: {
            id: visual.backgroundId,
            label: palette.label,
            mood: palette.mood,
            deckStyleId: backStyle,
            backStyle,
            cardBackId: visual.cardBackId,
            cardArtId: visual.cardArtId,
            backgroundId: visual.backgroundId,
            background: palette.background,
            glow: palette.glow,
          },
          selectedCards: cards,
          revealedIds: cards.map((card) => card.visualId),
        }),
      );
    },
    { selectedCards, visual: visualCase },
  );
}

async function seedPickSession(page: Page, visualCase: VisualCase) {
  const deck = Array.from({ length: 78 }, (_, index) => {
    const [cardId, name] = VISUAL_CARDS[index % VISUAL_CARDS.length]!;
    return {
      visualId: `pick-visual-${index + 1}`,
      cardId,
      name,
      orientation: index % 4 === 0 ? "reversed" : "upright",
      x: 0,
      y: 0,
      rotation: 0,
      rotate: 0,
      zIndex: index,
      selected: false,
      revealed: false,
    };
  });

  await page.addInitScript(
    ({ cards, visual }) => {
      const seedKey = `hint_e2e_pick_seed_${visual.backgroundId}_${visual.cardBackId}`;
      if (localStorage.getItem(seedKey) === "1") return;
      localStorage.setItem(seedKey, "1");
      localStorage.removeItem("hint_active_tarot_reading_v1");
      localStorage.removeItem(`hint_active_tarot_reading_v2:${localStorage.getItem("hint_anon_id")}`);
      sessionStorage.removeItem(`hint_active_tarot_reading_v2:${localStorage.getItem("hint_anon_id")}`);
      sessionStorage.setItem(
        "hint_active_tarot_reading_v1",
        JSON.stringify({
          version: 1,
          savedAt: Date.now(),
          phase: "pick",
          question: "What is opening now?",
          spreadId: "three",
          focusLabel: "Clear signal",
          design: {
            id: visual.backgroundId,
            label: visual.backgroundId,
            mood: "Quiet oracle room.",
            deckStyleId: visual.cardBackId.includes("Ivory") ? "ivory" : "nocturne",
            backStyle: visual.cardBackId.includes("Ivory") ? "ivory" : "nocturne",
            cardBackId: visual.cardBackId,
            cardArtId: visual.cardArtId,
            backgroundId: visual.backgroundId,
            background: "linear-gradient(180deg,#fff8f1,#ece4ff)",
            glow: "rgba(171,151,255,0.42)",
          },
          selectedCards: [],
          revealedIds: [],
          deck: cards,
        }),
      );
    },
    { cards: deck, visual: visualCase },
  );
}

async function enterWash(page: Page) {
  await page.goto("/app/tarot?hintPreview=embedded");
  const question = page.getByPlaceholder("Type your question...");
  await question.fill("What is opening now?");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: /Use this spread/i }).click();

  await page.getByRole("button", { name: /^Customize/i }).click();
  await page.getByTestId("tarot-room-background-sea").click();
  await page.getByRole("button", { name: /Begin the ritual/i }).click();
  await expect(page.getByRole("button", { name: "Auto Wash" })).toBeVisible();
}

async function chooseArcCard(page: Page) {
  const lift = page.getByRole("button", { name: /Lift card/ }).first();
  await lift.press("Enter");
  const confirm = page.getByRole("button", { name: /Confirm card/ }).first();
  await expect(confirm).toBeVisible();
  await confirm.press("Enter");
}

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blockingViolations = results.violations
    .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target),
    }));

  expect(blockingViolations).toEqual([]);
}

async function expectMinimumTouchTargets(page: Page) {
  const undersized = await page.locator("button, [role='button'], a[href], input, textarea, select").evaluateAll(
    (elements) => elements.flatMap((element) => {
      const target =
        element instanceof HTMLInputElement
        && (element.type === "checkbox" || element.type === "radio")
          ? element.closest("label") ?? element
          : element;
      const rect = target.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (
        style.visibility === "hidden"
        || style.display === "none"
        || rect.width === 0
        || rect.height === 0
        || element.closest("[aria-hidden='true']")
      ) {
        return [];
      }
      if (rect.width >= 44 && rect.height >= 44) return [];
      return [{
        tag: element.tagName.toLowerCase(),
        label:
          element.getAttribute("aria-label")
          || element.textContent?.replace(/\s+/g, " ").trim()
          || element.getAttribute("placeholder")
          || "unlabelled",
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }];
    }),
  );

  expect(undersized).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await seedApp(page);
});

test("phone preview switches between full iPhone hardware frames", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-17-pro-max", "One preview-shell verification");
  await page.goto("/app/tarot?setup=1&hintPreview=frame");

  const deviceSelector = page.getByLabel("Preview device");
  const screen = page.locator("iframe[title$='preview']");
  await expect(deviceSelector).toHaveValue("iphone-17-pro-max");
  await expect(screen).toHaveCSS("width", "440px");
  await expect(screen).toHaveCSS("height", "956px");
  await expect(page.locator(".hint-preview-island")).toHaveCount(1);
  await expect(
    page.frameLocator("iframe[title$='preview']").getByRole("heading", {
      name: "Decorate your room.",
    }),
  ).toBeVisible();

  await deviceSelector.selectOption("iphone-se");
  await expect(screen).toHaveCSS("width", "375px");
  await expect(screen).toHaveCSS("height", "667px");
  await expect(page.locator(".hint-preview-island")).toHaveCount(0);
  await expect(page.locator(".hint-preview-earpiece")).toHaveCount(1);
});

test("Tarot entry has accessible semantics and touch targets", async ({ page }) => {
  await page.goto("/app/tarot?hintPreview=embedded");
  await expect(page.getByRole("heading", { name: "What do you need help seeing clearly?" })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  await expectMinimumTouchTargets(page);
});

test("native packaging files cannot reload an active Tarot screen", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-17-pro-max", "One development file-watcher regression");
  const packagingReloads: string[] = [];
  page.on("websocket", (socket) => {
    socket.on("framereceived", ({ payload }) => {
      try {
        const message = JSON.parse(String(payload)) as { type?: string; path?: string };
        if (message.type === "full-reload" && /^\/(ios|android)\//.test(message.path ?? "")) {
          packagingReloads.push(message.path!);
        }
      } catch {
        // Ignore unrelated socket traffic.
      }
    });
  });
  await page.goto("/app/tarot?hintPreview=embedded");
  const question = page.getByPlaceholder("Type your question...");
  await question.fill("Keep my question open while packaging.");
  const documentStartedAt = await page.evaluate(() => performance.timeOrigin);
  const directories: string[] = [];

  try {
    for (const platform of ["ios", "android"]) {
      const directory = await mkdtemp(fileURLToPath(new URL(`../${platform}/tarot-watch-check-`, import.meta.url)));
      directories.push(directory);
      const html = join(directory, "index.html");
      await writeFile(html, "<!doctype html><title>Packaging check</title>");
      await page.waitForTimeout(350);
      await writeFile(html, "<!doctype html><title>Updated packaging check</title>");
    }
    // Let the dev server's file-watcher debounce and websocket delivery finish.
    await page.waitForTimeout(1_000);
    expect(packagingReloads).toEqual([]);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStartedAt);
    await expect(question).toHaveValue("Keep my question open while packaging.");
  } finally {
    for (const directory of directories) await rm(directory, { recursive: true, force: true });
  }
});

test("Tarot recommendation has accessible semantics and touch targets", async ({ page }) => {
  await page.goto("/app/tarot?hintPreview=embedded");
  await page.getByPlaceholder("Type your question...").fill("What is opening now?");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Three cards", exact: true })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  await expectMinimumTouchTargets(page);
});

test("phone preview presents Personal Spread inside the selected phone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-17-pro-max", "One preview-shell verification");
  await page.setViewportSize({ width: 560, height: 1080 });
  await page.goto("/app/tarot?hintPreview=frame");
  const screen = page.frameLocator("iframe[title$='preview']");
  await expect(page.locator(".hint-launch-intro")).toHaveCount(0);
  await expect(screen.locator(".hint-launch-intro")).toHaveCount(0);
  await screen.getByPlaceholder("Type your question...").fill("What should I know before my next job move?");
  await screen.getByRole("button", { name: "Next", exact: true }).tap();
  await expect(screen.getByText("Matched to your question", { exact: true })).toBeVisible();
  await expect(screen.locator('[data-spread-preview="three"]')).toHaveCSS("opacity", "1");
  await expect(page.locator(".hint-preview-island")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("personal-spread-phone.png") });

  await page.getByLabel("Preview device").selectOption("iphone-se");
  await expect(screen.getByRole("heading", { name: "Three cards", exact: true })).toBeVisible();
  await screen.locator(".hint-app-scroll").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(screen.getByRole("button", { name: "Use this spread" })).toBeInViewport();
  await expect(page.locator(".hint-preview-island")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("personal-spread-se-action.png") });
});

test("spread recommendations keep every layout and full explanation in normal flow", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(({ top, bottom }) => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.setProperty("--hint-safe-top", `${top}px`);
      document.documentElement.style.setProperty("--hint-safe-bottom", `${bottom}px`);
    });
  }, testInfo.project.name === "iphone-se" ? { top: 20, bottom: 0 } : { top: 59, bottom: 34 });
  await page.goto("/app/tarot?hintPreview=embedded");
  await expect(page.locator(".hint-launch-intro")).toHaveCount(0);
  await page.getByPlaceholder("Type your question...").fill("What should I know before my next job move?");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Matched to your question", { exact: true })).toBeVisible();
  await expect(page.locator(".tarot-spread-match")).toHaveCSS("height", "18px");
  await page.getByRole("button", { name: "Previous spread" }).tap();
  const spreads = ["single", "three", "relationship", "futureLover", "peachBlossom", "reconciliation", "trueHeart", "loveTree", "xRelationship"];
  const cardCounts = [1, 3, 3, 7, 5, 7, 5, 7, 9];

  for (const [index, spreadId] of spreads.entries()) {
    const diagram = page.locator(`[data-spread-preview="${spreadId}"]`);
    await expect(diagram).toBeVisible();
    // The incoming diagram exists throughout the horizontal handoff. Measure
    // its final layout only after the track reaches the selected spread.
    await expect(page.getByTestId("spread-preview-stage")).toHaveAttribute("data-spread-motion", "idle");
    await expect(page.locator("[data-spread-preview]")).toHaveCount(1);
    await expect(page.getByTestId("spread-recommendation").getByRole("heading")).toHaveCount(1);
    await expect(diagram.locator(".tarot-spread-card-art")).toHaveCount(cardCounts[index]!);
    await expect(diagram).toHaveCSS("opacity", "1");
    await page.locator(".hint-app-scroll").evaluate((element) => { element.scrollTop = 0; });

    const layout = await page.getByTestId("spread-recommendation").evaluate((element) => {
      const bounds = (selector: string) => {
        const target = element.querySelector(selector)!;
        const box = target.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom };
      };
      const copy = Array.from(element.querySelectorAll("h1, h2, p, li, .tarot-spread-position-label, .tarot-spread-inline-label"));
      const stage = element.querySelector(".tarot-spread-stage")!.getBoundingClientRect();
      const artwork = Array.from(element.querySelectorAll(".tarot-spread-card-art"));
      return {
        story: bounds(".tarot-spread-story"),
        preview: bounds(".tarot-spread-preview"),
        stage: bounds(".tarot-spread-stage"),
        navigation: bounds(".tarot-spread-navigation"),
        description: bounds(".tarot-spread-description"),
        reason: bounds(".tarot-spread-reason"),
        action: bounds(".tarot-spread-use"),
        clipped: copy.filter((item) => item.scrollHeight > item.clientHeight + 1 || item.scrollWidth > item.clientWidth + 1).map((item) => item.textContent),
        clamped: copy.filter((item) => !["none", "", "0"].includes(getComputedStyle(item).webkitLineClamp)).map((item) => item.textContent),
        horizontalOverflow: element.scrollWidth > element.clientWidth + 1,
        artworkInStage: artwork.every((card) => {
          const box = card.getBoundingClientRect();
          return box.left >= stage.left && box.right <= stage.right && box.top >= stage.top && box.bottom <= stage.bottom;
        }),
      };
    });
    expect(layout.clipped).toEqual([]);
    expect(layout.clamped).toEqual([]);
    expect(layout.horizontalOverflow).toBe(false);
    expect(layout.artworkInStage).toBe(true);
    if (spreadId === "single" || spreadId === "three") {
      for (const card of await diagram.locator(".tarot-spread-card-art").all()) {
        const box = (await card.boundingBox())!;
        expect(box.width / box.height).toBeCloseTo(2 / 3, 2);
      }
    }
    expect(layout.preview.top - layout.story.bottom).toBeGreaterThanOrEqual(19);
    expect(layout.description.top).toBeGreaterThanOrEqual(layout.stage.bottom - 1);
    expect(layout.navigation.top).toBeGreaterThanOrEqual(layout.stage.bottom - 1);
    expect(layout.description.top).toBeGreaterThan(layout.navigation.bottom);
    await expect(page.locator(".tarot-spread-preview-heading .tarot-spread-size")).toHaveText(`${cardCounts[index]} ${cardCounts[index] === 1 ? "card" : "cards"}`);
    for (const arrow of await page.locator(".tarot-spread-stage button").all()) {
      const box = (await arrow.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(48);
      expect(box.height).toBeGreaterThanOrEqual(48);
    }
    expect(layout.reason.top).toBeGreaterThan(layout.preview.bottom);
    expect(layout.action.top - layout.reason.bottom).toBeGreaterThanOrEqual(23);
    expect((await page.locator(".tarot-spread-reason-copy").innerText()).length).toBeGreaterThan(20);
    await page.screenshot({ path: testInfo.outputPath(`spread-${spreadId}.png`) });
    if (spreadId === "three") {
      await expect(page.locator(".tarot-spread-position-legend li").first()).toHaveCSS("font-size", "12px");
      const action = (await page.getByRole("button", { name: "Use this spread" }).boundingBox())!;
      if (testInfo.project.name === "iphone-17-pro-max") {
        expect(action.y + action.height).toBeLessThan(page.viewportSize()!.height - 54);
      }
    }

    if (index < spreads.length - 1) await page.getByRole("button", { name: "Next spread" }).tap();
  }

  await expect(page.getByRole("button", { name: "Next spread" })).toBeDisabled();
  await page.locator(".hint-app-scroll").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const scrollArea = (await page.locator(".tarot-spread-scroll").boundingBox())!;
  const back = (await page.getByRole("button", { name: "Back", exact: true }).boundingBox())!;
  expect(scrollArea.y).toBeGreaterThanOrEqual(back.y + back.height);
  const action = await page.getByRole("button", { name: "Use this spread" }).boundingBox();
  expect(action!.y + action!.height).toBeLessThanOrEqual(page.viewportSize()!.height - 20);
  await page.screenshot({ path: testInfo.outputPath("spread-action-safe-area.png") });
  await page.getByRole("button", { name: "Use this spread" }).tap();
  await expect(page.getByRole("heading", { name: "Your reading is ready." })).toBeVisible();
  await expect(page.getByText("X Relationship", { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("spread preview ignores hover and cancelled gestures and restores a readable reason", async ({ page }) => {
  await page.goto("/app/tarot?hintPreview=embedded");
  await page.getByPlaceholder("Type your question...").fill("What is opening now?");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Matched to your question", { exact: true })).toBeVisible();
  const stage = page.getByTestId("spread-preview-stage");
  const box = (await stage.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const transform = await page.locator(".tarot-spread-diagram").evaluate((element) => getComputedStyle(element).transform);
  await page.mouse.move(x, y);
  await page.mouse.move(x + 70, y);
  expect(await page.locator(".tarot-spread-diagram").evaluate((element) => getComputedStyle(element).transform)).toBe(transform);

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 80, y, { steps: 8 });
  await stage.dispatchEvent("pointercancel", { pointerId: 1, pointerType: "mouse", isPrimary: true });
  await page.mouse.up();
  await expect(page.locator('[data-spread-preview="three"]')).toBeVisible();

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 85, y, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('[data-spread-preview="relationship"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-spread-preview="relationship"]')).toBeVisible();
  await expect(page.locator(".tarot-spread-reason-copy")).not.toBeEmpty();
  await page.getByRole("button", { name: "Back", exact: true }).tap();
  await expect(page.getByPlaceholder("Type your question...")).toHaveValue("What is opening now?");
});

test("Tarot room setup has accessible semantics and touch targets", async ({ page }) => {
  await page.goto("/app/tarot?hintPreview=embedded&setup=1");
  await expect(page.getByRole("heading", { name: "Decorate your room." })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  await expectMinimumTouchTargets(page);
});

test("Tarot wash has accessible semantics and touch targets", async ({ page }) => {
  await enterWash(page);
  await expect(page.getByRole("button", { name: "Auto Wash" })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  await expectMinimumTouchTargets(page);
});

test("Tarot arc has accessible semantics and touch targets", async ({ page }) => {
  await seedPickSession(page, VISUAL_CASES[0]);
  await page.goto("/app/tarot?hintPreview=embedded");
  await expect(page.getByRole("heading", { name: "Pick Cards" })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  await expectMinimumTouchTargets(page);
});

test("Tarot reading has accessible semantics and touch targets", async ({ page }) => {
  await seedReadingSession(page, VISUAL_CASES[1]);
  await page.goto("/app/tarot?hintPreview=embedded");
  await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  await expectMinimumTouchTargets(page);
});

for (const reduced of [false, true]) {
  test(`card zoom tip stays readable and acknowledges interaction (${reduced ? "reduced" : "normal"} motion)`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    await seedReadingSession(page, VISUAL_CASES[1]);
    await page.goto("/app/tarot?hintPreview=embedded");
    const tip = page.getByTestId("tarot-card-tip");
    await expect(tip).toContainText("Open any card, then tap or pinch to zoom in on the artwork.");
    await expect(page.locator(".hint-launch-intro")).toHaveCount(0);
    await expectMinimumTouchTargets(page);
    await page.screenshot({ path: testInfo.outputPath("card-zoom-tip.png") });
    // Reading time is independent of animation preferences; the old tip vanished
    // after 3.2 seconds under reduced motion and was never offered again.
    await page.waitForTimeout(5_000);
    await expect(tip).toBeVisible();
    await page.reload();
    await expect(tip).toBeVisible(); // Displaying it alone is not acknowledgment.
    await page.getByRole("button", { name: /^Preview / }).first().tap();
    await expect(page.getByRole("dialog", { name: "The Fool" })).toBeVisible();
    await expect(tip).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
    await page.waitForTimeout(700);
    await expect(tip).toHaveCount(0);
    await seedReadingSession(page, VISUAL_CASES[0]);
    await page.reload();
    await expect(tip).toBeVisible(); // A different reading gets its own tip.
    await page.getByRole("button", { name: "Dismiss card tip" }).tap();
    await page.reload();
    await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
    await page.waitForTimeout(700);
    await expect(tip).toHaveCount(0);
  });
}

test("card detail stays gesture-first without visible zoom controls", async ({ page }) => {
  await seedReadingSession(page, VISUAL_CASES[1]);
  await page.goto("/app/tarot?hintPreview=embedded");
  await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
  await expect(page.getByText("Tap a card to look closer", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dismiss card tip" }).click();

  const card = page.getByRole("button", { name: /^Preview / }).first();
  const beforeHover = await card.boundingBox();
  await card.hover();
  await page.waitForTimeout(240);
  const afterHover = await card.boundingBox();
  expect(beforeHover).not.toBeNull();
  expect(afterHover).not.toBeNull();
  expect(Math.abs((afterHover?.x ?? 0) - (beforeHover?.x ?? 0))).toBeLessThan(0.5);
  expect(Math.abs((afterHover?.y ?? 0) - (beforeHover?.y ?? 0))).toBeLessThan(0.5);

  await card.click();
  const detail = page.getByRole("dialog", { name: "The Fool" });
  await expect(detail).toBeVisible();
  await expect(detail.getByRole("button", { name: "Zoom in" })).toHaveCount(0);
  await expect(detail.getByRole("button", { name: "Zoom out" })).toHaveCount(0);
  const pinchScale = await detail.locator(".touch-none").evaluate(async (surface) => {
    // WebKit disallows constructing Touch. Dispatch the same event data through
    // the browser handlers; physical gesture recognition remains a device gate.
    const touch = (type: string, xs: number[]) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const touches = xs.map((clientX, identifier) => ({ identifier, target: surface, clientX, clientY: 300 }));
      Object.defineProperty(touches, "item", { value: (index: number) => touches[index] ?? null });
      Object.defineProperty(event, "touches", { value: touches });
      surface.dispatchEvent(event);
    };
    touch("touchstart", [150, 250]);
    touch("touchmove", [150, 295]);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const transform = getComputedStyle(surface.querySelector('[data-testid="tarot-card-zoom"]')!).transform;
    touch("touchcancel", []);
    return transform === "none" ? 1 : new DOMMatrixReadOnly(transform).a;
  });
  expect(pinchScale).toBeCloseTo(1.45, 2);
  // Changing cards cancels the gesture and restores the same neutral zoom.
  await detail.getByRole("button", { name: "Next card" }).tap();
  await page.getByRole("dialog", { name: "The Empress" }).getByRole("button", { name: "Previous card" }).tap();
  const zoomToggle = detail.getByRole("button", { name: "Toggle card zoom" });
  await expect(zoomToggle).toHaveAttribute("aria-pressed", "false");
  await zoomToggle.click();
  await expect(zoomToggle).toHaveAttribute("aria-pressed", "true");
  await detail.getByRole("button", { name: "Next card" }).click();
  await expect(page.getByRole("dialog", { name: "The Empress" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Toggle card zoom" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("deeper demo reading is explicit, durable, and leaves the original reading private", async ({ page }, testInfo) => {
  await seedReadingSession(page, VISUAL_CASES[1]);
  let requests = 0;
  const detailSummary = "The cards connect your earlier expectations with a practical next step. Keep the original direction, and test it through one small conversation before making a larger commitment.";
  await page.route("**/api/tarot/structured-reading", async (route) => {
    const body = route.request().postDataJSON();
    if (body.depth !== "detailed") return route.fallback();
    requests += 1;
    expect(body.originalReading.overall_summary).toBe(READING_SUMMARY);
    expect(body.requiredCardCount).toBe(3);
    expect(body.additionalContext).toBe("I keep changing my mind when I feel rushed.");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      source: "api", signal_type: "opening", overall_summary: detailSummary,
      cards: body.cards.map((card: { name: string; orientation: string; position: string }) => ({
        card_name: card.name, orientation: card.orientation, position: card.position,
        meaning: "This position shows how an earlier assumption shapes the question. Compare it with the next card, and notice what you can test in a small, honest step.",
      })),
      final_action_advice: "Name one thing you can ask about directly. Give yourself time to observe the response before deciding.",
      follow_up_invitation: "Which part of this feels closest to your situation?",
      cards_connection: "The past expectation adds pressure to the present choice; the next card suggests testing that pressure before acting.",
      watch_for: "Notice whether your preference stays the same after a quiet conversation without a deadline.",
    }) });
  });
  await page.goto("/app/tarot?hintPreview=embedded");
  await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
  const readSaved = () => page.evaluate(() => JSON.parse(localStorage.getItem("hint_local_tarot_readings_v1") ?? "[]")[0]);
  await expect(page.locator(".hint-launch-intro")).toHaveCount(0);
  const cardTip = page.getByRole("button", { name: "Dismiss card tip" });
  if (await cardTip.isVisible()) await cardTip.tap();
  const original = await readSaved();
  expect(requests).toBe(0);
  await page.getByPlaceholder("What's the main thing making this difficult?").fill("I keep changing my mind when I feel rushed.");
  await page.reload();
  await expect(page.getByPlaceholder("What's the main thing making this difficult?")).toHaveValue("I keep changing my mind when I feel rushed.");
  await page.getByRole("button", { name: "Explore deeper · Free demo" }).tap();
  await expect(page.getByTestId("tarot-detailed-reading")).toBeVisible();
  await expect(page.getByTestId("tarot-detailed-reading")).toContainText(detailSummary);
  const saved = await readSaved();
  expect(saved.shortAnswer).toBe(original.shortAnswer);
  expect(saved.cards).toEqual(original.cards);
  expect(saved.roomDesign).toEqual(original.roomDesign);
  expect(saved.chatMessages).toEqual(original.chatMessages);
  expect(saved.detailedReading.overall_summary).toBe(detailSummary);
  for (const name of ["Why this answer", "How the cards connect", "What to watch for", "Your next step"]) {
    await expect(page.getByTestId("tarot-detailed-reading").getByRole("heading", { name, exact: true })).toHaveCount(1);
  }
  await page.getByRole("button", { name: "Somewhat", exact: true }).tap();
  expect((await readSaved()).detailedFeedback).toBe("somewhat");
  await expectNoSeriousAccessibilityViolations(page);
  await expectMinimumTouchTargets(page);
  await page.getByTestId("tarot-detailed-reading").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("deeper-reading.png") });
  await page.reload();
  await page.getByRole("button", { name: "Read your deeper interpretation" }).tap();
  await expect(page.getByTestId("tarot-detailed-reading")).toContainText(detailSummary);
  expect(requests).toBe(1);
  await expect(page.getByRole("button", { name: "Somewhat", exact: true })).toHaveAttribute("aria-pressed", "true");
  let chatRequests = 0;
  const followUpReply = "Use one quiet conversation to check whether your preference stays steady.";
  await page.route("**/api/tarot/chat", async (route) => {
    chatRequests += 1;
    const body = route.request().postDataJSON();
    expect(body.initialReading).toContain(READING_SUMMARY);
    expect(body.initialReading).toContain(detailSummary);
    expect(body.initialReading).toContain("I keep changing my mind when I feel rushed.");
    expect(body.initialReading).toContain("Name one thing you can ask about directly.");
    expect(body.initialReading.length).toBeLessThanOrEqual(8000);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "api", message: followUpReply }) });
  });
  await page.getByPlaceholder("Ask what you want to understand next...").fill("How do I try this next step?");
  await page.getByRole("button", { name: "Send follow-up" }).tap();
  await expect(page.getByText(followUpReply, { exact: true })).toBeVisible();
  expect(chatRequests).toBe(1);
  await page.getByRole("button", { name: "Receive", exact: true }).tap();
  await expect(page.getByRole("dialog", { name: "A letter to keep" })).not.toContainText(detailSummary);
  await expect(page.getByRole("dialog", { name: "A letter to keep" })).not.toContainText(followUpReply);
});

test("deeper demo reading failure is retryable without a silent upgrade", async ({ page }) => {
  await seedReadingSession(page, VISUAL_CASES[1]);
  let requests = 0;
  await page.route("**/api/tarot/structured-reading", (route) => {
    if (route.request().postDataJSON().depth !== "detailed") return route.fallback();
    requests += 1;
    return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Unavailable" }) });
  });
  await page.goto("/app/tarot?hintPreview=embedded");
  await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Explore deeper · Free demo" }).tap();
  await expect(page.getByRole("alert")).toContainText("original answer is unchanged");
  await page.getByRole("button", { name: "Retry deeper reading · Free demo" }).tap();
  await expect(page.getByRole("alert")).toContainText("original answer is unchanged");
  expect(requests).toBe(2);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("hint_local_tarot_readings_v1") ?? "[]")[0]);
  expect(saved.shortAnswer).toBe(READING_SUMMARY);
  expect(saved.detailedReading).toBeUndefined();
  await page.reload();
  await expect(page.getByRole("button", { name: "Explore deeper · Free demo" })).toBeAttached();
  expect(requests).toBe(2);
});

for (const motionMode of ["normal", "system", "hint"] as const) {
  test(`deeper reading motion is reversible and respects ${motionMode} motion`, async ({ page }) => {
    await seedReadingSession(page, VISUAL_CASES[1]);
    await page.emulateMedia({ reducedMotion: motionMode === "system" ? "reduce" : "no-preference" });
    await page.goto("/app/tarot?hintPreview=embedded");
    await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Explore deeper · Free demo" }).tap();
    await expect(page.getByTestId("tarot-detailed-reading")).toHaveAttribute("data-open", "true");
    await page.getByRole("button", { name: "Close deeper interpretation" }).tap();
    const panel = page.getByTestId("tarot-detailed-reading");
    await expect.poll(() => panel.evaluate((node) => node.getBoundingClientRect().height)).toBe(0);
    if (motionMode === "hint") {
      await page.evaluate(() => {
        const key = "hint.preferences.v1";
        localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key) ?? "{}"), reduceMotion: true }));
        window.dispatchEvent(new Event("hint:preferences-updated"));
      });
      await page.reload();
    }
    const open = page.getByRole("button", { name: "Read your deeper interpretation" });
    await open.scrollIntoViewIfNeeded();
    const samples = await open.evaluate((button) => new Promise<number[]>((resolve) => {
      const panel = document.querySelector('[data-testid="tarot-detailed-reading"]')!;
      const start = performance.now();
      const heights: number[] = [];
      (button as HTMLButtonElement).click();
      const frame = () => {
        heights.push(panel.getBoundingClientRect().height);
        if (performance.now() - start < 500) requestAnimationFrame(frame);
        else resolve(heights);
      };
      requestAnimationFrame(frame);
    }));
    const final = samples.at(-1)!;
    expect(final).toBeGreaterThan(100);
    const intermediate = samples.filter((height) => height > 1 && height < final - 1);
    if (motionMode === "normal") expect(intermediate.length).toBeGreaterThan(3);
    else expect(intermediate.length).toBeLessThanOrEqual(1);
    // Reverse an in-flight close without remounting or generating another reading.
    await page.getByRole("button", { name: "Close deeper interpretation" }).evaluate(async (button) => {
      (button as HTMLButtonElement).click();
      await new Promise((resolve) => setTimeout(resolve, 60));
      (button as HTMLButtonElement).click();
    });
    await expect(panel).toHaveAttribute("aria-hidden", "false");
    await expect.poll(() => panel.evaluate((node) => node.getBoundingClientRect().height)).toBeCloseTo(final, 0);
    await page.getByRole("button", { name: "Back to short answer" }).tap();
    await expect(page.getByTestId("tarot-short-answer")).toBeFocused();
    await expect(page.getByTestId("tarot-short-answer")).toBeInViewport({ ratio: 1 });
    await expect(panel).toHaveAttribute("inert", "");
    await expect.poll(() => panel.evaluate((node) => node.getBoundingClientRect().height)).toBe(0);
  });
}

test("completes and restores the full Tarot Room journey", async ({ page }) => {
  const consoleErrors: string[] = [];
  let structuredReadingRequests = 0;
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    if (request.url().includes("/api/tarot/structured-reading")) {
      structuredReadingRequests += 1;
    }
  });

  await enterWash(page);
  await expect(page.getByText("78 cards", { exact: true })).toBeVisible();
  await expect(page.locator('[data-room-background="sea"]')).toBeVisible();
  await page.getByRole("button", { name: "Auto Wash" }).click();
  await expect(page.getByRole("heading", { name: "Cutting the deck." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Shuffling the deck." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The deck is ready." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick Cards" })).toBeVisible();
  await expect(page.locator('[data-room-background="sea"]')).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Pick Cards" })).toBeVisible();

  const wheel = page.getByLabel("Rotating tarot deck wheel");
  await expect(wheel).toHaveAttribute("data-deck-size", "78");
  expect(await page.getByRole("button", { name: /Lift card/ }).count()).toBeGreaterThan(30);
  const card19 = page.getByRole("button", { name: "Lift card 19" });
  const card20 = page.getByRole("button", { name: "Lift card 20" });
  const compactLayers = await Promise.all([
    card19.evaluate((element) => Number(getComputedStyle(element).zIndex)),
    card20.evaluate((element) => Number(getComputedStyle(element).zIndex)),
  ]);
  expect(compactLayers[0]).toBeGreaterThan(compactLayers[1]);

  const compactCardBox = await card20.boundingBox();
  await page.getByRole("button", { name: "Expand deck" }).click();
  const expandedCardBox = await card20.boundingBox();
  const expandedLayers = await Promise.all([
    card19.evaluate((element) => Number(getComputedStyle(element).zIndex)),
    card20.evaluate((element) => Number(getComputedStyle(element).zIndex)),
  ]);
  expect(expandedLayers).toEqual(compactLayers);
  expect(expandedCardBox?.width ?? 0).toBeGreaterThan(compactCardBox?.width ?? 0);
  await page.getByRole("button", { name: "Close expanded deck" }).click();

  const wheelBox = await wheel.boundingBox();
  if (wheelBox) {
    const centerX = wheelBox.x + wheelBox.width / 2;
    const centerY = wheelBox.y + wheelBox.height / 2;
    await wheel.dispatchEvent("pointerdown", {
      pointerId: 41,
      pointerType: "touch",
      clientX: centerX - 30,
      clientY: centerY,
    });
    await wheel.dispatchEvent("pointerdown", {
      pointerId: 42,
      pointerType: "touch",
      clientX: centerX + 30,
      clientY: centerY,
    });
    await wheel.dispatchEvent("pointermove", {
      pointerId: 42,
      pointerType: "touch",
      clientX: centerX + 58,
      clientY: centerY,
    });
    await expect(page.getByRole("button", { name: "Close expanded deck" })).toBeVisible();
    await wheel.dispatchEvent("pointerup", { pointerId: 42, pointerType: "touch" });
    await wheel.dispatchEvent("pointerup", { pointerId: 41, pointerType: "touch" });
    await page.getByRole("button", { name: "Close expanded deck" }).click();
  }

  await page.getByRole("button", { name: "Tarot room setup" }).click();
  await expect(page.getByRole("heading", { name: "Decorate your room." })).toBeVisible();
  await page.getByRole("button", { name: "Save room" }).click();
  await expect(page.getByRole("heading", { name: "Pick Cards" })).toBeVisible();

  await chooseArcCard(page);
  await expect(page.getByText("Three cards - 1 of 3 chosen", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Three cards - 1 of 3 chosen", { exact: true })).toBeVisible();
  await chooseArcCard(page);
  await chooseArcCard(page);
  await expect(page.getByText("Three cards - 3 of 3 chosen", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Reveal Reading/i }).click();
  await expect(page.getByText("The cards are open.", { exact: true })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  await expectMinimumTouchTargets(page);
  await page.getByRole("button", { name: "Read my Hint" }).click();
  await expect(page.getByText("Reading the cards...", { exact: true })).toBeVisible();
  await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
  await expect(page.locator('[data-room-background="sea"]')).toBeVisible();
  await expect(page.getByText("3 cards", { exact: true })).toBeVisible();
  const followUp = "What should I do next?";
  const followUpReply =
    "Choose the smallest honest action, then leave enough space to notice what changes.";
  await page.getByPlaceholder("Ask what you want to understand next...").fill(followUp);
  await page.getByRole("button", { name: "Send follow-up" }).click();
  await expect(page.getByText(followUpReply, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Receive", exact: true }).click();
  const receipt = page.getByRole("dialog", { name: "A letter to keep" });
  await expect(receipt).toBeVisible();
  await expect(receipt.getByRole("button", { name: "Share receipt", exact: true })).toBeEnabled();
  await expect(receipt.getByRole("checkbox")).not.toBeChecked();
  const [receiptDownload] = await Promise.all([
    page.waitForEvent("download"),
    receipt.getByRole("button", { name: "Share receipt", exact: true }).click(),
  ]);
  expect(receiptDownload.suggestedFilename()).toMatch(/^hint-tarot-.*\.png$/);
  const receiptPath = await receiptDownload.path();
  expect(receiptPath).not.toBeNull();
  const receiptBytes = await readFile(receiptPath!);
  expect(receiptBytes.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  expect(receiptBytes.readUInt32BE(16)).toBe(1_800);
  expect(receiptBytes.readUInt32BE(20)).toBeGreaterThanOrEqual(2_800);
  expect(receiptBytes.readUInt32BE(20)).toBeLessThanOrEqual(8_192);
  expect(receiptBytes.byteLength).toBeGreaterThan(50_000);

  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("hint_local_tarot_readings_v1") ?? "[]"),
  );
  expect(saved[0]).toMatchObject({
    schemaVersion: 2,
    spreadType: "three",
    roomDesign: { backgroundId: "sea" },
  });
  expect(saved[0].cards).toHaveLength(3);
  expect(saved[0].chatMessages).toMatchObject([
    { role: "user", content: followUp },
    { role: "assistant", content: followUpReply },
  ]);

  await page.evaluate(() => {
    sessionStorage.removeItem("hint_active_tarot_reading_v1");
    sessionStorage.removeItem(`hint_active_tarot_reading_v2:${localStorage.getItem("hint_anon_id")}`);
  });
  await page.goto("/app/tarot?hintPreview=embedded");
  await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByText(followUp, { exact: true })).toBeVisible();
  await expect(page.getByText(followUpReply, { exact: true })).toBeVisible();
  expect(structuredReadingRequests).toBe(1);

  await page.getByRole("button", { name: "Open reading history" }).click();
  const leaveDialog = page.getByRole("dialog", { name: "Leave this space?" });
  await expect(leaveDialog).toBeVisible();
  await expect(leaveDialog).toContainText("Saved readings, personal details and today’s cards are kept.");
  await leaveDialog.getByRole("button", { name: "Leave and start fresh", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/readings$/);
  await page.getByRole("link", { name: /Three cards/i }).first().click();
  await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
  await expect(page.getByTestId("tarot-history-detail")).toHaveAttribute(
    "data-room-background",
    "sea",
  );
  await expectNoSeriousAccessibilityViolations(page);
  await expectMinimumTouchTargets(page);
  await page.getByRole("button", { name: /Return to chat/i }).click();
  await expect(page).toHaveURL(/\/app\/tarot\?reading=.*returnTo=detail/);
  await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
  await expect(page.locator('[data-room-background="sea"]')).toBeVisible();
  await expect(page.getByRole("main").getByText(followUp, { exact: true })).toBeVisible();
  await expect(page.getByText(followUpReply, { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "App" })).toHaveCount(0);
  await expectNoSeriousAccessibilityViolations(page);
  await expectMinimumTouchTargets(page);

  const frameBounds = await page.getByTestId("tarot-phone-frame").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(frameBounds.scrollWidth).toBeLessThanOrEqual(frameBounds.clientWidth + 1);
  expect(frameBounds.scrollHeight).toBeLessThanOrEqual(frameBounds.clientHeight + 1);
  expect(consoleErrors).toEqual([]);
});

test("a tap without movement cannot finish a manual wash", async ({ page }) => {
  await enterWash(page);
  const table = page.getByTestId("tarot-wash-table");
  const box = await table.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await table.dispatchEvent("pointerdown", {
    pointerId: 8,
    pointerType: "touch",
    clientX: point.x,
    clientY: point.y,
  });
  await table.dispatchEvent("pointerup", {
    pointerId: 8,
    pointerType: "touch",
    clientX: point.x,
    clientY: point.y,
  });
  await expect(page.getByRole("button", { name: "Auto Wash" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cutting the deck." })).toHaveCount(0);
});

test("the wash table stops repainting while idle or after a rejected gesture", async ({
  page,
}) => {
  await enterWash(page);
  const table = page.getByTestId("tarot-wash-table");
  const cardTransforms = () =>
    table.locator("[data-wash-card]").evaluateAll((elements) =>
      elements.map((element) => (element as HTMLElement).style.transform),
    );

  await page.waitForTimeout(850);
  const idleBefore = await cardTransforms();
  await page.waitForTimeout(240);
  expect(await cardTransforms()).toEqual(idleBefore);

  const box = await table.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await table.dispatchEvent("pointerdown", {
    pointerId: 18,
    pointerType: "touch",
    clientX: point.x,
    clientY: point.y,
  });
  await table.dispatchEvent("pointerup", {
    pointerId: 18,
    pointerType: "touch",
    clientX: point.x,
    clientY: point.y,
  });

  await page.waitForTimeout(80);
  const rejectedBefore = await cardTransforms();
  await page.waitForTimeout(240);
  expect(await cardTransforms()).toEqual(rejectedBefore);
  await expect(page.getByRole("button", { name: "Auto Wash" })).toBeVisible();
});

test("a real manual wash release completes the automatic ritual", async ({ page }) => {
  await enterWash(page);
  const table = page.getByTestId("tarot-wash-table");
  const box = await table.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const radiusX = Math.min(box.width * 0.24, 92);
  const radiusY = Math.min(box.height * 0.2, 78);
  const pointerId = 27;
  const points = Array.from({ length: 9 }, (_, index) => {
    const angle = (index / 8) * Math.PI * 1.4;
    return {
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
    };
  });

  await table.dispatchEvent("pointerdown", {
    pointerId,
    pointerType: "touch",
    clientX: points[0]!.x,
    clientY: points[0]!.y,
  });
  for (const point of points.slice(1)) {
    await page.waitForTimeout(10);
    await table.dispatchEvent("pointermove", {
      pointerId,
      pointerType: "touch",
      clientX: point.x,
      clientY: point.y,
    });
  }

  await expect(
    page.getByText("Sweep gently clockwise. Lift your hand when you feel ready.", {
      exact: true,
    }),
  ).toBeVisible();
  await table.dispatchEvent("pointerup", {
    pointerId,
    pointerType: "touch",
    clientX: points.at(-1)!.x,
    clientY: points.at(-1)!.y,
  });

  await expect(page.getByRole("heading", { name: "Cutting the deck." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Shuffling the deck." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The deck is ready." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick Cards" })).toBeVisible();
  await expect(page.getByLabel("Rotating tarot deck wheel")).toHaveAttribute(
    "data-deck-size",
    "78",
  );
});

test("rapid Auto Wash requests advance through one ordered ritual", async ({ page }) => {
  await enterWash(page);
  await page.getByRole("button", { name: "Auto Wash" }).evaluate((button) => {
    button.click();
    button.click();
    button.click();
  });
  await expect(page.getByRole("heading", { name: "Cutting the deck." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Shuffling the deck." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The deck is ready." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick Cards" })).toBeVisible();
});

test("an interrupted automatic ritual restarts from its stable prepare stage", async ({ page }) => {
  await enterWash(page);
  await page.getByRole("button", { name: "Auto Wash" }).click();
  await expect(page.getByRole("heading", { name: "Cutting the deck." })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hold your question in your mind." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Auto Wash" })).toBeVisible();
});

test("a backgrounded cut restarts from Prepare when the iPhone returns", async ({ page }) => {
  await enterWash(page);
  await page.getByRole("button", { name: "Auto Wash" }).click();
  await expect(page.getByRole("heading", { name: "Cutting the deck." })).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await expect(
    page.getByRole("heading", { name: "Hold your question in your mind." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Auto Wash" })).toBeVisible();
});

test("an active ritual survives a terminated and reopened webview", async ({ page, context }) => {
  await enterWash(page);
  await expect.poll(() =>
    page.evaluate(() => localStorage.getItem(`hint_active_tarot_reading_v2:${localStorage.getItem("hint_anon_id")}`)),
  ).toContain('"phase":"prepare"');
  const reopenUrl = page.url();

  await page.close();
  const reopenedPage = await context.newPage();
  await reopenedPage.goto(reopenUrl);

  await expect(
    reopenedPage.getByRole("heading", { name: "Hold your question in your mind." }),
  ).toBeVisible();
  await expect(reopenedPage.getByRole("button", { name: "Auto Wash" })).toBeVisible();
});

test("a cancelled wash gesture stays in the wash stage", async ({ page }) => {
  await enterWash(page);
  const table = page.getByTestId("tarot-wash-table");
  const box = await table.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const start = { x: box.x + box.width * 0.44, y: box.y + box.height * 0.48 };
  await table.dispatchEvent("pointerdown", {
    pointerId: 19,
    pointerType: "touch",
    clientX: start.x,
    clientY: start.y,
  });
  await table.dispatchEvent("pointermove", {
    pointerId: 19,
    pointerType: "touch",
    clientX: start.x + 62,
    clientY: start.y + 28,
  });
  await table.dispatchEvent("pointercancel", {
    pointerId: 19,
    pointerType: "touch",
    clientX: start.x + 62,
    clientY: start.y + 28,
  });
  await expect(page.getByRole("button", { name: "Auto Wash" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cutting the deck." })).toHaveCount(0);
});

test("voice unavailability keeps a clear typed fallback", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto("/app/tarot?hintPreview=embedded");
  await page.getByRole("button", { name: "Voice input" }).click();
  await expect(
    page.getByText(
      "Voice input is not available in this browser. Try a browser with microphone dictation, or type it here.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText("Voice input stopped.", { exact: true })).toBeVisible();
  await expect(page.getByText("I'm listening...", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel" }).click();
  const question = page.getByPlaceholder("Type your question...");
  await question.fill("I will type this question instead.");
  await expect(question).toHaveValue("I will type this question instead.");
});

async function openCompletedVoiceSheet(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    class TestSpeechRecognition {
      continuous = true;
      interimResults = true;
      lang = "en-US";
      maxAlternatives = 1;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      receive = (event: Event) => {
        this.onresult?.({
          resultIndex: 0,
          results: [{ isFinal: true, 0: { transcript: (event as CustomEvent<string>).detail } }],
        });
        this.stop();
      };
      start() { window.addEventListener("hint-test-speech", this.receive); }
      stop() {
        window.removeEventListener("hint-test-speech", this.receive);
        this.onend?.();
      }
      abort() { this.stop(); }
    }
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: TestSpeechRecognition });
  });
  await page.goto("/app/tarot?hintPreview=embedded");
  await page.getByRole("button", { name: "Voice input" }).click();
  const sheet = page.getByRole("dialog", { name: "Voice input" });
  await expect(sheet.getByText("I'm listening...", { exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("hint-test-speech", {
    detail: "What should I notice today?",
  })));
  await expect(sheet.getByText("Your question is ready.", { exact: true })).toBeVisible();
  await expect(sheet.getByText("What should I notice today?", { exact: true })).toBeVisible();
  return sheet;
}

test("voice completion keeps the transcript usable in the phone sheet", async ({ page }) => {
  const sheet = await openCompletedVoiceSheet(page);
  await expectMinimumTouchTargets(page);
  await sheet.getByRole("button", { name: "Use this question" }).click();
  await expect(page.getByPlaceholder("Type your question...")).toHaveValue("What should I notice today?");
});

test("voice completion sheet matches its pixel golden", async ({ page }) => {
  const sheet = await openCompletedVoiceSheet(page);
  await expect(sheet).toHaveScreenshot("voice-ready.png", { animations: "disabled" });
});

test("cancelling receipt sharing stays quiet and allows sharing again", async ({ page }) => {
  await seedReadingSession(page, VISUAL_CASES[0]);
  await page.goto("/app/tarot?hintPreview=embedded");
  await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
  await page.evaluate(() => {
    let attempts = 0;
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        attempts += 1;
        if (attempts === 1) throw new DOMException("Dismissed", "AbortError");
      },
    });
  });
  await page.getByRole("button", { name: "Receive", exact: true }).click();
  const receipt = page.getByRole("dialog", { name: "A letter to keep" });
  const share = receipt.getByRole("button", { name: "Share receipt", exact: true });
  await share.click();
  await expect(share).toBeEnabled();
  await expect(receipt.getByText("Shared", { exact: true })).toHaveCount(0);
  await expect(receipt.getByText(/could not|try again/i)).toHaveCount(0);
  await share.click();
  await expect(receipt.getByText("Shared", { exact: true })).toBeVisible();
});

test("receipt preview and exported PNG keep the question and chat private by default", async ({ page }, testInfo) => {
  await seedReadingSession(page, VISUAL_CASES[1]);
  const question = "What is opening now?";
  const privateAnswer = `For ${question} the confidential Northstar project needs a calm next step.`;
  const privateChat = "My private follow-up concerns a confidential salary offer.";
  await page.route("**/api/tarot/structured-reading", async (route) => {
    const request = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      source: "api", signal_type: "opening", overall_summary: privateAnswer,
      cards: request.cards.map((card: { position: string; name: string; orientation: string }) => ({
        position: card.position, card_name: card.name, orientation: card.orientation, meaning: "A complete explanation of this card.",
      })),
      final_action_advice: "Choose a thoughtful next step.", follow_up_invitation: "What next?",
    }) });
  });
  await page.goto("/app/tarot?hintPreview=embedded");
  await expect(page.locator(".hint-launch-intro")).toHaveCount(0);
  await expect(page.getByText(privateAnswer, { exact: true })).toBeVisible();
  await page.getByPlaceholder("Ask what you want to understand next...").fill(privateChat);
  await page.getByRole("button", { name: "Send follow-up" }).tap();
  await expect(page.getByText("Choose the smallest honest action, then leave enough space to notice what changes.", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const state = window as Window & { receiptDrawnText: string[] };
    state.receiptDrawnText = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      state.receiptDrawnText.push(text);
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
  });
  await page.getByRole("button", { name: "Receive", exact: true }).tap();
  const receipt = page.getByRole("dialog", { name: "A letter to keep" });
  await expect(receipt.getByRole("button", { name: "Share receipt", exact: true })).toBeEnabled();
  for (const includeQuestion of [false, true, false]) {
    if ((await receipt.getByRole("checkbox").isChecked()) !== includeQuestion) {
      await page.evaluate(() => { (window as Window & { receiptDrawnText: string[] }).receiptDrawnText = []; });
      await receipt.getByRole("checkbox").setChecked(includeQuestion);
    }
    await expect(receipt).not.toContainText(privateChat);
    if (includeQuestion) await expect(receipt.getByTestId("receipt-insight")).toHaveText(privateAnswer);
    else {
      await expect(receipt).not.toContainText(question);
      await expect(receipt).not.toContainText("Northstar");
    }
    const download = page.waitForEvent("download");
    await receipt.getByRole("button", { name: "Share receipt", exact: true }).tap();
    const image = await download;
    await image.saveAs(testInfo.outputPath(includeQuestion ? "receipt-opt-in.png" : "receipt-private.png"));
    const bytes = await readFile((await image.path())!);
    expect(bytes.readUInt32BE(16)).toBe(1_800);
    expect(bytes.readUInt32BE(20)).toBeGreaterThanOrEqual(2_800);
    expect(bytes.readUInt32BE(20)).toBeLessThanOrEqual(8_192);
    expect(bytes.byteLength).toBeGreaterThan(50_000);
    const printed = await page.evaluate(() => (window as Window & { receiptDrawnText: string[] }).receiptDrawnText.join(" "));
    expect(printed).not.toContain("salary");
    expect(printed).not.toContain("private follow-up");
    expect(printed.includes("Northstar")).toBe(includeQuestion);
    expect(printed.replace(/\s/g, "").includes(question.replace(/\s/g, ""))).toBe(includeQuestion);
    const previewInsight = await receipt.getByTestId("receipt-insight").innerText();
    expect(printed.replace(/\s/g, "")).toContain(previewInsight.replace(/\s/g, ""));
  }
  await page.screenshot({ path: testInfo.outputPath("receipt-private-preview.png") });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("hint_local_tarot_readings_v1") ?? "[]")[0]);
  expect(saved.shortAnswer).toBe(privateAnswer);
  expect(saved.chatMessages.some((message: { content: string }) => message.content === privateChat)).toBe(true);
});

for (const receiptCase of [
  ...VISUAL_CASES.map((visual) => ({ visual, language: "en" })),
  { visual: VISUAL_CASES[4], language: "zh" },
]) {
  test(`receipt exports complete ${receiptCase.visual.cardCount}-card ${receiptCase.language} text and readable artwork`, async ({ page }, testInfo) => {
    await seedReadingSession(page, receiptCase.visual);
    await page.goto("/app/tarot?hintPreview=embedded");
    await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
    const data = await page.evaluate((language) => {
      const key = "hint_local_tarot_readings_v1";
      const records = JSON.parse(localStorage.getItem(key) ?? "[]");
      const reading = records[0];
      const canonicalTitle = reading.spreadLabel;
      const canonicalPositions = reading.cards.map((card: { positionLabel: string }) => card.positionLabel);
      if (reading.cards.length >= 3) {
        reading.cards[2].cardId = "knight-pentacles";
        reading.cards[2].name = "Knight of Pentacles";
        reading.structuredReading.cards[2].card_name = "Knight of Pentacles";
      }
      if (language === "zh") {
        reading.spreadLabel = "關係裡的內在感受與未來方向";
        reading.question = "在這段關係裡，我應該如何清楚而溫柔地表達自己的需要，同時給彼此足夠的時間和空間？";
        reading.shortAnswer = "這次的牌面提醒你，先照顧自己的感受，再用清楚而溫柔的方式表達你的想法。不要急著做出決定，也不需要為了得到答案而忽略自己的界線。你可以從一次真誠的對話開始，說明你珍惜的事物，以及你希望一起面對的問題。讓實際行動慢慢建立信任，在感到不確定的時候，留一點時間觀察自己的心。每一步都可以小而踏實，不必一次解決所有事情。";
        reading.structuredReading.overall_summary = reading.shortAnswer;
        reading.cards.forEach((card: { positionLabel: string }, index: number) => {
          card.positionLabel = `第${index + 1}張牌的內在感受與提醒`;
          reading.structuredReading.cards[index].position = card.positionLabel;
        });
      }
      localStorage.setItem(key, JSON.stringify(records));
      // The app language remains English here; long historical Chinese content
      // must wrap unchanged, while noneditable spread/position UI uses canonical labels.
      return { id: reading.id, title: canonicalTitle, positions: canonicalPositions, archivedTitle: reading.spreadLabel, question: reading.question, insight: reading.shortAnswer, cards: reading.cards };
    }, receiptCase.language);
    await page.goto(`/app/tarot?reading=${data.id}&hintPreview=embedded`);
    await expect(page.getByText(data.insight, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Receive", exact: true }).tap();
    const receipt = page.getByRole("dialog", { name: "A letter to keep" });
    await expect(receipt.getByRole("button", { name: "Share receipt", exact: true })).toBeEnabled();
    await page.evaluate(() => {
      type Bounds = { left: number; right: number; top: number; bottom: number };
      const captured = { text: [] as Array<Bounds & { text: string }>, cards: [] as Bounds[] };
      Object.assign(window, { receiptLayoutCapture: captured });
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
        if (this.canvas.width === 1800) {
          const metrics = this.measureText(text);
          captured.text.push({ text, left: x - metrics.actualBoundingBoxLeft, right: x + metrics.actualBoundingBoxRight, top: y - metrics.actualBoundingBoxAscent, bottom: y + metrics.actualBoundingBoxDescent });
        }
        if (maxWidth === undefined) fillText.call(this, text, x, y);
        else fillText.call(this, text, x, y, maxWidth);
      };
      const drawImage = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (...args: Parameters<typeof drawImage>) {
        if (this.canvas.width === 1800 && args[0] instanceof HTMLImageElement) {
          const [, x, y, width, height] = args;
          const matrix = this.getTransform();
          const points = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]]
            .map(([px, py]) => new DOMPoint(px, py).matrixTransform(matrix));
          captured.cards.push({ left: Math.min(...points.map((p) => p.x)) / 2, right: Math.max(...points.map((p) => p.x)) / 2, top: Math.min(...points.map((p) => p.y)) / 2, bottom: Math.max(...points.map((p) => p.y)) / 2 });
        }
        drawImage.apply(this, args);
      };
    });
    await receipt.getByRole("checkbox").check();
    const pending = page.waitForEvent("download");
    await receipt.getByRole("button", { name: "Share receipt", exact: true }).tap();
    const download = await pending;
    await download.saveAs(testInfo.outputPath("receipt.png"));
    const bytes = await readFile((await download.path())!);
    const height = bytes.readUInt32BE(20) / 2;
    expect(bytes.readUInt32BE(16)).toBe(1800);
    expect(height).toBeGreaterThanOrEqual(1400);
    expect(height).toBeLessThanOrEqual(4096);
    expect(bytes.byteLength).toBeGreaterThan(50_000);
    const captured = await page.evaluate(() => (window as unknown as {
      receiptLayoutCapture: { text: Array<{ text: string; left: number; right: number; top: number; bottom: number }>; cards: Array<{ left: number; right: number; top: number; bottom: number }> };
    }).receiptLayoutCapture);
    const printed = captured.text.map((line) => line.text).join("").replace(/\s/g, "");
    for (const text of [data.title, data.question, data.insight, ...data.cards.map((card: { name: string }) => card.name), ...data.positions.map((position: string) => position.toUpperCase())]) {
      expect(printed).toContain(text.replace(/\s/g, ""));
    }
    if (receiptCase.language === "zh") expect(printed).not.toContain(data.archivedTitle);
    const saved = await page.evaluate(id => JSON.parse(localStorage.getItem("hint_local_tarot_readings_v1") ?? "[]").find((reading: { id: string }) => reading.id === id), data.id);
    expect(saved.spreadLabel).toBe(data.archivedTitle);
    expect(saved.shortAnswer).toBe(data.insight);
    expect(captured.cards).toHaveLength(receiptCase.visual.cardCount);
    expect(new Set(captured.cards.map((card) => Math.round(card.top))).size).toBe(Math.ceil(receiptCase.visual.cardCount / 3));
    for (const card of captured.cards) expect(card.right - card.left).toBeGreaterThanOrEqual(143);
    const rectangles = [...captured.cards, ...captured.text.filter((line) => line.text.trim())];
    for (const box of rectangles) {
      expect(box.left).toBeGreaterThanOrEqual(70);
      expect(box.right).toBeLessThanOrEqual(830);
      expect(box.top).toBeGreaterThanOrEqual(90);
      expect(box.bottom).toBeLessThanOrEqual(height - 80);
    }
    for (let i = 0; i < rectangles.length; i++) {
      for (let j = i + 1; j < rectangles.length; j++) {
        const a = rectangles[i]!, b = rectangles[j]!;
        expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
      }
    }
  });
}

for (const motionSetting of ["system", "hint"] as const) {
  test(`${motionSetting} reduced motion completes the automatic ritual promptly`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: motionSetting === "system" ? "reduce" : "no-preference" });
    await page.addInitScript((reduceMotion) => {
      localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion, soundAndHaptics: false }));
    }, motionSetting === "hint");
    await enterWash(page);
    const started = Date.now();
    await page.getByRole("button", { name: "Auto Wash" }).click();
    await expect(page.getByRole("heading", { name: "Pick Cards" })).toBeVisible({ timeout: 3_000 });
    expect(Date.now() - started).toBeLessThan(3_000);
    await expect(page.getByLabel("Rotating tarot deck wheel")).toHaveAttribute("data-deck-size", "78");
  });
}

test("Auto Wash avoids sustained animation stalls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-17-pro-max", "One primary-device frame pacing gate");
  await enterWash(page);
  await page.evaluate(() => {
    const state = window as Window & {
      __tarotFrameGaps?: number[];
      __stopTarotFrameSampling?: boolean;
    };
    state.__tarotFrameGaps = [];
    state.__stopTarotFrameSampling = false;
    let previous = performance.now();
    const sample = (now: number) => {
      state.__tarotFrameGaps?.push(now - previous);
      previous = now;
      if (!state.__stopTarotFrameSampling) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  await page.getByRole("button", { name: "Auto Wash" }).click();
  await expect(page.getByRole("heading", { name: "Pick Cards" })).toBeVisible();
  const frameMetrics = await page.evaluate(() => {
    const state = window as Window & {
      __tarotFrameGaps?: number[];
      __stopTarotFrameSampling?: boolean;
    };
    state.__stopTarotFrameSampling = true;
    const samples = [...(state.__tarotFrameGaps ?? [])].sort((a, b) => a - b);
    const p95 = samples[Math.floor(Math.max(0, samples.length - 1) * 0.95)] ?? Infinity;
    const sustainedStalls = samples.filter((gap) => gap >= 100).length;
    return { sampleCount: samples.length, p95, sustainedStalls };
  });

  await testInfo.attach("tarot-host-frames", {
    body: JSON.stringify({ browserOnly: true, physicalIphoneVerified: false, ...frameMetrics }, null, 2),
    contentType: "application/json",
  });
  expect(frameMetrics.sampleCount).toBeGreaterThan(60);
  expect(frameMetrics.p95).toBeLessThan(90);
  expect(frameMetrics.sustainedStalls).toBeLessThanOrEqual(2);
});

test("an offline follow-up is saved and restored with its local reply", async ({ page }) => {
  await seedReadingSession(page, VISUAL_CASES[1]);
  await page.unroute("**/api/tarot/chat");
  await page.route("**/api/tarot/chat", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/app/tarot?hintPreview=embedded");
  await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();

  const followUp = "What can I still do offline?";
  await page.getByPlaceholder("Ask what you want to understand next...").fill(followUp);
  await page.getByRole("button", { name: "Send follow-up" }).click();
  await expect(
    page.getByText(
      "The live reading line is quiet right now, so this reply used the local reading context.",
      { exact: true },
    ),
  ).toBeVisible();

  const savedMessages = await page.evaluate(() => {
    const readings = JSON.parse(
      localStorage.getItem("hint_local_tarot_readings_v1") ?? "[]",
    ) as Array<{ chatMessages?: Array<{ role: string; content: string }> }>;
    return readings[0]?.chatMessages ?? [];
  });
  expect(savedMessages).toHaveLength(2);
  expect(savedMessages[0]).toMatchObject({ role: "user", content: followUp });
  expect(savedMessages[1]?.role).toBe("assistant");
  expect(savedMessages[1]?.content).toBeTruthy();

  await page.reload();
  await expect(page.getByRole("main").getByText(followUp, { exact: true })).toBeVisible();
  await expect(
    page.getByText(savedMessages[1]!.content, { exact: true }),
  ).toBeVisible();
});

test("a stalled follow-up releases the composer and keeps one durable local reply", async ({ page }) => {
  await seedReadingSession(page, VISUAL_CASES[1]);
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  let cancelled = false;
  page.on("requestfailed", (request) => {
    if (request.url().endsWith("/api/tarot/chat")) cancelled = true;
  });
  await page.route("**/api/tarot/chat", async (route) => {
    await held;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "This reply arrived too late." }) }).catch(() => undefined);
  });
  try {
    await page.goto("/app/tarot?hintPreview=embedded");
    await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
    const composer = page.getByTestId("tarot-follow-up-composer");
    await composer.fill("What if the connection stalls?");
    await page.getByRole("button", { name: "Send follow-up" }).click();
    await expect(composer).toBeDisabled();
    await expect(page.getByText("The live reading line is quiet right now, so this reply used the local reading context.", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(composer).toBeEnabled();
    await expect.poll(() => cancelled).toBe(true);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("hint_local_tarot_readings_v1") ?? "[]")[0]);
    expect(saved.chatMessages).toHaveLength(2);
    expect(saved.chatMessages[0].content).toBe("What if the connection stalls?");
    expect(saved.chatMessages[1].content).toBeTruthy();
    release();
    await page.reload();
    await expect(page.getByText(saved.chatMessages[1].content, { exact: true })).toBeVisible();
    await expect(page.getByText("This reply arrived too late.", { exact: true })).toHaveCount(0);
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem("hint_local_tarot_readings_v1") ?? "[]")[0]);
    expect(restored.chatMessages).toEqual(saved.chatMessages);
    expect(restored.id).toBe(saved.id);
  } finally {
    release();
  }
});

test("leaving a pending follow-up cancels its request before History resumes", async ({ page }) => {
  await seedReadingSession(page, VISUAL_CASES[1]);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  let cancelled = false;
  page.on("requestfailed", (request) => {
    if (request.url().endsWith("/api/tarot/chat")) cancelled = true;
  });
  const holdReply = async (route: import("@playwright/test").Route) => {
    await held;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "Old departed reply." }) }).catch(() => undefined);
  };
  await page.route("**/api/tarot/chat", holdReply);
  try {
    await page.goto("/app/tarot?hintPreview=embedded");
    await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
    await page.getByPlaceholder("Ask what you want to understand next...").fill("Keep this question when I leave.");
    const request = page.waitForRequest("**/api/tarot/chat");
    await page.getByRole("button", { name: "Send follow-up" }).click();
    await request;
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("hint_local_tarot_readings_v1") ?? "[]")[0]);
    await page.getByRole("button", { name: "Return home" }).click();
    const leaveDialog = page.getByRole("dialog", { name: "Leave this space?" });
    await expect(leaveDialog).toBeVisible();
    expect(cancelled).toBe(false);
    await leaveDialog.getByRole("button", { name: "Leave and start fresh", exact: true }).click();
    await expect.poll(() => cancelled).toBe(true);
    release();
    await page.unroute("**/api/tarot/chat", holdReply);
    await page.goto(`/app/tarot?hintPreview=embedded&reading=${saved.id}&returnTo=detail`);
    await expect(page.getByText("Keep this question when I leave.", { exact: true })).toBeVisible();
    await page.getByPlaceholder("Ask what you want to understand next...").fill("Now I am back.");
    await page.getByRole("button", { name: "Send follow-up" }).click();
    await expect(page.getByText("Choose the smallest honest action, then leave enough space to notice what changes.", { exact: true })).toBeVisible();
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem("hint_local_tarot_readings_v1") ?? "[]")[0]);
    expect(restored.chatMessages).toHaveLength(3);
    expect(restored.chatMessages.map((message: { content: string }) => message.content)).not.toContain("Old departed reply.");
    expect(restored.roomDesign).toEqual(saved.roomDesign);
    expect(restored.cards).toEqual(saved.cards);
    expect(errors).toEqual([]);
  } finally {
    release();
  }
});

test("a late reading response cannot replace the settled local reading", async ({ page }) => {
  await seedReadingSession(page, VISUAL_CASES[1]);
  await page.unroute("**/api/tarot/structured-reading");
  await page.route("**/api/tarot/structured-reading", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 8_700));
    const request = route.request().postDataJSON() as {
      cards: Array<{ name: string; orientation: "upright" | "reversed"; position: string }>;
    };
    try {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          signal_type: "opening",
          overall_summary: LATE_READING_SUMMARY,
          cards: request.cards.map((card) => ({
            position: card.position,
            card_name: card.name,
            orientation: card.orientation,
            meaning: "A deliberately late interpretation.",
          })),
          final_action_advice: "This advice should not replace the local result.",
          follow_up_invitation: "This invitation should remain hidden.",
        }),
      });
    } catch {
      // The application intentionally aborts this request after eight seconds.
    }
  });

  await page.goto("/app/tarot?hintPreview=embedded");
  const retry = page.getByRole("button", { name: "Refresh the interpretation" });
  await expect(retry).toBeVisible({ timeout: 10_500 });
  await page.waitForTimeout(1_200);
  await expect(page.getByText(LATE_READING_SUMMARY, { exact: true })).toHaveCount(0);

  await page.unroute("**/api/tarot/structured-reading");
  await page.route("**/api/tarot/structured-reading", async (route) => {
    const request = route.request().postDataJSON() as {
      cards: Array<{ name: string; orientation: "upright" | "reversed"; position: string }>;
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        signal_type: "clear_signal",
        overall_summary: READING_SUMMARY,
        cards: request.cards.map((card) => ({
          position: card.position,
          card_name: card.name,
          orientation: card.orientation,
          meaning: `${card.name} gives this position a grounded, readable direction.`,
        })),
        final_action_advice: "Choose the smallest honest action and take it without rushing.",
        follow_up_invitation: "Ask about any card when you want the next layer.",
      }),
    });
  });
  await retry.click();
  await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
});

for (const initialStatus of ["pending", "local", "server-local"] as const) {
  test(`a ${initialStatus} interpretation survives refresh with an explicit retry`, async ({ page }) => {
    await seedReadingSession(page, VISUAL_CASES[1]);
    let requests = 0;
    let allowSuccess = false;
    let releaseRequest = () => {};
    const pendingRequest = new Promise<void>((resolve) => { releaseRequest = resolve; });
    await page.route("**/api/tarot/structured-reading", async (route) => {
      requests += 1;
      if (allowSuccess) return route.fallback();
      if (initialStatus === "local") {
        await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
      } else if (initialStatus === "server-local") {
        const request = route.request().postDataJSON();
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
          source: "local", signal_type: "opening", overall_summary: "The server supplied a complete local interpretation.",
          cards: request.cards.map((card: { position: string; name: string; orientation: string }) => ({
            position: card.position, card_name: card.name, orientation: card.orientation, meaning: "The original card at this position.",
          })),
          final_action_advice: "Pause and reflect.", follow_up_invitation: "What next?",
        }) });
      } else {
        await pendingRequest;
        await route.abort().catch(() => undefined);
      }
    });
    const savedReading = () => page.evaluate(() => {
      const readings = JSON.parse(localStorage.getItem("hint_local_tarot_readings_v1") ?? "[]");
      return readings[0] as { id: string; interpretationStatus: string; shortAnswer: string; cards: unknown[]; roomDesign: unknown };
    });

    try {
      await page.goto("/app/tarot?hintPreview=embedded");
      await expect.poll(async () => (await savedReading())?.interpretationStatus).toBe(initialStatus === "server-local" ? "local" : initialStatus);
      await expect.poll(() => requests).toBe(1);
      const before = await savedReading();
      await page.reload();
      releaseRequest();
      const retry = page.getByRole("button", { name: "Refresh the interpretation" });
      await expect(retry).toBeVisible();
      await expect(page.getByText(before.shortAnswer, { exact: true })).toBeVisible();
      expect(requests).toBe(1);
      const restored = await savedReading();
      expect(restored.id).toBe(before.id);
      expect(restored.cards).toEqual(before.cards);
      expect(restored.roomDesign).toEqual(before.roomDesign);

      allowSuccess = true;
      await retry.click();
      await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
      await expect.poll(async () => (await savedReading())?.interpretationStatus).toBe("ready");
      await page.reload();
      await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
      await expect(retry).toHaveCount(0);
      expect(requests).toBe(2);
    } finally {
      releaseRequest();
    }
  });
}

test("refresh restores the newest fallback session after durable storage fills", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === window.localStorage && key.startsWith("hint_active_tarot_reading_v2:") && sessionStorage.getItem("hint_e2e_active_quota") === "1") {
        throw new DOMException("Storage full", "QuotaExceededError");
      }
      original.call(this, key, value);
    };
  });
  await page.goto("/app/tarot?hintPreview=embedded");
  const question = page.getByPlaceholder("Type your question...");
  await question.fill("An older question");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem(`hint_active_tarot_reading_v2:${localStorage.getItem("hint_anon_id")}`) ?? "{}").question)).toBe("An older question");
  await page.evaluate(() => sessionStorage.setItem("hint_e2e_active_quota", "1"));
  await question.fill("My latest question must survive");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("button", { name: "Use this spread" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem(`hint_active_tarot_reading_v2:${localStorage.getItem("hint_anon_id")}`) ?? "{}").phase)).toBe("spreadRecommendation");
  await page.reload();
  await expect(page.getByRole("button", { name: "Use this spread" })).toBeVisible();
  await expect(page.getByText("My latest question must survive", { exact: true })).toBeVisible();
  await page.evaluate(() => sessionStorage.removeItem("hint_e2e_active_quota"));
  await page.reload();
  await expect(page.getByText("My latest question must survive", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem(`hint_active_tarot_reading_v2:${localStorage.getItem("hint_anon_id")}`) ?? "{}").question)).toBe("My latest question must survive");
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem(`hint_active_tarot_reading_v2:${localStorage.getItem("hint_anon_id")}`) ?? "null"))).toBeNull();
});

test("a failed save keeps the reading and chat until an explicit durable retry", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seedReadingSession(page, VISUAL_CASES[1]);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("hint_e2e_storage_failure")) sessionStorage.setItem("hint_e2e_storage_failure", "1");
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "hint_local_tarot_readings_v1" && sessionStorage.getItem("hint_e2e_storage_failure") === "1") {
        throw new DOMException("Storage is full", "QuotaExceededError");
      }
      original.call(this, key, value);
    };
  });
  await page.goto("/app/tarot?hintPreview=embedded");
  await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
  await expect(page.locator(".hint-launch-intro")).toHaveCount(0);
  const savedNotice = page.getByText("Saved in History. You can leave and come back later.", { exact: true });
  await expect(savedNotice).toHaveCount(0);
  await expect(page.getByRole("alert").filter({ hasText: "Changes aren't saved" })).toBeVisible();

  const followUp = "Keep this follow-up even when saving fails.";
  await page.getByPlaceholder("Ask what you want to understand next...").fill(followUp);
  await page.getByRole("button", { name: "Send follow-up" }).tap();
  await expect(page.getByText("Choose the smallest honest action, then leave enough space to notice what changes.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("hint_local_tarot_readings_v1"))).toBeNull();
  const previousUrl = page.url();
  await page.getByRole("button", { name: "Return home" }).tap();
  const leaveDialog = page.getByRole("dialog", { name: "Leave this space?", exact: true });
  await expect(leaveDialog).toContainText("Your unfinished Tarot reading will reset.");
  await expect(leaveDialog).toContainText("Saved readings, personal details and today’s cards are kept.");
  await leaveDialog.getByRole("button", { name: "Stay here", exact: true }).click();
  await expect(leaveDialog).not.toBeVisible();
  expect(page.url()).toBe(previousUrl);
  await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByText(followUp, { exact: true })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Changes aren't saved" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("hint_local_tarot_readings_v1"))).toBeNull();
  await expect(page.getByText("Saved to History", { exact: true })).toHaveCount(0);

  await page.evaluate(() => sessionStorage.setItem("hint_e2e_storage_failure", "0"));
  await page.getByRole("button", { name: "Try saving again" }).click();
  await expect(savedNotice).toBeVisible();
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem("hint_local_tarot_readings_v1") ?? "[]"));
  expect(records).toHaveLength(1);
  expect(records[0].structuredReading.overall_summary).toBe(READING_SUMMARY);
  expect(records[0].cards).toHaveLength(3);
  expect(records[0].chatMessages).toHaveLength(2);
  expect(records[0].roomDesign).toMatchObject({ backgroundId: "dawn", cardArtId: "hint-classic" });

  await page.goto(`/app/tarot?hintPreview=embedded&reading=${encodeURIComponent(records[0].id)}&returnTo=detail`);
  await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByText(followUp, { exact: true })).toBeVisible();
  await expect(page.locator('[data-room-background="dawn"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test("damaged saved interpretation and design recover without losing the selected cards", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seedReadingSession(page, VISUAL_CASES[1]);
  await page.goto("/app/tarot?hintPreview=embedded");
  await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
  const original = await page.evaluate(() => {
    const records = JSON.parse(localStorage.getItem("hint_local_tarot_readings_v1") ?? "[]");
    const reading = records[0];
    reading.structuredReading.cards[0].meaning = null;
    reading.roomDesign.cardBackId = { invalid: true };
    reading.roomDesign.backStyle = [];
    reading.roomDesign.cardArtId = null;
    localStorage.setItem("hint_local_tarot_readings_v1", JSON.stringify(records));
    return { id: reading.id, cards: reading.cards };
  });
  await page.goto(`/app/tarot?hintPreview=embedded&reading=${encodeURIComponent(original.id)}&returnTo=detail`);
  await expect(page.getByRole("button", { name: "Refresh the interpretation" })).toBeVisible();
  await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Preview / })).toHaveCount(3);
  await expect(page.locator('[data-room-background="dawn"]')).toBeVisible();
  const recovered = await page.evaluate(() => JSON.parse(localStorage.getItem("hint_local_tarot_readings_v1") ?? "[]")[0]);
  expect(recovered.id).toBe(original.id);
  expect(recovered.cards).toEqual(original.cards);
  expect(recovered.interpretationStatus).toBe("local");
  expect(recovered.roomDesign).toMatchObject({ backgroundId: "dawn", cardArtId: "hint-classic", backStyle: "rose" });
  expect(typeof recovered.roomDesign.cardBackId).toBe("string");
  await page.getByRole("button", { name: "Refresh the interpretation" }).click();
  await expect(page.getByRole("button", { name: "Refresh the interpretation" })).toHaveCount(0);
  await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("the reading composer remains visible above a keyboard-sized viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-se", "Short-screen keyboard regression");
  await seedReadingSession(page, VISUAL_CASES[1]);
  await page.goto("/app/tarot?hintPreview=embedded");
  await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 430 });
  const composer = page.getByPlaceholder("Ask what you want to understand next...");
  await expect(composer).toBeVisible();
  const box = await composer.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(430);
});

test("five consecutive rituals do not degrade", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-17-pro-max", "One primary-device soak run");
  test.setTimeout(140_000);
  await page.unroute("**/api/tarot/spread-recommendation");
  await page.route("**/api/tarot/spread-recommendation", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        spreadType: "single",
        reason: "One focused card keeps this repeated ritual concise.",
        focusLabel: "Clear signal",
        confidence: "high",
        source: "api",
      }),
    }),
  );
  const durations: number[] = [];

  for (let index = 0; index < 5; index += 1) {
    if (index > 0) {
      await page.evaluate(() => {
        localStorage.removeItem("hint_active_tarot_reading_v1");
      localStorage.removeItem(`hint_active_tarot_reading_v2:${localStorage.getItem("hint_anon_id")}`);
      sessionStorage.removeItem(`hint_active_tarot_reading_v2:${localStorage.getItem("hint_anon_id")}`);
        sessionStorage.removeItem("hint_active_tarot_reading_v1");
        sessionStorage.removeItem(`hint_active_tarot_reading_v2:${localStorage.getItem("hint_anon_id")}`);
      });
    }
    const startedAt = Date.now();
    await enterWash(page);
    await page.getByRole("button", { name: "Auto Wash" }).click();
    await expect(page.getByRole("heading", { name: "Pick Cards" })).toBeVisible();
    await chooseArcCard(page);
    await expect(page.getByText("One card - 1 of 1 chosen", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Reveal Reading/i }).click();
    await expect(page.getByText("The cards are open.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Read my Hint" }).click();
    await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
    durations.push(Date.now() - startedAt);
  }

  await testInfo.attach("tarot-five-rituals", {
    body: JSON.stringify({ browserOnly: true, physicalIphoneVerified: false, durationsMs: durations }, null, 2),
    contentType: "application/json",
  });
  expect(durations).toHaveLength(5);
  expect(Math.max(...durations)).toBeLessThan(20_000);
  expect(durations[4]!).toBeLessThanOrEqual(durations[0]! * 1.5 + 2_000);
  const readingCount = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("hint_local_tarot_readings_v1") ?? "[]").length,
  );
  expect(readingCount).toBeGreaterThanOrEqual(5);
});

for (const visualCase of VISUAL_CASES.slice(0, 3)) {
  test(`pick arc stays ordered on ${visualCase.backgroundId}`, async ({ page }) => {
    await seedPickSession(page, visualCase);
    await page.goto("/app/tarot?hintPreview=embedded");
    await expect(page.getByRole("heading", { name: "Pick Cards" })).toBeVisible();
    const wheel = page.getByLabel("Rotating tarot deck wheel");
    await expect(wheel).toHaveAttribute("data-deck-size", "78");
    const card19 = page.getByRole("button", { name: "Lift card 19" });
    const card20 = page.getByRole("button", { name: "Lift card 20" });
    const layers = await Promise.all([
      card19.evaluate((element) => Number(getComputedStyle(element).zIndex)),
      card20.evaluate((element) => Number(getComputedStyle(element).zIndex)),
    ]);
    expect(layers[0]).toBeGreaterThan(layers[1]);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByTestId("tarot-phone-frame")).toHaveScreenshot(
      `pick-${visualCase.backgroundId}.png`,
      { animations: "disabled", maxDiffPixelRatio: 0.015 },
    );
  });
}

for (const spreadCase of ALL_SPREAD_LAYOUT_CASES) {
  test(`spread ${spreadCase.spreadId} remains contained`, async ({ page }) => {
    await seedReadingSession(page, spreadCase);
    await page.goto("/app/tarot?hintPreview=embedded");
    await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
    await expect(
      page.locator(`[data-room-background="${spreadCase.backgroundId}"]`),
    ).toBeVisible();

    await expect(page.getByLabel("Cards drawn")).toHaveCount(0);
    const answerCards = page.getByRole("button", { name: /^Preview / });
    await expect(answerCards).toHaveCount(spreadCase.cardCount);

    const horizontalCardBounds = await answerCards.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      }),
    );
    const frameRect = await page.getByTestId("tarot-phone-frame").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    });
    for (const cardBounds of horizontalCardBounds) {
      expect(cardBounds.left).toBeGreaterThanOrEqual(frameRect.left - 1);
      expect(cardBounds.right).toBeLessThanOrEqual(frameRect.right + 1);
    }

    const frameBounds = await page.getByTestId("tarot-phone-frame").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(frameBounds.scrollWidth).toBeLessThanOrEqual(frameBounds.clientWidth + 1);
    expect(frameBounds.scrollHeight).toBeLessThanOrEqual(frameBounds.clientHeight + 1);
  });
}

for (const visualCase of VISUAL_CASES) {
  test(`reading layout ${visualCase.cardCount} cards on ${visualCase.backgroundId}`, async ({ page }) => {
    await seedReadingSession(page, visualCase);
    await page.goto("/app/tarot?hintPreview=embedded");
    await expect(page.getByText(READING_SUMMARY, { exact: true })).toBeVisible();
    const dismissCardTip = page.getByRole("button", { name: "Dismiss card tip" });
    await expect(dismissCardTip).toBeVisible();
    await dismissCardTip.click();
    await page.evaluate(() => document.fonts.ready);

    const frame = page.getByTestId("tarot-phone-frame");
    const bounds = await frame.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1);
    expect(bounds.scrollHeight).toBeLessThanOrEqual(bounds.clientHeight + 1);
    await expect(frame).toHaveScreenshot(
      `reading-${visualCase.cardCount}-${visualCase.backgroundId}.png`,
      { animations: "disabled", maxDiffPixelRatio: 0.015 },
    );
  });
}

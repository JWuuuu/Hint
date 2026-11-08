import { expect, type Page } from "./fixtures";

const STAGES = ["Cutting the deck.", "Shuffling the deck.", "The deck is ready.", "Pick Cards"];
const HEADINGS = "h1, h2, h3, [role='heading']";

/**
 * Record each ritual heading as it appears. The intermediate stages can be on
 * screen for less than an assertion's polling interval, so checking them one
 * by one with toBeVisible races the ritual instead of testing it.
 * Call before the action that starts the ritual.
 */
export async function watchRitualStages(page: Page) {
  await page.evaluate(({ stages, selector }) => {
    const host = window as unknown as { __ritualStages?: string[]; __ritualObserver?: MutationObserver };
    host.__ritualObserver?.disconnect();
    const seen: string[] = [];
    host.__ritualStages = seen;
    const headingOf = (node: Node | null) => (node instanceof Element ? node : node?.parentElement ?? null)?.closest(selector) ?? null;
    const record = (heading: Element | null) => {
      const text = heading?.textContent?.trim() ?? "";
      // Only newly shown stages count, so an exiting heading never re-enters the order.
      if (stages.includes(text) && seen.at(-1) !== text) seen.push(text);
    };
    host.__ritualObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            if (node.matches(selector)) record(node);
            node.querySelectorAll(selector).forEach(record);
          } else record(headingOf(node));
        }
        if (mutation.type === "characterData") record(headingOf(mutation.target));
      }
    });
    host.__ritualObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  }, { stages: STAGES, selector: HEADINGS });
}

/** The ritual passed through every stage exactly once, in order, and settled on Pick Cards. */
export async function expectRitualStagesInOrder(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ritualStages?: string[] }).__ritualStages ?? []),
    { timeout: 20_000, message: "Ritual stages in the order they appeared" }).toEqual(STAGES);
  await expect(page.getByRole("heading", { name: "Pick Cards", exact: true })).toBeVisible();
}

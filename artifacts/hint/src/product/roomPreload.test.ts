import { expect, it, vi } from "vitest";
vi.mock("../modules/tarot", () => ({ TarotRoom: () => null }));
vi.mock("../modules/features/AstrologyView", () => ({ AstrologyView: () => null }));
import { getPreloadedAstrologyRoom, getPreloadedTarotRoom, loadAstrologyRoom, loadTarotRoom } from "./roomPreload";
it("shares the resolved component with navigation so a warm entry does not suspend again", async () => {
  expect(getPreloadedTarotRoom()).toBeUndefined();
  const pending = loadTarotRoom();
  expect(loadTarotRoom()).toBe(pending);
  const ready = await pending;
  expect(getPreloadedTarotRoom()).toBe(ready);
  expect(ready.TarotRoom).toBeTypeOf("function");
});
it("keeps the two room modules separate and exposes astrology only after it resolves", async () => {
  expect(getPreloadedAstrologyRoom()).toBeUndefined();
  const ready = await loadAstrologyRoom();
  expect(getPreloadedAstrologyRoom()).toBe(ready);
  expect(getPreloadedAstrologyRoom()).not.toBe(getPreloadedTarotRoom());
});

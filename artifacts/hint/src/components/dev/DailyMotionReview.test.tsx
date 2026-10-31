// @vitest-environment jsdom
import { useEffect, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DailyMotionReviewStage } from "./DailyMotionReview";
import { HintGuideSlot } from "../mascot/HintGuide";
import { useDailyDelivery } from "../mascot/useDailyDelivery";

const scene = vi.hoisted(() => ({ create: vi.fn(), players: [] as Array<{ finish: () => void; destroy: ReturnType<typeof vi.fn> }> }));
vi.mock("../../lib/i18n", () => ({ LanguageProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("../../lib/motionPolicy", () => ({ MotionPolicyProvider: ({ children }: { children: ReactNode }) => children,
  useMotionPolicy: () => ({ reduced: false, pageVisible: true }) }));
vi.mock("../../modules/home/data/dailyReport", () => ({ getDailyReport: () => ({ date: "today", card: { cardId: "moon", cardName: "Moon" } }) }));
vi.mock("./DevicePreview", () => ({ DevicePreview: () => null, shouldShowDevicePreview: () => false }));
vi.mock("../../../mascot-library/versions/v3.2/src/index", () => ({ createHintScenePlayer: scene.create }));
vi.mock("../../../mascot-library/versions/v3.2/preview/hint-assets.js", () => ({ assets: { images: {} } }));
vi.mock("../../modules/home/components/HomeDashboard", () => ({
  ReferenceDailyRevealOverlay: function Overlay({ open, fresh, onCardRevealed, onClose, reviewControls }: {
    open: boolean; fresh: boolean; onCardRevealed: () => void; onClose: () => void; reviewControls: ReactNode;
  }) {
    const delivery = useDailyDelivery({ open, fresh, preparing: false, identity: "today:moon", cardBack: "/back.png" });
    useEffect(() => { if (open && fresh && !delivery.active) onCardRevealed(); }, [open, fresh, delivery.active]);
    if (!open) return null;
    return <section aria-label="Daily card"><div ref={delivery.target} />
      <HintGuideSlot priority={210} context={{ room: "home", phase: "waiting", hasMessages: false, keyboardOpen: false, typing: false, audioPlaying: false }} delivery={delivery.slot} />
      <output>{delivery.active ? "Delivering letter" : "Card ready"}</output>
      <button onClick={onClose}>Close card</button>{reviewControls}</section>;
  },
}));

beforeEach(() => {
  scene.players = [];scene.create.mockReset();
  vi.stubEnv("DEV", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 375, bottom: 667, width: 375, height: 667, toJSON() {} });
  scene.create.mockImplementation(async (_canvas, options) => {
    // Match the director's receipt contract: the same key never reopens a done
    // delivery. An explicit replay must create a fresh scene or use a new key.
    let delivery: { key: string; done: boolean } | null = null;
    const draw = () => options.onFrame({ actor: { x: 0, y: 0, width: 1, height: 1 },
      state: { context: { room: "home", phase: "waiting" }, clock: 1, placement: "avatar" },
      shadow: { x: 0, y: 0, width: 1, opacity: 1 }, letter: "delivered",
      delivery: delivery && { key: delivery.key, phase: delivery.done ? "ready" : "offering", time: delivery.done ? 6.2 : 1, handoff: delivery.done ? 1 : 0 } });
    const player = { setContext: vi.fn(), setAnchor: vi.fn(), setMotionPolicy: vi.fn(), setSpeed: vi.fn(), pause: vi.fn(), resume: vi.fn(),
      destroy: vi.fn(), finish() { if (delivery) delivery.done = true;draw(); },
      setDelivery(value: { key: string; done: boolean } | null) {
        if (!value) delivery = null;
        else if (delivery?.key !== value.key) delivery = { key: value.key, done: value.done };
        else if (value.done) delivery.done = true;
        draw();
      },
    };
    scene.players.push(player);return player;
  });
});
afterEach(() => { cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs(); });

it("replays a completed receipt as a new scene without immediately incrementing completion", async () => {
  const onHold = vi.fn();
  const view = render(<DailyMotionReviewStage speed=".5" hold="" onSpeed={vi.fn()} onHold={onHold} />);
  await waitFor(() => expect(scene.create).toHaveBeenCalledTimes(1));
  fireEvent.click(view.getByRole("button", { name: "Play delivery" }));
  await waitFor(() => expect(view.getByText("Delivering letter")).toBeTruthy());
  await act(async () => scene.players[0].finish());
  expect(view.getByText("Completed reveals: 1")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Replay" }));
  await waitFor(() => expect(scene.create).toHaveBeenCalledTimes(2));
  expect(scene.players[0].destroy).toHaveBeenCalledTimes(1);
  expect(view.getByText("Delivering letter")).toBeTruthy();
  expect(view.getByText("Completed reveals: 1")).toBeTruthy();
  expect((view.getByLabelText("Playback speed") as HTMLSelectElement).value).toBe(".5");
  expect(onHold).toHaveBeenCalledWith("");
  await act(async () => scene.players[1].finish());
  expect(view.getByText("Completed reveals: 2")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Close card" }));
  await act(async () => {});
  fireEvent.click(view.getByRole("button", { name: "Reopen card" }));
  await act(async () => {});
  expect(view.getByText("Card ready")).toBeTruthy();
  expect(view.getByText("Completed reveals: 2")).toBeTruthy();
  expect(scene.create).toHaveBeenCalledTimes(2);
});

/** @vitest-environment jsdom */

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MotionPolicyProvider } from "../../../lib/motionPolicy";
import { LanguageProvider } from "../../../lib/i18n";
import { HINT_PREFERENCES_STORAGE_KEY } from "../../../lib/preferences";
import * as speech from "../../../lib/speechRecognition";
import type { SpreadChoice } from "../../hold/useHoldFlow";
import {
  getLocalTarotReading,
  saveLocalTarotReading,
  type LocalTarotRoomDesign,
} from "../../readings/localTarotReadings";
import { createHiddenDeck } from "../logic/createHiddenDeck";
import { clearActiveTarotSession, saveActiveTarotSession } from "../logic/activeTarotSession";
import { getAnonId } from "../../../lib/identity";
import { buildTarotReceiptModel } from "../logic/shareReceipt";
import * as receiptSharing from "../logic/shareReceipt";
import { TarotHintReadingChat } from "./TarotHintReadingChat";
import { TarotRoomFlow } from "./TarotRoomFlow";

const nativeLifecycle = vi.hoisted(() => ({
  listeners: new Set<(active: boolean) => void>(),
  listener: null as ((isActive: boolean) => void) | null,
  remove: vi.fn(async () => undefined),
}));

vi.mock("../../../lib/mobile/appLifecycle", () => ({
  addNativeAppStateListener: vi.fn(
    async (listener: (isActive: boolean) => void) => {
      nativeLifecycle.listeners.add(listener);
      nativeLifecycle.listener = active => nativeLifecycle.listeners.forEach(callback => callback(active));
      return async () => { nativeLifecycle.listeners.delete(listener); await nativeLifecycle.remove(); };
    },
  ),
}));

const ORIGINAL_SKY_BACK =
  "01_Final_Eight_Set/02_Moon_Tide_Lavender_Gold.png" as const;

const SINGLE_SPREAD: SpreadChoice = {
  id: "single",
  label: "One card",
  description: "One clear signal.",
  positions: "Signal",
  cardCount: 1,
  bestFor: "A focused question",
  positionLabels: ["Signal"],
  layout: [{ n: 1, x: 50, y: 50 }],
};

const ROOM_DESIGN: LocalTarotRoomDesign = {
  backgroundId: "sea",
  cardArtId: "hint-classic",
  cardBackId: ORIGINAL_SKY_BACK,
  backStyle: "rose",
};

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider><MotionPolicyProvider>{children}</MotionPolicyProvider></LanguageProvider>
    </QueryClientProvider>,
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function interruptTarotStorage() {
  const state = { failing: true };
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (state.failing && key === "hint_local_tarot_readings_v1") {
      throw new DOMException("Storage full", "QuotaExceededError");
    }
    original.call(this, key, value);
  });
  return state;
}

beforeEach(() => {
  vi.spyOn(receiptSharing, "createTarotReceiptBlob").mockResolvedValue(new Blob(["fixture receipt"], { type: "image/png" }));
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:receipt-fixture") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  nativeLifecycle.listener = null;
  nativeLifecycle.listeners.clear();
  nativeLifecycle.remove.mockClear();
  localStorage.clear();
  sessionStorage.clear();
  // A test reset keeps this module instance's fictional identity; deleting the
  // owner underneath a mounted identity is now correctly treated as a switch.
  localStorage.setItem("hint_anon_id", getAnonId());
  clearActiveTarotSession();
  window.history.replaceState({}, "", "/app/tarot?hintPreview=embedded");
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  localStorage.setItem(
    HINT_PREFERENCES_STORAGE_KEY,
    JSON.stringify({ reduceMotion: true, soundAndHaptics: false }),
  );
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Tarot Room components", () => {
  it("does not mistake next for an ex-partner when recommending an offline spread", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "Offline test" }, 503)));
    renderWithProviders(<TarotRoomFlow />);
    fireEvent.change(screen.getByPlaceholderText("Type your question..."), { target: { value: "What is my next chapter asking of me?" } });
    expect(screen.getByRole("heading", { name: "What do you need help seeing clearly?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Next$/ }));
    await screen.findByRole("heading", { name: /^Three cards$/ });
  });
  it.each(["receipt", "card"] as const)("the %s modal keeps keyboard focus inside, closes on Escape and restores its opener", async (kind) => {
    const user = userEvent.setup();
    const card = createHiddenDeck()[0]!;
    const { reading: saved } = saveLocalTarotReading({
      spreadType: "single", spreadLabel: "One card", roomDesign: ROOM_DESIGN,
      question: "A private question", shortAnswer: "An archived answer.",
      questionMeaning: "Take one step.", cardMeanings: ["Signal: Your card."],
      cards: [{ ...card, positionLabel: "Signal", keywords: ["clarity"] }],
    });
    renderWithProviders(<TarotHintReadingChat selectedCards={[card]} spread={SINGLE_SPREAD} question={saved.question} archivedReading={saved} archiveOnOpen={false} />);
    const opener = screen.getByRole("button", { name: kind === "receipt" ? "Receive" : /^Preview Signal,/ });
    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: kind === "receipt" ? "A letter to keep" : card.name });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    // Keyboard navigation must not reach the hidden follow-up form or history actions.
    for (let step = 0; step < 8; step++) { await user.tab(); expect(dialog.contains(document.activeElement)).toBe(true); }
    for (let step = 0; step < 8; step++) { await user.tab({ shift: true }); expect(dialog.contains(document.activeElement)).toBe(true); }
    expect(screen.queryByRole("button", { name: "Return home" })).toBeNull();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
    expect(screen.getByRole("button", { name: "Return home" })).toBeTruthy();
  });

  it("keeps an archived interpretation and original position labels when the app language changes", async () => {
    const user = userEvent.setup();
    const card = createHiddenDeck()[0]!;
    const structuredReading = {
      signal_type: "opening" as const,
      overall_summary: "This is the complete answer saved in the original language.",
      cards: [{ card_name: card.name, orientation: card.orientation, position: "Original position", meaning: "This is the original complete card explanation." }],
      final_action_advice: "Keep the original advice.",
      follow_up_invitation: "Explore the original interpretation.",
    };
    const { reading: saved } = saveLocalTarotReading({
      spreadType: "single", spreadLabel: "Original spread", roomDesign: ROOM_DESIGN,
      structuredReading, shortAnswer: structuredReading.overall_summary,
      questionMeaning: structuredReading.final_action_advice,
      cardMeanings: [`Original position: ${structuredReading.cards[0]!.meaning}`],
      cards: [{ cardId: card.cardId, visualId: card.visualId, name: card.name, orientation: card.orientation, positionLabel: "Original position", keywords: ["clarity"] }],
      interpretationStatus: "ready",
    });
    localStorage.setItem("hint-language", "zh");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ source: "api", message: "A reply about the original card." }));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<TarotHintReadingChat selectedCards={[card]} spread={SINGLE_SPREAD} archivedReading={saved} archiveOnOpen={false} />);
    expect(screen.getByText(structuredReading.overall_summary)).toBeTruthy();
    expect(screen.getByText(structuredReading.cards[0]!.meaning)).toBeTruthy();
    expect(screen.getByText("Original spread")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.type(screen.getByPlaceholderText("继续问你想理解的部分……"), "What next?");
    fireEvent.keyDown(screen.getByPlaceholderText("继续问你想理解的部分……"), { key: "Enter", code: "Enter" });
    expect(await screen.findByText("A reply about the original card.")).toBeTruthy();
    const request = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(request.cards[0].position).toBe("Original position");
    const restored = getLocalTarotReading(saved.id, saved.anonId)!;
    expect(restored.structuredReading).toEqual(structuredReading);
    expect(restored.cards).toEqual(saved.cards);
    expect(restored.spreadLabel).toBe("Original spread");
  });

  it.each(["close", "unmount"] as const)("cancels pending receipt preparation on %s and resets privacy on reopening", async (departure) => {
    const user = userEvent.setup();
    const card = createHiddenDeck()[0]!;
    const { reading: saved } = saveLocalTarotReading({
      spreadType: "single", spreadLabel: "One card", roomDesign: ROOM_DESIGN,
      question: "My private question?", shortAnswer: "The original private answer.",
      questionMeaning: "Take one step.", cardMeanings: ["Signal: Your card."],
      cards: [{ ...card, positionLabel: "Signal", keywords: ["clarity"] }],
    });
    let finish!: (blob: Blob) => void;
    const preparing = new Promise<Blob>((resolve) => { finish = resolve; });
    const create = vi.spyOn(receiptSharing, "createTarotReceiptBlob").mockReturnValueOnce(preparing);
    const share = vi.spyOn(receiptSharing, "shareTarotReceipt").mockResolvedValue("saved");
    const view = renderWithProviders(<TarotHintReadingChat selectedCards={[card]} spread={SINGLE_SPREAD} question={saved.question} archivedReading={saved} archiveOnOpen={false} />);
    await user.click(screen.getByRole("button", { name: "Receive" }));
    const dialog = within(screen.getByRole("dialog", { name: "A letter to keep" }));
    const action = dialog.getByRole("button", { name: "Share receipt" });
    fireEvent.click(action);
    fireEvent.click(action);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0]![0].question).toBeUndefined();
    expect((action as HTMLButtonElement).disabled).toBe(true);
    const signal = create.mock.calls[0]![1]!.signal!;
    if (departure === "unmount") view.unmount();
    else {
      await user.click(dialog.getByRole("button", { name: "Back to reading" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    }
    expect(signal.aborted).toBe(true);
    await act(async () => finish(new Blob(["receipt"], { type: "image/png" })));
    expect(share).not.toHaveBeenCalled();

    if (departure === "close") {
      create.mockResolvedValueOnce(new Blob(["new receipt"], { type: "image/png" }));
      await user.click(screen.getByRole("button", { name: "Receive" }));
      const reopened = within(screen.getByRole("dialog", { name: "A letter to keep" }));
      expect((reopened.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
      await waitFor(() => expect((reopened.getByRole("button", { name: "Share receipt" }) as HTMLButtonElement).disabled).toBe(false));
      await user.click(reopened.getByRole("button", { name: "Share receipt" }));
      await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
      expect(create.mock.calls[1]![0].question).toBeUndefined();
      expect(create.mock.calls[1]![0].insight).not.toBe(saved.shortAnswer);
    }
  });

  it("keeps server-local HTTP success retryable after restoration without replacing cards or chat", async () => {
    const user = userEvent.setup();
    const card = createHiddenDeck()[0]!;
    const local = {
      source: "local", signal_type: "opening", overall_summary: "A complete server-local answer.",
      cards: [{ card_name: card.name, orientation: card.orientation, position: "The Message", meaning: "The card at this position." }],
      final_action_advice: "Pause and reflect.", follow_up_invitation: "What next?",
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(local));
    vi.stubGlobal("fetch", fetchMock);
    const onArchived = vi.fn();
    const view = renderWithProviders(<TarotHintReadingChat selectedCards={[card]} spread={SINGLE_SPREAD} roomDesign={ROOM_DESIGN} onArchived={onArchived} />);
    expect(await screen.findByText(local.overall_summary)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh the interpretation" })).toBeTruthy();
    await waitFor(() => expect(onArchived.mock.lastCall?.[0].interpretationStatus).toBe("local"));
    const first = onArchived.mock.lastCall![0];
    const { reading: saved } = saveLocalTarotReading({ ...first, chatMessages: [{ id: "keep", role: "assistant", content: "The conversation stays available." }] });
    view.unmount();
    renderWithProviders(<TarotHintReadingChat selectedCards={[card]} spread={SINGLE_SPREAD} roomDesign={ROOM_DESIGN} archivedReading={saved} archiveOnOpen={false} />);
    expect(screen.getByText(local.overall_summary)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledOnce();
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...local, source: "api", overall_summary: "The complete provider answer." }));
    await user.click(screen.getByRole("button", { name: "Refresh the interpretation" }));
    expect(await screen.findByText("The complete provider answer.")).toBeTruthy();
    await waitFor(() => expect(getLocalTarotReading(saved.id, saved.anonId)?.interpretationStatus).toBe("ready"));
    const final = getLocalTarotReading(saved.id, saved.anonId)!;
    expect(final.cards).toEqual(saved.cards);
    expect(final.roomDesign).toEqual(saved.roomDesign);
    expect(final.chatMessages).toEqual(saved.chatMessages);
    expect(screen.queryByRole("button", { name: "Refresh the interpretation" })).toBeNull();
  });

  it.each(["name", "orientation", "position"])("rejects an interpretation attached to a different %s", async (field) => {
    const card = createHiddenDeck()[0]!;
    const meaning = { card_name: card.name, orientation: card.orientation, position: "The Message", meaning: "Wrong-card interpretation." };
    if (field === "name") meaning.card_name = "A different card";
    if (field === "orientation") meaning.orientation = card.orientation === "upright" ? "reversed" : "upright";
    if (field === "position") meaning.position = "A different position";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      source: "api", signal_type: "opening", overall_summary: "Do not display this mismatched reading.",
      cards: [meaning], final_action_advice: "Pause.", follow_up_invitation: "What next?",
    })));
    renderWithProviders(<TarotHintReadingChat selectedCards={[card]} spread={SINGLE_SPREAD} roomDesign={ROOM_DESIGN} />);
    expect(await screen.findByRole("button", { name: "Refresh the interpretation" })).toBeTruthy();
    expect(screen.queryByText("Do not display this mismatched reading.")).toBeNull();
  });

  it("sends a bounded follow-up context without truncating durable conversation history", async () => {
    const user = userEvent.setup();
    const card = createHiddenDeck()[0]!;
    const messages = Array.from({ length: 52 }, (_, index) => ({
      id: `message-${index}`, role: index % 2 ? "assistant" as const : "user" as const, content: `Previous message ${index}.`,
    }));
    const { reading: saved } = saveLocalTarotReading({
      spreadType: "single", spreadLabel: "One card", roomDesign: ROOM_DESIGN,
      shortAnswer: "Your original answer.", questionMeaning: "Take one step.",
      cardMeanings: ["Signal: Your card."], chatMessages: messages,
      cards: [{ ...card, positionLabel: "Signal", keywords: ["clarity"] }],
    });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "A complete new reply.", source: "api" }));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<TarotHintReadingChat selectedCards={[card]} spread={SINGLE_SPREAD} archivedReading={saved} archiveOnOpen={false} />);
    await user.type(screen.getByPlaceholderText("Ask what you want to understand next..."), "What next?");
    await user.click(screen.getByRole("button", { name: "Send follow-up" }));
    expect(await screen.findByText("A complete new reply.")).toBeTruthy();
    const request = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(request.messages).toEqual(messages.slice(-12).map(({ role, content }) => ({ role, content })));
    expect(getLocalTarotReading(saved.id, saved.anonId)?.chatMessages).toHaveLength(54);
    expect(getLocalTarotReading(saved.id, saved.anonId)?.chatMessages.slice(0, 52)).toEqual(messages);
  });

  it("generates detail only on request and restores it without replacing the answer, room or chat", async () => {
    const user = userEvent.setup();
    const selectedCard = createHiddenDeck()[0]!;
    const { reading: saved } = saveLocalTarotReading({
      spreadType: "single", spreadLabel: "One card", roomDesign: ROOM_DESIGN,
      shortAnswer: "Your original answer.", questionMeaning: "Take one step.",
      cardMeanings: ["Signal: Your card."],
      chatMessages: [{ id: "private", role: "user", content: "An existing private follow-up" }],
      cards: [{ cardId: selectedCard.cardId, visualId: selectedCard.visualId, name: selectedCard.name, orientation: selectedCard.orientation, positionLabel: "Signal", keywords: ["clarity"] }],
    });
    const detail = {
      signal_type: "opening", overall_summary: "A deeper explanation of your original answer.",
      cards: [{ card_name: selectedCard.name, orientation: selectedCard.orientation, position: "Signal", meaning: "How this card connects to your question in more detail." }],
      final_action_advice: "Try one reversible experiment and notice what happens.", follow_up_invitation: "What feels unclear?",
    };
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ ...detail, source: "api" }));
    vi.stubGlobal("fetch", fetch);
    const mounted = renderWithProviders(<TarotHintReadingChat selectedCards={[selectedCard]} spread={SINGLE_SPREAD} archivedReading={saved} archiveOnOpen={false} />);
    expect(fetch).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Explore deeper · Free demo" }));
    expect(await screen.findByText(detail.overall_summary)).toBeTruthy();
    const restored = getLocalTarotReading(saved.id, saved.anonId)!;
    expect(restored.detailedReading).toEqual(detail);
    expect(restored.shortAnswer).toBe(saved.shortAnswer);
    expect(restored.cards).toEqual(saved.cards);
    expect(restored.roomDesign).toEqual(saved.roomDesign);
    expect(restored.chatMessages).toEqual(saved.chatMessages);
    mounted.unmount();
    renderWithProviders(<TarotHintReadingChat selectedCards={[selectedCard]} spread={SINGLE_SPREAD} archivedReading={restored} archiveOnOpen={false} />);
    await user.click(screen.getByRole("button", { name: "Read your deeper interpretation" }));
    expect(screen.getByText(detail.overall_summary)).toBeTruthy();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("prints and exports the same private-by-default insight without changing the saved answer", async () => {
    const user = userEvent.setup();
    const card = createHiddenDeck()[0]!;
    const question = "Should I accept the confidential Northstar offer?";
    const answer = `For "${question}", weigh the details before deciding.`;
    const { reading: saved } = saveLocalTarotReading({
      spreadType: "single", spreadLabel: "One card", roomDesign: ROOM_DESIGN, question,
      shortAnswer: answer, questionMeaning: "Take one step.",
      cardMeanings: ["Signal: Your card."], chatMessages: [{ id: "secret", role: "user", content: "A private follow-up about the salary." }],
      cards: [{ ...card, positionLabel: "Signal", keywords: ["clarity"] }],
    });
    vi.stubGlobal("fetch", vi.fn());
    renderWithProviders(<TarotHintReadingChat selectedCards={[card]} spread={SINGLE_SPREAD} archivedReading={saved} archiveOnOpen={false} question={question} />);
    await user.click(screen.getByRole("button", { name: "Receive" }));
    const receipt = within(screen.getByRole("dialog", { name: "A letter to keep" }));
    const insight = receipt.getByTestId("receipt-insight");
    expect(insight.textContent).toBe(buildTarotReceiptModel(saved, false, "https://hint.example/download").insight);
    expect(receipt.queryByText(/Northstar/)).toBeNull();
    expect(receipt.queryByText(/salary/)).toBeNull();
    await user.click(receipt.getByRole("checkbox"));
    expect(receipt.getByTestId("receipt-insight").textContent).toBe(answer);
    expect(receipt.queryByText(/salary/)).toBeNull();
    await user.click(receipt.getByRole("checkbox"));
    expect(receipt.queryByText(/Northstar/)).toBeNull();
    expect(getLocalTarotReading(saved.id, saved.anonId)?.shortAnswer).toBe(answer);
  });

  it("does not let a departed chat overwrite a newer restored conversation", async () => {
    const user = userEvent.setup();
    const selectedCard = createHiddenDeck()[0]!;
    const { reading: saved } = saveLocalTarotReading({
      spreadType: "single", spreadLabel: "One card", roomDesign: ROOM_DESIGN,
      shortAnswer: "Your original answer.", questionMeaning: "Take one step.",
      cardMeanings: ["Signal: Your card."],
      cards: [{ ...selectedCard, positionLabel: "Signal", keywords: ["clarity"] }],
    });
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const view = renderWithProviders(<TarotHintReadingChat selectedCards={[selectedCard]} spread={SINGLE_SPREAD} archivedReading={saved} archiveOnOpen={false} roomDesign={ROOM_DESIGN} />);
    await user.type(screen.getByPlaceholderText("Ask what you want to understand next..."), "An earlier question.");
    await user.click(screen.getByRole("button", { name: "Send follow-up" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const signal = fetchMock.mock.calls[0]![1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    const latest = getLocalTarotReading(saved.id, saved.anonId)!;
    saveLocalTarotReading({ ...latest, chatMessages: [...latest.chatMessages, { id: "new", role: "assistant", content: "A newer restored conversation." }] });
    const archive = localStorage.getItem("hint_local_tarot_readings_v1");
    await act(async () => { finish(jsonResponse({ message: "A late reply from the departed screen." })); });
    expect(localStorage.getItem("hint_local_tarot_readings_v1")).toBe(archive);
  });

  it("keeps IME confirmation in the composer and sends only on an explicit Enter", async () => {
    const selectedCard = createHiddenDeck()[0]!;
    const { reading: saved } = saveLocalTarotReading({
      spreadType: "single", spreadLabel: "One card", shortAnswer: "Your original answer.",
      questionMeaning: "Take one step.", cardMeanings: ["Signal: Your card."],
      cards: [{ ...selectedCard, positionLabel: "Signal", keywords: ["clarity"] }],
    });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "A complete reply." }));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<TarotHintReadingChat selectedCards={[selectedCard]} spread={SINGLE_SPREAD} archivedReading={saved} archiveOnOpen={false} />);
    const composer = screen.getByPlaceholderText("Ask what you want to understand next...");
    fireEvent.change(composer, { target: { value: "A composed question" } });
    fireEvent.keyDown(composer, { key: "Enter", isComposing: true });
    fireEvent.keyDown(composer, { key: "Enter", keyCode: 229 });
    fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect((composer as HTMLTextAreaElement).value).toBe("A composed question");
    fireEvent.keyDown(composer, { key: "Enter" });
    expect(await screen.findByText("A complete reply.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("keeps an unsaved reading and chat in memory, warns before leaving, and retries the same archive", async () => {
    const user = userEvent.setup();
    const selectedCard = createHiddenDeck()[0]!;
    const onArchived = vi.fn();
    const onBack = vi.fn();
    const onNewReading = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const storage = interruptTarotStorage();
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        signal_type: "opening",
        overall_summary: "This complete answer stays available even while saving is unavailable.",
        cards: [{ position: "The Message", card_name: selectedCard.name, orientation: selectedCard.orientation, meaning: "The card's original explanation is preserved." }],
        final_action_advice: "Take a thoughtful next step.",
        follow_up_invitation: "What would you like to understand next?",
      }))
      .mockResolvedValueOnce(jsonResponse({ message: "This follow-up stays with your reading." })));

    renderWithProviders(<TarotHintReadingChat
      selectedCards={[selectedCard]}
      spread={SINGLE_SPREAD}
      question="What is opening now?"
      roomDesign={ROOM_DESIGN}
      existingReadingId="storage-retry"
      onArchived={onArchived}
      onBack={onBack}
      onNewReading={onNewReading}
    />);
    expect(await screen.findByText("This complete answer stays available even while saving is unavailable.")).toBeTruthy();
    expect(screen.getByText("Changes aren't saved on this device. Keep this page open and try again.").getAttribute("role")).toBe("alert");
    expect(screen.queryByText("Saved in History. You can leave and come back later.")).toBeNull();
    expect(onArchived).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText("Ask what you want to understand next..."), "Keep this follow-up too.");
    await user.click(screen.getByRole("button", { name: "Send follow-up" }));
    expect(await screen.findByText("This follow-up stays with your reading.")).toBeTruthy();
    expect(localStorage.getItem("hint_local_tarot_readings_v1")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Return home" }));
    await user.click(screen.getByRole("button", { name: "New reading" }));
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(onBack).not.toHaveBeenCalled();
    expect(onNewReading).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/app/tarot");
    const blockedReload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(blockedReload);
    expect(blockedReload.defaultPrevented).toBe(true);

    await user.click(screen.getByRole("button", { name: "Receive" }));
    expect(screen.getByRole("dialog", { name: "A letter to keep" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Back to reading" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    storage.failing = false;
    await user.click(screen.getByRole("button", { name: "Try saving again" }));
    expect(await screen.findByText("Saved in History. You can leave and come back later.")).toBeTruthy();
    const saved = onArchived.mock.calls.at(-1)![0];
    const restored = getLocalTarotReading("storage-retry", saved.anonId)!;
    expect(restored.roomDesign).toEqual(ROOM_DESIGN);
    expect(restored.cards[0]?.visualId).toBe(selectedCard.visualId);
    expect(restored.structuredReading?.overall_summary).toBe("This complete answer stays available even while saving is unavailable.");
    expect(restored.chatMessages.map((message) => message.content)).toEqual(["Keep this follow-up too.", "This follow-up stays with your reading."]);
    expect(JSON.parse(localStorage.getItem("hint_local_tarot_readings_v1")!)).toHaveLength(1);
    const allowedReload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(allowedReload);
    expect(allowedReload.defaultPrevented).toBe(false);
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledTimes(3);
  });

  it("preserves archived chat when a later follow-up cannot save until retry", async () => {
    const user = userEvent.setup();
    const selectedCard = createHiddenDeck()[0]!;
    const { reading: saved } = saveLocalTarotReading({
      spreadType: "single", spreadLabel: "One card", roomDesign: ROOM_DESIGN,
      shortAnswer: "The existing answer is still here.", questionMeaning: "Take one step.",
      cardMeanings: ["Signal: Your original card."],
      cards: [{ ...selectedCard, positionLabel: "Signal", keywords: ["clarity"] }],
      chatMessages: [{ id: "older", role: "assistant", content: "Your earlier conversation." }],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "Your newest reply." })));
    renderWithProviders(<TarotHintReadingChat selectedCards={[selectedCard]} spread={SINGLE_SPREAD} archivedReading={saved} archiveOnOpen={false} roomDesign={ROOM_DESIGN} />);
    const storage = interruptTarotStorage();
    await user.type(screen.getByPlaceholderText("Ask what you want to understand next..."), "One more question.");
    await user.click(screen.getByRole("button", { name: "Send follow-up" }));
    expect(await screen.findByText("Your newest reply.")).toBeTruthy();
    expect(getLocalTarotReading(saved.id, saved.anonId)?.chatMessages).toEqual(saved.chatMessages);
    expect(screen.getByRole("button", { name: "Try saving again" })).toBeTruthy();
    storage.failing = false;
    await user.click(screen.getByRole("button", { name: "Try saving again" }));
    expect(getLocalTarotReading(saved.id, saved.anonId)?.chatMessages.map((message) => message.content)).toEqual([
      "Your earlier conversation.", "One more question.", "Your newest reply.",
    ]);
  });

  it.each([null, { cards: [{ meaning: null }] }, { overall_summary: ["bad"], cards: [] }])("shows an intentional local fallback for malformed AI data: %j", async (response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(response)));
    renderWithProviders(<TarotHintReadingChat selectedCards={[createHiddenDeck()[0]!]} spread={SINGLE_SPREAD} roomDesign={ROOM_DESIGN} />);
    expect(await screen.findByRole("button", { name: "Refresh the interpretation" })).toBeTruthy();
    const records = JSON.parse(localStorage.getItem("hint_local_tarot_readings_v1")!);
    expect(records[0].interpretationStatus).toBe("local");
    expect(typeof records[0].structuredReading.overall_summary).toBe("string");
    expect(records[0].structuredReading.cards).toHaveLength(1);
  });

  it("keeps typed input available when voice recognition is unavailable", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TarotRoomFlow />);

    expect(
      screen.getByRole("heading", {
        name: "What do you need help seeing clearly?",
      }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe(
      "/app",
    );

    await user.click(screen.getByRole("button", { name: "Voice input" }));
    expect(
      await screen.findByText(
        "Voice input is not available in this browser. Try a browser with microphone dictation, or type it here.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Voice input stopped.")).toBeTruthy();
    expect(screen.queryByText("I'm listening...")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    const question = screen.getByPlaceholderText("Type your question...");
    await user.type(question, "What is opening now?");
    expect((question as HTMLTextAreaElement).value).toBe("What is opening now?");
  });

  it("cancels delayed voice startup when the sheet closes and ignores its late transcript", async () => {
    const user = userEvent.setup();
    let callbacks!: speech.HintSpeechOptions;
    let finishStart!: (session: speech.HintSpeechSession) => void;
    const cancel = vi.fn(async () => undefined);
    vi.spyOn(speech, "startHintSpeechRecognition").mockImplementation((options) => {
      callbacks = options;
      return new Promise((resolve) => { finishStart = resolve; });
    });
    renderWithProviders(<TarotRoomFlow />);
    await user.click(screen.getByRole("button", { name: "Voice input" }));
    expect(screen.getByText("Opening microphone...")).toBeTruthy();
    expect(screen.queryByText("I'm listening...")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(callbacks.signal?.aborted).toBe(true);
    await act(async () => {
      callbacks.onTranscript("This belongs to the dismissed recording");
      callbacks.onStart?.();
      finishStart({ stop: vi.fn(), cancel });
    });
    await waitFor(() => expect(cancel).toHaveBeenCalled());
    expect(screen.queryByText("This belongs to the dismissed recording")).toBeNull();
    expect((screen.getByPlaceholderText("Type your question...") as HTMLTextAreaElement).value).toBe("");
  });

  it("keeps the final transcript usable after dictation ends", async () => {
    const user = userEvent.setup();
    let callbacks!: speech.HintSpeechOptions;
    vi.spyOn(speech, "startHintSpeechRecognition").mockImplementation(async (options) => {
      callbacks = options;
      options.onStart?.();
      return { stop: vi.fn(), cancel: vi.fn() };
    });
    renderWithProviders(<TarotRoomFlow />);
    await user.click(screen.getByRole("button", { name: "Voice input" }));
    expect(screen.getByText("I'm listening...")).toBeTruthy();
    await act(async () => {
      callbacks.onTranscript("What should I notice today?");
      callbacks.onEnd();
    });
    expect(screen.getByText("Your question is ready.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Use this question" }));
    expect((screen.getByPlaceholderText("Type your question...") as HTMLTextAreaElement).value).toBe("What should I notice today?");
  });

  it("returns room settings to the exact pick stage and keeps Back separate from Home", async () => {
    const user = userEvent.setup();
    const deck = createHiddenDeck();
    saveActiveTarotSession({
      phase: "pick",
      question: "What is opening now?",
      spreadId: "three",
      focusLabel: "Clear signal",
      design: {
        id: "rose",
        label: "Rose Veil",
        mood: "Soft celestial focus.",
        deckStyleId: "rose",
        backStyle: "rose",
        cardBackId: ORIGINAL_SKY_BACK,
        cardArtId: "hint-classic",
        backgroundId: "stars",
        background: "linear-gradient(135deg, #ffe0ec, #fff7ee 52%, #e7ddff)",
        glow: "rgba(246,186,209,0.46)",
      },
      selectedCards: [],
      revealedIds: [],
      deck,
    });

    renderWithProviders(<TarotRoomFlow />);
    expect(await screen.findByRole("heading", { name: "Pick Cards" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe(
      "/app",
    );

    await user.click(screen.getByRole("button", { name: "Tarot room setup" }));
    expect(
      await screen.findByRole("heading", { name: "Decorate your room." }),
    ).toBeTruthy();
    await user.click(screen.getByTestId("tarot-room-background-dawn"));
    await user.click(screen.getByRole("button", { name: "Save room" }));

    expect(await screen.findByRole("heading", { name: "Pick Cards" })).toBeTruthy();
    expect(document.querySelector('[data-room-background="dawn"]')).toBeTruthy();
  });

  it("restarts an in-memory wash from Prepare after the app returns to foreground", async () => {
    localStorage.setItem(
      HINT_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ reduceMotion: false, soundAndHaptics: false }),
    );
    saveActiveTarotSession({
      phase: "prepare",
      question: "What is opening now?",
      spreadId: "three",
      focusLabel: "Clear signal",
      design: {
        id: "rose",
        label: "Rose Veil",
        mood: "Soft celestial focus.",
        deckStyleId: "rose",
        backStyle: "rose",
        cardBackId: ORIGINAL_SKY_BACK,
        cardArtId: "hint-classic",
        backgroundId: "stars",
        background: "linear-gradient(135deg, #ffe0ec, #fff7ee 52%, #e7ddff)",
        glow: "rgba(246,186,209,0.46)",
      },
      selectedCards: [],
      revealedIds: [],
    });
    renderWithProviders(<TarotRoomFlow />);

    expect(
      await screen.findByRole("button", { name: "Auto Wash" }, { timeout: 4_500 }),
    ).toBeTruthy();
    let visibility: DocumentVisibilityState = "hidden";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      visibility = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(
      await screen.findByRole("heading", {
        name: "Hold your question in your mind.",
      }),
    ).toBeTruthy();
  });

  it("restarts an interrupted wash from Prepare after native iOS resume", async () => {
    localStorage.setItem(
      HINT_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ reduceMotion: false, soundAndHaptics: false }),
    );
    saveActiveTarotSession({
      phase: "prepare",
      question: "What is opening now?",
      spreadId: "three",
      focusLabel: "Clear signal",
      design: {
        id: "rose",
        label: "Rose Veil",
        mood: "Soft celestial focus.",
        deckStyleId: "rose",
        backStyle: "rose",
        cardBackId: ORIGINAL_SKY_BACK,
        cardArtId: "hint-classic",
        backgroundId: "stars",
        background: "linear-gradient(135deg, #ffe0ec, #fff7ee 52%, #e7ddff)",
        glow: "rgba(246,186,209,0.46)",
      },
      selectedCards: [],
      revealedIds: [],
    });
    renderWithProviders(<TarotRoomFlow />);

    expect(
      await screen.findByRole("button", { name: "Auto Wash" }, { timeout: 4_500 }),
    ).toBeTruthy();
    await waitFor(() => expect(nativeLifecycle.listener).not.toBeNull());
    await act(async () => {
      nativeLifecycle.listener?.(false);
      nativeLifecycle.listener?.(true);
    });

    expect(
      await screen.findByRole("heading", {
        name: "Hold your question in your mind.",
      }),
    ).toBeTruthy();
  });

  it("restores an archived reading and durably appends follow-up chat", async () => {
    const user = userEvent.setup();
    const selectedCard = createHiddenDeck()[0]!;
    const completeAnswer = "The archived answer stays exactly as it was saved, including the full second half that explains how the whole spread answers the question instead of ending abruptly when the sentence reaches an arbitrary character limit.";
    const completeCardMeaning = "The saved card meaning remains available in full, with enough detail to explain why this card appeared in its exact spread position and how the user can understand it without a clipped ending.";
    const { reading: saved } = saveLocalTarotReading({
      id: "component-reading",
      anonId: getAnonId(),
      createdAt: "2026-09-02T00:00:00.000Z",
      spreadType: SINGLE_SPREAD.id,
      spreadLabel: SINGLE_SPREAD.label,
      question: "What is opening now?",
      focusLabel: "Clear signal",
      cardArtId: ROOM_DESIGN.cardArtId,
      roomDesign: ROOM_DESIGN,
      structuredReading: {
        signal_type: "opening",
        overall_summary: completeAnswer,
        cards: [
          {
            position: "Signal",
            card_name: selectedCard.name,
            orientation: selectedCard.orientation,
            meaning: completeCardMeaning,
          },
        ],
        final_action_advice: "Take one deliberate next step.",
        follow_up_invitation: "Ask about the signal when you are ready.",
      },
      chatMessages: [
        { id: "past-user", role: "user", content: "What did I miss?" },
        {
          id: "past-assistant",
          role: "assistant",
          content: "The saved conversation is still here.",
        },
      ],
      shortAnswer: completeAnswer,
      questionMeaning: "Take one deliberate next step.",
      cardMeanings: [`Signal: ${completeCardMeaning}`],
      cards: [
        {
          visualId: selectedCard.visualId,
          cardId: selectedCard.cardId,
          name: selectedCard.name,
          orientation: selectedCard.orientation,
          positionLabel: "Signal",
          keywords: ["opening", "clarity"],
        },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: "The new reply is saved too." }));
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(
      <TarotHintReadingChat
        selectedCards={[selectedCard]}
        spread={SINGLE_SPREAD}
        question={saved.question}
        focusLabel={saved.focusLabel}
        roomDesign={ROOM_DESIGN}
        archivedReading={saved}
        archiveOnOpen={false}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText(saved.shortAnswer)).toBeTruthy();
    expect(screen.getByText("What did I miss?")).toBeTruthy();
    expect(screen.getByText("The saved conversation is still here.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Return home" })).toBeTruthy();
    expect(screen.queryByText("Cards drawn")).toBeNull();
    expect(screen.getByText(completeCardMeaning)).toBeTruthy();
    expect(await screen.findByText("Tap a card to look closer")).toBeTruthy();
    const cardPreviewButton = screen.getByRole("button", {
      name: `Preview Signal, ${selectedCard.name}, ${selectedCard.orientation}`,
    });
    expect(cardPreviewButton).toBeTruthy();
    await user.click(cardPreviewButton);
    expect(screen.getByRole("dialog", { name: selectedCard.name })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Zoom out" })).toBeNull();
    const zoomToggle = screen.getByRole("button", { name: "Toggle card zoom" });
    expect(zoomToggle.getAttribute("aria-pressed")).toBe("false");
    await user.click(zoomToggle);
    expect(zoomToggle.getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Close card detail" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(screen.getByRole("button", { name: "Receive" }));
    expect(screen.getByRole("dialog", { name: "A letter to keep" })).toBeTruthy();
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole("button", { name: "Share receipt" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to reading" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Back to reading" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    const composer = screen.getByPlaceholderText(
      "Ask what you want to understand next...",
    );
    await user.type(composer, "What should I do next?");
    await user.click(screen.getByRole("button", { name: "Send follow-up" }));
    expect(await screen.findByText("The new reply is saved too.")).toBeTruthy();

    await waitFor(() => {
      expect(
        getLocalTarotReading(saved.id, saved.anonId)?.chatMessages.map(
          (message) => message.content,
        ),
      ).toEqual([
        "What did I miss?",
        "The saved conversation is still here.",
        "What should I do next?",
        "The new reply is saved too.",
      ]);
    });
  });

  it("shows a stable local reading on failure and replaces it only after retry", async () => {
    const user = userEvent.setup();
    const selectedCard = createHiddenDeck()[0]!;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(
        jsonResponse({
          signal_type: "clear_signal",
          overall_summary: "The retried interpretation arrived intentionally.",
          cards: [
            {
              position: "The Message",
              card_name: selectedCard.name,
              orientation: selectedCard.orientation,
              meaning: "The retried card meaning is grounded and readable.",
            },
          ],
          final_action_advice: "Take the smallest honest action.",
          follow_up_invitation: "Ask another question when ready.",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(
      <TarotHintReadingChat
        selectedCards={[selectedCard]}
        spread={SINGLE_SPREAD}
        question="What is opening now?"
        focusLabel="Clear signal"
        roomDesign={ROOM_DESIGN}
        archiveOnOpen={false}
      />,
    );

    const retry = await screen.findByRole("button", {
      name: "Refresh the interpretation",
    });
    expect(
      screen.queryByText("The retried interpretation arrived intentionally."),
    ).toBeNull();
    await user.click(retry);
    expect(
      await screen.findByText(
        "The retried interpretation arrived intentionally.",
        {},
        { timeout: 2_000 },
      ),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(["pending", "local"] as const)("restores a %s interpretation with an explicit durable retry", async (status) => {
    const user = userEvent.setup();
    const selectedCard = createHiddenDeck()[0]!;
    const { reading: saved } = saveLocalTarotReading({
      spreadType: "single",
      spreadLabel: "One card",
      roomDesign: ROOM_DESIGN,
      interpretationStatus: status,
      shortAnswer: "The saved local answer stays visible until you ask to refresh.",
      questionMeaning: "Keep the next step simple.",
      cardMeanings: ["Signal: The saved card meaning remains intact."],
      cards: [{
        ...selectedCard,
        positionLabel: "Signal",
        keywords: ["clarity"],
      }],
      chatMessages: [{ id: "saved-chat", role: "user", content: "Keep this conversation." }],
    });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      signal_type: "clear_signal",
      overall_summary: "The requested interpretation is now complete.",
      cards: [{
        position: "Signal",
        card_name: selectedCard.name,
        orientation: selectedCard.orientation,
        meaning: "A complete explanation of the original card.",
      }],
      final_action_advice: "Take one calm step.",
      follow_up_invitation: "Ask when ready.",
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(
      <TarotHintReadingChat
        selectedCards={[selectedCard]}
        spread={SINGLE_SPREAD}
        roomDesign={ROOM_DESIGN}
        archivedReading={saved}
        archiveOnOpen={false}
      />,
    );

    expect(screen.getByText(saved.shortAnswer)).toBeTruthy();
    const retry = await screen.findByRole("button", { name: "Refresh the interpretation" });
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(retry);
    expect(await screen.findByText("The requested interpretation is now complete.", {}, { timeout: 2_000 })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      const restored = getLocalTarotReading(saved.id, saved.anonId);
      expect(restored?.interpretationStatus).toBe("ready");
      expect(restored?.structuredReading?.overall_summary).toBe("The requested interpretation is now complete.");
      expect(restored?.roomDesign).toEqual(ROOM_DESIGN);
      expect(restored?.chatMessages).toEqual(saved.chatMessages);
    });
  });
});

vi.mock("@/lib/api", () => ({ apiUrl: (path: string) => path, apiFetch: (...args: Parameters<typeof fetch>) => fetch(...args) }));

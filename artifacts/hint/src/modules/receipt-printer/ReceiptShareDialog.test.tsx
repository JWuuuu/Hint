/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LanguageProvider } from "../../lib/i18n";
import { MotionPolicyProvider } from "../../lib/motionPolicy";
import { getAnonId } from "../../lib/identity";
import { getDailyReport } from "../home/data/dailyReport";
import { createHiddenDeck } from "../tarot/logic/createHiddenDeck";
import { saveLocalTarotReading } from "../readings/localTarotReadings";
import * as sharing from "../tarot/logic/shareReceipt";
import { ReceiptShareDialog, type ReceiptSource } from "./ReceiptShareDialog";
import { buildDailyReceiptModel } from "./receiptModel";
import { receiptText } from "./receiptStrings";
import { setHintThemePreference } from "../../lib/preferences";

beforeEach(() => {
  localStorage.clear(); localStorage.setItem("hint_anon_id", getAnonId());
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    font: "", measureText: (text: string) => ({ width: text.length * 10 }),
  } as unknown as CanvasRenderingContext2D);
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:fixture") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  vi.spyOn(sharing, "createTarotReceiptBlob").mockResolvedValue(new Blob(["png"]));
  vi.spyOn(sharing, "shareTarotReceipt").mockResolvedValue("cancelled");
  vi.spyOn(sharing, "saveTarotReceipt").mockResolvedValue("downloaded");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function source(): ReceiptSource {
  const { reading } = saveLocalTarotReading({ spreadType: "single", spreadLabel: "One card", question: "Private question", shortAnswer: "Private answer", questionMeaning: "Private meaning", cardMeanings: [], cards: [{ ...createHiddenDeck()[0], positionLabel: "Signal", keywords: [] }] });
  return { kind: "tarot", reading };
}
function mount(value = source(), onClose = vi.fn()) {
  return render(<LanguageProvider><MotionPolicyProvider><ReceiptShareDialog source={value} onClose={onClose} /></MotionPolicyProvider></LanguageProvider>);
}
const shareButton = () => screen.getByText("Share receipt", { selector: "button" }) as HTMLButtonElement;
const ready = async () => {
  await waitFor(() => expect(document.querySelector('.receipt-printer')).toBeTruthy());
  expect(screen.queryByRole("button", { name: "Tap to reveal" })).toBeNull();
  await waitFor(() => expect(shareButton().disabled).toBe(false));
};

it("opens directly to the public printer and completes automatically with reduced motion", async () => {
  const view = mount();
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByText("Make this letter yours")).toBeNull();
  expect(document.querySelector('.receipt-printer')).toBeTruthy();
  expect(shareButton().disabled).toBe(true);
  expect(document.querySelector('.receipt-printer__invitation')).toBeNull();
  await ready();
  const model = vi.mocked(sharing.createTarotReceiptBlob).mock.calls[0][0];
  expect(model.personal).toBe(false);
  expect(model.question).toBeUndefined();
  expect(model.insight).not.toContain("Private answer");
  expect(JSON.stringify(model)).not.toContain("Private meaning");
  expect(view.container.ownerDocument.querySelector('.receipt-printer')?.getAttribute('data-phase')).toBe('complete');
  expect(screen.queryByRole("button", { name: "Tap to reveal" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
  expect(screen.getByRole("button", { name: "Print again" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Show receipt" })).toBeNull();
  expect(screen.queryByText("Printing your letter…")).toBeNull();
  expect(document.querySelector('.receipt-printer')?.getAttribute('data-variant')).toBe('tarot');
  expect(screen.getByTestId("tarot-receipt-paper").querySelectorAll("svg image")).toHaveLength(1);
  expect(shareButton().disabled).toBe(false);
  expect(view.container.ownerDocument.querySelector('.receipt-printer')?.getAttribute('data-phase')).toBe('complete');
  expect(screen.queryByRole("button", { name: "Tap to reveal" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
});

it("rejects a late image after appearance changes and keeps personal details out of the new image", async () => {
  let finish!: (value: Blob) => void;
  const create = vi.mocked(sharing.createTarotReceiptBlob).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const view = mount();
  await waitFor(() => expect(create).toHaveBeenCalledOnce());
  const firstSignal = create.mock.calls[0][1]!.signal!;
  act(() => setHintThemePreference("bright"));
  await ready();
  expect(firstSignal.aborted).toBe(true);
  const currentModel = create.mock.calls[1][0];
  expect(currentModel.personal).toBe(false);
  expect(currentModel.question).toBeUndefined();
  expect(currentModel.insight).not.toContain("Private answer");
  const currentBlob = await create.mock.results[1].value;
  await act(async () => finish(new Blob(["late image"])));
  fireEvent.click(shareButton());
  await waitFor(() => expect(sharing.shareTarotReceipt).toHaveBeenCalledWith(currentBlob, expect.any(String), expect.any(Object)));
  view.unmount(); expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it.each(["tarot", "daily"] as const)("shows Skip only while %s is printing, including after replay", async kind => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  mount(kind === "daily" ? { kind, report: getDailyReport({ anonId: getAnonId(), language: "en" }) } : source());
  expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
  await screen.findByRole("button", { name: "Skip" });
  expect(document.querySelector('.receipt-printer__invitation')).toBeNull();
  expect(shareButton().disabled).toBe(true);
  expect(document.querySelector('.receipt-printer')?.getAttribute('data-phase')).toBe('warming');
  fireEvent.click(screen.getByRole("button", { name: "Skip" }));
  await waitFor(() => expect(shareButton().disabled).toBe(false));
  expect(document.querySelector('.receipt-printer')?.getAttribute('data-phase')).toBe('complete');
  expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Tap to reveal" })).toBeNull();
  expect(sharing.shareTarotReceipt).not.toHaveBeenCalled();
  expect(sharing.saveTarotReceipt).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Print again" }));
  expect(screen.queryByRole("button", { name: "Tap to reveal" })).toBeNull();
  expect(document.querySelector('.receipt-printer')?.getAttribute('data-phase')).toBe('warming');
  expect(screen.getByRole("button", { name: "Skip" })).toBeTruthy();
  expect(shareButton().disabled).toBe(true);
  expect(sharing.createTarotReceiptBlob).toHaveBeenCalledOnce();
});
it.each(["tarot", "daily"] as const)("waits for the current %s export, starts without a tap, and withholds actions until completion", async kind => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  let finish!: (value: Blob) => void;
  vi.mocked(sharing.createTarotReceiptBlob).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  mount(kind === "daily" ? { kind, report: getDailyReport({ anonId: getAnonId(), language: "en" }) } : source());
  await waitFor(() => expect(sharing.createTarotReceiptBlob).toHaveBeenCalledOnce());
  expect(document.querySelector('.receipt-printer')?.getAttribute('data-phase')).toBe('idle');
  expect(document.querySelector('.receipt-printer__invitation')).toBeNull();
  expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
  expect(shareButton().disabled).toBe(true);
  expect((screen.getByText("Save image", { selector: "button" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText("Ready to share.")).toBeNull();
  await act(async () => finish(new Blob(["png"])));
  expect(document.querySelector('.receipt-printer')?.getAttribute('data-phase')).toBe('warming');
  expect(shareButton().disabled).toBe(true);
  expect(screen.queryByText("Ready to share.")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Skip" }));
  await waitFor(() => expect(shareButton().disabled).toBe(false));
  expect(document.querySelector('.receipt-printer')?.getAttribute('data-phase')).toBe('complete');
  expect(sharing.shareTarotReceipt).not.toHaveBeenCalled();
  expect(sharing.saveTarotReceipt).not.toHaveBeenCalled();
});
it("blocks double share and permits retry after cancellation", async () => {
  let finish!: (outcome: "cancelled") => void;
  vi.mocked(sharing.shareTarotReceipt).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  mount(); await ready();
  fireEvent.click(shareButton()); fireEvent.click(shareButton());
  expect(sharing.shareTarotReceipt).toHaveBeenCalledOnce();
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect((screen.getByRole("button", { name: "Printer button" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => finish("cancelled")); await ready();
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(shareButton());
  expect(sharing.shareTarotReceipt).toHaveBeenCalledTimes(2);
});
it("keeps the completed receipt when the case or physical button is tapped", async () => {
  mount(); await ready();
  const machineButton = screen.getByRole("button", { name: "Printer button" }) as HTMLButtonElement;
  expect(machineButton.disabled).toBe(false);
  expect(document.querySelector('.receipt-printer__paper-window')?.closest('.receipt-printer__machine-layer')).toBeNull();
  expect(machineButton.closest('.receipt-printer__machine-layer')).toBeTruthy();
  fireEvent.click(machineButton);
  fireEvent.click(screen.getByRole("button", { name: "Tap printer" }));
  expect(document.querySelector('.receipt-printer')?.getAttribute('data-phase')).toBe('complete');
  expect(screen.queryByRole("button", { name: "Tap to reveal" })).toBeNull();
  expect(shareButton().disabled).toBe(false);
  expect(sharing.createTarotReceiptBlob).toHaveBeenCalledOnce();
  expect(sharing.shareTarotReceipt).not.toHaveBeenCalled();
});
it("Print again starts immediately with the same image, including after saving", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Skip" }));
  await ready();
  for (const afterSave of [false, true]) {
    if (afterSave) {
      fireEvent.click(screen.getByRole("button", { name: "Save image" }));
      await screen.findByRole("status");
    }
    const viewport = document.querySelector<HTMLElement>('.receipt-share-scroll')!;
    viewport.scrollTop = 900;
    fireEvent.click(screen.getByRole("button", { name: "Print again" }));
    expect(document.querySelector('.receipt-printer')?.getAttribute('data-phase')).toBe('warming');
    expect(viewport.scrollTop).toBe(0);
    expect(document.activeElement).toBe(document.querySelector('.receipt-share-printer-stage'));
    expect(screen.queryByRole("button", { name: "Tap to reveal" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByTestId("receipt-image-preview")).toBeNull();
    expect(shareButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    await ready();
    expect(document.querySelector('.receipt-printer')?.getAttribute('data-phase')).toBe('complete');
  }
  expect(sharing.createTarotReceiptBlob).toHaveBeenCalledOnce();
  expect(sharing.shareTarotReceipt).not.toHaveBeenCalled();
});
it("follows appearance changes for both the machine and prepared receipt", async () => {
  setHintThemePreference("bright");
  mount(); await ready();
  expect(screen.getByTestId("receipt-share-dialog").dataset.hintTheme).toBe("bright");
  expect(document.querySelector('.receipt-printer__reference-image')?.getAttribute('src')).toContain("blush-soft-base.png");
  expect(vi.mocked(sharing.createTarotReceiptBlob).mock.calls.at(-1)?.[0].theme).toBe("bright");
  act(() => setHintThemePreference("dark"));
  await ready();
  expect(screen.getByTestId("receipt-share-dialog").dataset.hintTheme).toBe("dark");
  expect(document.querySelector('.receipt-printer__reference-image')?.getAttribute('src')).toContain("midnight.png");
  expect(vi.mocked(sharing.createTarotReceiptBlob).mock.calls.at(-1)?.[0].theme).toBe("dark");
});
it("saves the prepared image once and locks competing actions until Photos confirms", async () => {
  let finish!: (value: "photos") => void;
  vi.mocked(sharing.saveTarotReceipt).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  mount(); await ready();
  const save = screen.getByRole("button", { name: "Save image" });
  fireEvent.click(save); fireEvent.click(save); fireEvent.click(shareButton());
  expect(sharing.saveTarotReceipt).toHaveBeenCalledOnce();
  expect(sharing.saveTarotReceipt).toHaveBeenCalledWith(await vi.mocked(sharing.createTarotReceiptBlob).mock.results[0].value, expect.stringMatching(/\.png$/), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(sharing.shareTarotReceipt).not.toHaveBeenCalled();
  expect((screen.getByRole("button", { name: "Print again" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByText("Saved to Photos")).toBeNull();
  await act(async () => finish("photos"));
  expect(screen.getByRole("status").textContent).toBe("Saved to Photos");
  expect((save as HTMLButtonElement).disabled).toBe(false);
});
it("shows denied Photos permission and allows retry without regenerating the receipt", async () => {
  vi.mocked(sharing.saveTarotReceipt).mockRejectedValueOnce(Object.assign(new Error("denied"), { code: "PHOTO_PERMISSION_DENIED" }));
  mount(); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Save image" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Settings"));
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("status");
  expect(sharing.saveTarotReceipt).toHaveBeenCalledTimes(2);
  expect(sharing.createTarotReceiptBlob).toHaveBeenCalledOnce();
  expect(screen.queryByRole("alert")).toBeNull();
});
it("shows preparation failure, retries, and replays without generating a different image", async () => {
  vi.mocked(sharing.createTarotReceiptBlob).mockRejectedValueOnce(new Error("decode failed"));
  mount(); expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Could not prepare"));
  expect(shareButton().disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Try again" })); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Print again" })); await ready();
  expect(sharing.createTarotReceiptBlob).toHaveBeenCalledTimes(2);
  expect(sharing.shareTarotReceipt).not.toHaveBeenCalled();
});
it("prints card reflections without carrying over long private questions or interpretations", async () => {
  const value = source();
  if (value.kind !== "tarot") throw new Error("Expected a Tarot reading");
  value.reading.question = "Private question ".repeat(1000);
  value.reading.shortAnswer = "Private answer ".repeat(1000);
  mount(value); await ready();
  const model = vi.mocked(sharing.createTarotReceiptBlob).mock.calls[0][0];
  expect(model.personal).toBe(false);
  expect(model.question).toBeUndefined();
  expect(JSON.stringify(model)).not.toContain("Private");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(shareButton().disabled).toBe(false);
  expect(screen.queryByText("Private answer")).toBeNull();
});
it("closes when the owner's history generation changes and rejects the late image", async () => {
  let finish!: (value: Blob) => void;
  vi.mocked(sharing.createTarotReceiptBlob).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const close = vi.fn(); const view = mount(source(), close);
  await waitFor(() => expect(sharing.createTarotReceiptBlob).toHaveBeenCalledOnce());
  act(() => { localStorage.setItem(`hint_history_clear_version_v1:${getAnonId()}`, "cleared"); window.dispatchEvent(new Event("storage")); });
  expect(close).toHaveBeenCalled(); view.unmount();
  await act(async () => finish(new Blob(["late"])));
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it("automatically prints a fresh receipt on each opening without a confirmation page", async () => {
  const value = source();
  const first = mount(value); await ready(); first.unmount();
  mount(value);
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(document.querySelector('.receipt-printer')?.getAttribute('data-phase')).toBe('idle');
  expect(screen.queryByRole("button", { name: "Tap to reveal" })).toBeNull();
  expect(shareButton().disabled).toBe(true);
  await ready();
  expect(vi.mocked(sharing.createTarotReceiptBlob).mock.calls.at(-1)?.[0].personal).toBe(false);
});
it("keeps Daily sharing on its existing immediate printer flow", async () => {
  const report = getDailyReport({ anonId: getAnonId(), language: "en" });
  mount({ kind: "daily", report });
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
  expect(document.querySelector('.receipt-printer')?.getAttribute('data-variant')).toBe('daily');
  await ready();
});
it("retains the current server-day scores during the Chicago evening UTC boundary", async () => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-15T20:30:00-06:00"));
  const report = getDailyReport({ anonId: getAnonId(), date: new Date("2026-11-16T12:00:00Z"), language: "en" });
  mount({ kind: "daily", report });
  await waitFor(() => expect(sharing.createTarotReceiptBlob).toHaveBeenCalledOnce());
  const model = vi.mocked(sharing.createTarotReceiptBlob).mock.calls[0][0];
  expect(model.daily?.scores.map(score => score.score)).toEqual(report.scores.map(score => score.score));
  expect(model.cards[0].name).toBe(report.card.cardName);
});
it("keeps a Daily receipt failure recoverable when the canvas is unavailable", async () => {
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
  vi.mocked(sharing.createTarotReceiptBlob).mockRejectedValueOnce(new Error("Canvas unavailable"));
  mount({ kind: "daily", report: getDailyReport({ anonId: getAnonId(), language: "en" }) });
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Could not prepare"));
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  expect(shareButton().disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
});
it.each(["en", "zh", "es", "ja", "ko"] as const)("uses the canonical Daily card in %s and omits unrecorded historical scores", language => {
  const report = getDailyReport({ anonId: getAnonId(), date: new Date(2026, 8, 1), language });
  const serialized = JSON.stringify(report);
  const current = buildDailyReceiptModel(report, language, true);
  const historical = buildDailyReceiptModel(report, language, false);
  expect(current.cards).toEqual(historical.cards);
  expect(historical.details).toBeUndefined(); expect(current.details?.length).toBeGreaterThan(5);
  expect(current.title).toBe(receiptText(language, "daily"));
  expect(historical.downloadUrl).toBeUndefined();
  expect(historical.date).toBe(new Date(2026, 8, 1, 12).toLocaleDateString(language, { year: "numeric", month: "long", day: "numeric" }));
  expect(JSON.stringify(report)).toBe(serialized);
});
it("changes Daily labels and color language without recalculating numeric results or card identity", () => {
  const report = getDailyReport({ anonId: getAnonId(), language: "en" });
  const en = buildDailyReceiptModel(report, "en");
  const zh = buildDailyReceiptModel(report, "zh");
  expect(zh.cards[0].image).toBe(en.cards[0].image);
  expect(zh.details?.slice(0, 6).map(item => item.value)).toEqual(en.details?.slice(0, 6).map(item => item.value));
  expect(zh.details?.map(item => item.label)).not.toContain("Love");
  expect(zh.details?.[6].value).not.toBe(en.details?.[6].value);
});

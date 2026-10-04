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

beforeEach(() => {
  localStorage.clear(); localStorage.setItem("hint_anon_id", getAnonId());
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:fixture") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  vi.spyOn(sharing, "createTarotReceiptBlob").mockResolvedValue(new Blob(["png"]));
  vi.spyOn(sharing, "shareTarotReceipt").mockResolvedValue("cancelled");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function source(): ReceiptSource {
  const { reading } = saveLocalTarotReading({ spreadType: "single", spreadLabel: "One card", question: "Private question", shortAnswer: "Private answer", questionMeaning: "Private meaning", cardMeanings: [], cards: [{ ...createHiddenDeck()[0], positionLabel: "Signal", keywords: [] }] });
  return { kind: "tarot", reading };
}
function mount(value = source(), onClose = vi.fn()) {
  return render(<LanguageProvider><MotionPolicyProvider><ReceiptShareDialog source={value} onClose={onClose} /></MotionPolicyProvider></LanguageProvider>);
}
const shareButton = () => screen.getByRole("button", { name: "Share receipt" }) as HTMLButtonElement;
const ready = () => waitFor(() => expect(shareButton().disabled).toBe(false));

it("rejects a late public image after private consent changes, keeps all cards, and releases URLs", async () => {
  let finish!: (value: Blob) => void;
  const create = vi.mocked(sharing.createTarotReceiptBlob).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const view = mount();
  await waitFor(() => expect(create).toHaveBeenCalledOnce());
  const firstSignal = create.mock.calls[0][1]!.signal!;
  fireEvent.click(screen.getByRole("checkbox"));
  await ready();
  expect(firstSignal.aborted).toBe(true);
  const privateModel = create.mock.calls[1][0];
  expect(privateModel.question).toBe("Private question");
  expect(privateModel.insight).toBe("Private answer");
  const privateBlob = await create.mock.results[1].value;
  await act(async () => finish(new Blob(["late public"])));
  fireEvent.click(shareButton());
  await waitFor(() => expect(sharing.shareTarotReceipt).toHaveBeenCalledWith(privateBlob, expect.any(String), expect.any(Object)));
  view.unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fixture");
});
it("blocks double share and freezes consent only during external sharing; cancellation permits retry", async () => {
  let finish!: (outcome: "cancelled") => void;
  vi.mocked(sharing.shareTarotReceipt).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  mount(); await ready();
  fireEvent.click(shareButton()); fireEvent.click(shareButton());
  expect(sharing.shareTarotReceipt).toHaveBeenCalledOnce();
  expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
  await act(async () => finish("cancelled")); await ready();
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(shareButton());
  expect(sharing.shareTarotReceipt).toHaveBeenCalledTimes(2);
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
it("requires an explicit public fallback for oversized private text", async () => {
  mount(); await ready();
  vi.mocked(sharing.createTarotReceiptBlob).mockRejectedValueOnce(new Error("Receipt text is too long"));
  fireEvent.click(screen.getByRole("checkbox"));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("too long"));
  expect(shareButton().disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Use card reflection" })); await ready();
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
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

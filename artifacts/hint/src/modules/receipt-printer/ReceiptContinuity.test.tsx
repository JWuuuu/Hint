/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LanguageProvider, useLanguage } from "../../lib/i18n";
import { getAnonId } from "../../lib/identity";
import { createHiddenDeck } from "../tarot/logic/createHiddenDeck";
import { saveLocalTarotReading } from "../readings/localTarotReadings";
import * as sharing from "../tarot/logic/shareReceipt";
import { ReceiptShareDialog } from "./ReceiptShareDialog";
import { ReceiptPrinter } from "./ReceiptPrinter";

const motion = vi.hoisted(() => ({ reduced: false, pageVisible: true }));
vi.mock("../../lib/motionPolicy", () => ({ useMotionPolicy: () => motion }));
beforeEach(() => {
  vi.useFakeTimers();
  motion.reduced = false; motion.pageVisible = true;
  localStorage.clear(); localStorage.setItem("hint_anon_id", getAnonId());
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:continuity") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  vi.spyOn(sharing, "createTarotReceiptBlob").mockResolvedValue(new Blob(["fixture"]));
  vi.spyOn(sharing, "shareTarotReceipt").mockResolvedValue("shared");
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function LanguageControl() {
  const { setLanguage } = useLanguage();
  return <button data-testid="language-control" onClick={() => setLanguage("zh")}>Language fixture</button>;
}
async function mount() {
  const { reading } = saveLocalTarotReading({ spreadType: "single", spreadLabel: "One card", question: "Private question", shortAnswer: "Private answer", questionMeaning: "Private meaning", cardMeanings: [], cards: [{ ...createHiddenDeck()[0], positionLabel: "Signal", keywords: [] }] });
  const view = render(<LanguageProvider><LanguageControl /><ReceiptShareDialog source={{ kind: "tarot", reading }} onClose={vi.fn()} /></LanguageProvider>);
  await act(async () => {});
  return view;
}
const printer = () => document.querySelector(".receipt-printer")!;
const share = () => document.querySelector(".receipt-share-footer > div button:last-child") as HTMLButtonElement;
const skip = () => fireEvent.click(screen.getByRole("button", { name: "Show receipt" }));
const replay = () => fireEvent.click(screen.getByRole("button", { name: "Print again" }));
const flush = async () => { await act(async () => {}); };
// jsdom has no CSS animation engine: this intentionally tests the timer fallback.
const finishFallback = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(280); }); await act(async () => { await vi.advanceTimersByTimeAsync(1750); }); };

it.each(["privacy", "language", "retry"])("does not carry a skipped run into %s changes", async change => {
  if (change === "retry") vi.mocked(sharing.createTarotReceiptBlob).mockRejectedValueOnce(new Error("encoder failed"));
  await mount(); skip();
  if (change === "privacy") fireEvent.click(screen.getByRole("checkbox"));
  else if (change === "language") fireEvent.click(screen.getByTestId("language-control"));
  else fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await flush();
  expect(printer().getAttribute("data-phase")).toBe("warming");
  expect(share().disabled).toBe(true);
  await finishFallback();
  expect(printer().getAttribute("data-phase")).toBe("complete");
  expect(share().disabled).toBe(false);
  if (change === "privacy") expect(screen.getByTestId("receipt-insight").textContent).toBe("Private answer");
});

it("keeps completed paper accessible on preview return and supplies equivalent preview text", async () => {
  await mount(); await finishFallback();
  fireEvent.click(screen.getByRole("button", { name: "Check image" }));
  const preview = screen.getByTestId("receipt-image-preview");
  expect(preview.getAttribute("alt")).not.toBe("Check image");
  expect(screen.getByTestId("receipt-insight").closest('[aria-hidden="true"], [hidden]')).toBeNull();
  expect(screen.queryByText("Private answer")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "View printed letter" }));
  expect(printer().getAttribute("data-phase")).toBe("complete");
  expect(document.querySelector(".receipt-printer__result-content")?.getAttribute("aria-hidden")).toBe("false");
});

it("does not reuse completed or skipped public state when privacy toggles back before private printing completes", async () => {
  await mount(); skip();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("checkbox")); await flush();
  expect(printer().getAttribute("data-phase")).toBe("warming");
  expect(share().disabled).toBe(true);
  expect(screen.queryByText("Private answer")).toBeNull();
  await finishFallback(); expect(share().disabled).toBe(false);
});

it("keeps private preview text and removes it immediately when consent is withdrawn", async () => {
  await mount(); fireEvent.click(screen.getByRole("checkbox")); await flush(); await finishFallback();
  fireEvent.click(screen.getByRole("button", { name: "Check image" }));
  expect(screen.getByText("Private answer").closest('[aria-hidden="true"], [hidden]')).toBeNull();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.queryByText("Private answer")).toBeNull();
  expect(screen.queryByTestId("receipt-image-preview")).toBeNull();
  expect(share().disabled).toBe(true);
  await flush(); await finishFallback(); expect(share().disabled).toBe(false);
});

it("rejects a late private image after consent is withdrawn and shares only the new public image", async () => {
  let resolvePrivate!: (blob: Blob) => void;
  const publicBlob = new Blob(["new public image"]);
  const create = vi.mocked(sharing.createTarotReceiptBlob)
    .mockResolvedValueOnce(new Blob(["first public image"]))
    .mockReturnValueOnce(new Promise(resolve => { resolvePrivate = resolve; }))
    .mockResolvedValueOnce(publicBlob);
  await mount(); skip();
  fireEvent.click(screen.getByRole("checkbox")); await flush();
  const privateSignal = create.mock.calls[1][1]!.signal!;
  fireEvent.click(screen.getByRole("checkbox")); await flush();
  expect(privateSignal.aborted).toBe(true);
  expect(share().disabled).toBe(true);
  await finishFallback();
  const urls = vi.mocked(URL.createObjectURL).mock.calls.length;
  await act(async () => resolvePrivate(new Blob(["late private image"])));
  expect(URL.createObjectURL).toHaveBeenCalledTimes(urls);
  fireEvent.click(share()); await flush();
  expect(sharing.shareTarotReceipt).toHaveBeenCalledWith(publicBlob, expect.any(String), expect.any(Object));
  expect(screen.queryByText("Private answer")).toBeNull();
});

it.each(["shared", "saved", "error"])("clears the previous %s outcome on replay", async outcome => {
  if (outcome === "error") vi.mocked(sharing.shareTarotReceipt).mockRejectedValueOnce(new Error("share failed"));
  else vi.mocked(sharing.shareTarotReceipt).mockResolvedValueOnce(outcome as "shared" | "saved");
  await mount(); await finishFallback(); fireEvent.click(share()); await flush();
  if (outcome === "error") expect(screen.getByRole("alert").textContent).toContain("Sharing did not finish");
  else expect(screen.getByRole("status").textContent).toBe(outcome === "shared" ? "Shared" : "Download started");
  replay();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("Printing your letter…");
  expect(share().disabled).toBe(true);
  await finishFallback();
  expect(screen.getByRole("status").textContent).toBe("Ready to share.");
  expect(sharing.createTarotReceiptBlob).toHaveBeenCalledOnce();
});

it("retains an image failure on replay and really retries preparation in a new run", async () => {
  vi.mocked(sharing.createTarotReceiptBlob).mockRejectedValueOnce(new Error("encoder failed"));
  await mount(); skip(); replay();
  expect(screen.getByRole("alert").textContent).toContain("Could not prepare");
  fireEvent.click(screen.getByRole("button", { name: "Try again" })); await flush();
  expect(sharing.createTarotReceiptBlob).toHaveBeenCalledTimes(2);
  expect(share().disabled).toBe(true);
  await finishFallback(); expect(share().disabled).toBe(false);
});

it("announces busy and ready again after ordinary cancellation", async () => {
  let resolve!: (value: "cancelled") => void;
  vi.mocked(sharing.shareTarotReceipt).mockReturnValueOnce(new Promise(done => { resolve = done; }));
  await mount(); await finishFallback(); fireEvent.click(share());
  expect(screen.getByRole("status").textContent).toBe("Sharing…");
  await act(async () => resolve("cancelled"));
  expect(screen.getByRole("status").textContent).toBe("Ready to share.");
});

it("latches reduced-motion completion until remount and calls completion once", async () => {
  const done = vi.fn(); motion.reduced = true;
  const view = render(<LanguageProvider><ReceiptPrinter onPrintComplete={done}>Letter</ReceiptPrinter></LanguageProvider>);
  expect(done).toHaveBeenCalledOnce();
  motion.reduced = false;
  view.rerender(<LanguageProvider><ReceiptPrinter onPrintComplete={done}>Letter</ReceiptPrinter></LanguageProvider>);
  expect(printer().getAttribute("data-phase")).toBe("complete");
  await finishFallback(); expect(done).toHaveBeenCalledOnce();
});

it("pauses the fallback while hidden and completes once on resume", async () => {
  const done = vi.fn();
  const element = () => <LanguageProvider><ReceiptPrinter onPrintComplete={done}>Letter</ReceiptPrinter></LanguageProvider>;
  const view = render(element());
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  motion.pageVisible = false; view.rerender(element());
  await finishFallback(); expect(done).not.toHaveBeenCalled();
  expect(printer().getAttribute("data-phase")).toBe("printing");
  motion.pageVisible = true; view.rerender(element());
  await finishFallback(); expect(done).toHaveBeenCalledOnce();
});

it("only accepts the paper feed animation end, not a child or unrelated animation", async () => {
  const done = vi.fn();
  render(<LanguageProvider><ReceiptPrinter onPrintComplete={done}><span>Letter</span></ReceiptPrinter></LanguageProvider>);
  await act(async () => { await vi.advanceTimersByTimeAsync(280); });
  const paper = document.querySelector(".receipt-printer__paper")!;
  const end = (element: Element, name: string) => {
    const event = new Event("webkitAnimationEnd", { bubbles: true });
    Object.defineProperty(event, "animationName", { value: name });
    fireEvent(element, event);
  };
  end(screen.getByText("Letter"), "receipt-result-feed"); end(paper, "other");
  expect(done).not.toHaveBeenCalled();
  end(paper, "receipt-result-feed"); expect(done).toHaveBeenCalledOnce();
  await finishFallback(); expect(done).toHaveBeenCalledOnce();
});

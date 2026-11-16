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
import { setHintThemePreference } from "../../lib/preferences";

const motion = vi.hoisted(() => ({ reduced: false, pageVisible: true }));
vi.mock("../../lib/motionPolicy", () => ({ useMotionPolicy: () => motion }));
beforeEach(() => {
  vi.useFakeTimers();
  motion.reduced = false; motion.pageVisible = true;
  localStorage.clear(); localStorage.setItem("hint_anon_id", getAnonId());
  setHintThemePreference("bright");
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(300);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ font: "", measureText: (text: string) => ({ width: text.length * 10 }) } as unknown as CanvasRenderingContext2D);
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
  await flush();
  start();
  return view;
}
const printer = () => document.querySelector(".receipt-printer")!;
const share = () => document.querySelector(".receipt-share-footer > div button:last-child") as HTMLButtonElement;
const start = () => fireEvent.click(document.querySelector(".receipt-printer__invitation")!);
const skip = () => fireEvent.click(screen.getByRole("button", { name: "Skip" }));
const dark = () => act(() => setHintThemePreference("dark"));
const bright = () => act(() => setHintThemePreference("bright"));
const replay = () => fireEvent.click(screen.getByRole("button", { name: "Print again" }));
const flush = async () => { await act(async () => {}); await act(async () => { await vi.advanceTimersByTimeAsync(3100); }); };
// jsdom has no CSS animation engine: this intentionally tests the timer fallback.
const finishFallback = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(280); }); await act(async () => { await vi.advanceTimersByTimeAsync(9000); }); };

it.each(["theme", "language", "retry"])("does not carry a skipped run into %s changes", async change => {
  if (change === "retry") vi.mocked(sharing.createTarotReceiptBlob).mockRejectedValueOnce(new Error("encoder failed"));
  await mount(); skip();
  if (change === "theme") dark();
  else if (change === "language") fireEvent.click(screen.getByTestId("language-control"));
  else fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await flush();
  expect(printer().getAttribute("data-phase")).toBe("idle");
  expect(share().disabled).toBe(true);
  start();
  await finishFallback();
  expect(printer().getAttribute("data-phase")).toBe("complete");
  expect(share().disabled).toBe(false);
  expect(JSON.stringify(vi.mocked(sharing.createTarotReceiptBlob).mock.calls.at(-1)?.[0])).not.toMatch(/Private answer|Private question|Private meaning/);
});

it("keeps completed paper accessible with equivalent public card text", async () => {
  await mount(); await finishFallback();
  const paper = screen.getByTestId("tarot-receipt-paper");
  expect(paper.closest('[aria-hidden="true"], [hidden]')).toBeNull();
  const model = vi.mocked(sharing.createTarotReceiptBlob).mock.calls.at(-1)![0];
  const description = paper.querySelector('svg[role="img"]')!.getAttribute("aria-label");
  expect(description).toContain(model.cards[0].name);
  expect(description).toContain(model.cards[0].meaning);
  expect(description).not.toMatch(/Private answer|Private question|Private meaning/);
  expect(screen.queryByRole("checkbox")).toBeNull();
});

it("does not reuse completed or skipped state when appearance changes back before printing completes", async () => {
  await mount(); skip();
  dark(); bright(); await flush();
  expect(printer().getAttribute("data-phase")).toBe("idle");
  expect(share().disabled).toBe(true);
  start(); await finishFallback(); expect(share().disabled).toBe(false);
});

it("keeps archived private text out of both the live paper and every changed export", async () => {
  await mount(); await finishFallback();
  fireEvent.click(screen.getByTestId("language-control")); await flush();
  expect(share().disabled).toBe(true);
  start(); await finishFallback();
  expect(share().disabled).toBe(false);
  expect(screen.queryByText("Private answer")).toBeNull();
  expect(screen.queryByText("Private question")).toBeNull();
  for (const [model] of vi.mocked(sharing.createTarotReceiptBlob).mock.calls) {
    expect(model.personal).toBe(false);
    expect(model.question).toBeUndefined();
    expect(JSON.stringify(model)).not.toMatch(/Private answer|Private question|Private meaning/);
  }
});

it("rejects a late image after appearance changes back and shares only the current image", async () => {
  let resolveOld!: (blob: Blob) => void;
  const currentBlob = new Blob(["new bright image"]);
  const create = vi.mocked(sharing.createTarotReceiptBlob)
    .mockResolvedValueOnce(new Blob(["first bright image"]))
    .mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce(currentBlob);
  await mount(); skip(); dark(); await flush();
  const oldSignal = create.mock.calls[1][1]!.signal!;
  bright(); await flush();
  expect(oldSignal.aborted).toBe(true);
  expect(share().disabled).toBe(true);
  start(); await finishFallback();
  await act(async () => resolveOld(new Blob(["late dark image"])));
  fireEvent.click(share()); await flush();
  expect(sharing.shareTarotReceipt).toHaveBeenCalledWith(currentBlob, expect.any(String), expect.any(Object));
});

it.each(["shared", "saved", "error"])("clears the previous %s outcome on replay", async outcome => {
  if (outcome === "error") vi.mocked(sharing.shareTarotReceipt).mockRejectedValueOnce(new Error("share failed"));
  else vi.mocked(sharing.shareTarotReceipt).mockResolvedValueOnce(outcome as "shared" | "saved");
  await mount(); await finishFallback(); fireEvent.click(share()); await flush();
  if (outcome === "error") expect(screen.getByRole("alert").textContent).toContain("Sharing did not finish");
  else expect(screen.getByRole("status").textContent).toBe(outcome === "shared" ? "Shared" : "Download started");
  replay();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(printer().getAttribute("data-phase")).toBe("idle");
  expect(share().disabled).toBe(true);
  await flush(); start();
  expect(screen.getByRole("status").textContent).toBe("Printing your letter…");
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
  start(); await finishFallback(); expect(share().disabled).toBe(false);
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
  const view = render(<LanguageProvider><ReceiptPrinter started onPrintComplete={done}>Letter</ReceiptPrinter></LanguageProvider>);
  expect(done).toHaveBeenCalledOnce();
  motion.reduced = false;
  view.rerender(<LanguageProvider><ReceiptPrinter started onPrintComplete={done}>Letter</ReceiptPrinter></LanguageProvider>);
  expect(printer().getAttribute("data-phase")).toBe("complete");
  await finishFallback(); expect(done).toHaveBeenCalledOnce();
});

it("pauses the fallback while hidden and completes once on resume", async () => {
  const done = vi.fn();
  const element = () => <LanguageProvider><ReceiptPrinter started onPrintComplete={done}>Letter</ReceiptPrinter></LanguageProvider>;
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
  render(<LanguageProvider><ReceiptPrinter started onPrintComplete={done}><span>Letter</span></ReceiptPrinter></LanguageProvider>);
  await act(async () => { await vi.advanceTimersByTimeAsync(280); });
  const paper = document.querySelector(".receipt-printer__paper")!;
  const end = (element: Element, name: string) => {
    const event = new Event("webkitAnimationEnd", { bubbles: true });
    Object.defineProperty(event, "animationName", { value: name });
    fireEvent(element, event);
  };
  end(screen.getByText("Letter"), "receipt-roll-feed"); end(paper, "other");
  expect(done).not.toHaveBeenCalled();
  end(paper, "receipt-roll-feed"); expect(done).toHaveBeenCalledOnce();
  await finishFallback(); expect(done).toHaveBeenCalledOnce();
});

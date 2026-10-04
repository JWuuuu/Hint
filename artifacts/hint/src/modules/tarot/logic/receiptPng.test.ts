/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createReceiptPng } from "./receiptPng";

class EncodingWorker {
  static current: EncodingWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { preventDefault: () => void }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { EncodingWorker.current = this; }
}
const bitmap = { width: 1800, height: 2800, close: vi.fn() };
const canvas = { width: 1800, height: 2800, toBlob: vi.fn() } as unknown as HTMLCanvasElement;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal("Worker", EncodingWorker);
  vi.stubGlobal("OffscreenCanvas", class { convertToBlob() {} });
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("transfers original-size pixels, resolves only a real PNG and releases its worker", async () => {
  const pending = createReceiptPng(canvas);
  await Promise.resolve();
  const worker = EncodingWorker.current;
  expect(worker.postMessage).toHaveBeenCalledWith({ bitmap }, [bitmap]);
  expect(canvas.toBlob).not.toHaveBeenCalled();
  const blob = new Blob(["png"], { type: "image/png" });
  worker.onmessage!({ data: { blob } });
  await expect(pending).resolves.toBe(blob);
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(worker.onmessage).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

it("cancels encoding and ignores a late result after closing or changing identity", async () => {
  const controller = new AbortController();
  const pending = createReceiptPng(canvas, controller.signal);
  const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  await Promise.resolve();
  const worker = EncodingWorker.current;
  const late = worker.onmessage!;
  controller.abort();
  late({ data: { blob: new Blob(["private"], { type: "image/png" }) } });
  await rejected;
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("closes pixels that become ready after cancellation without posting them", async () => {
  let finish!: (value: typeof bitmap) => void;
  vi.mocked(createImageBitmap).mockReturnValueOnce(new Promise(resolve => { finish = resolve as typeof finish; }));
  const controller = new AbortController();
  const pending = createReceiptPng(canvas, controller.signal);
  const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  finish(bitmap);
  await rejected;
  expect(bitmap.close).toHaveBeenCalledOnce();
  expect(EncodingWorker.current.postMessage).not.toHaveBeenCalled();
});

it.each(["error", "messageerror", "invalid", "timeout"])("surfaces %s and releases resources for a retry", async mode => {
  const pending = createReceiptPng(canvas);
  const rejected = expect(pending).rejects.toThrow(/Receipt export/);
  await Promise.resolve();
  const worker = EncodingWorker.current;
  if (mode === "error") worker.onerror!({ preventDefault: vi.fn() });
  if (mode === "messageerror") worker.onmessageerror!();
  if (mode === "invalid") worker.onmessage!({ data: { blob: new Blob([]) } });
  if (mode === "timeout") await vi.advanceTimersByTimeAsync(5_000);
  await rejected;
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("retains a cancellable full-resolution export when workers are unavailable", async () => {
  vi.stubGlobal("Worker", undefined);
  let callback!: BlobCallback;
  vi.mocked(canvas.toBlob).mockImplementationOnce(value => { callback = value; });
  const controller = new AbortController();
  const pending = createReceiptPng(canvas, controller.signal);
  const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png");
  controller.abort();
  callback(new Blob(["late"], { type: "image/png" }));
  await rejected;
  expect(canvas.width).toBe(1800);
  expect(vi.getTimerCount()).toBe(0);
});

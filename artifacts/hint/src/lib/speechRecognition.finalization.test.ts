import { afterEach, beforeEach, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({
  listeners: new Map<string, Set<(event: Record<string, unknown>) => void>>(),
  removers: [] as Array<ReturnType<typeof vi.fn>>,
  available: vi.fn(async () => ({ available: true })),
  requestPermissions: vi.fn(async () => ({ speechRecognition: "granted", microphone: "granted" })),
  start: vi.fn(async (_args: { language: string; sessionId?: string }) => ({ matches: [] as string[] })),
  stop: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
  cancel: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
}));
vi.mock("./mobile/runtime", () => ({ isNativeShell: () => true }));
vi.mock("./recordedSpeech", () => ({ canRecordSpeech: () => false, startRecordedSpeech: vi.fn() }));
vi.mock("@capacitor/core", () => ({ registerPlugin: () => ({ ...native,
  addListener: async (name: string, callback: (event: Record<string, unknown>) => void) => {
    const listeners = native.listeners.get(name) ?? new Set(); native.listeners.set(name, listeners); listeners.add(callback);
    const remove = vi.fn(async () => { listeners.delete(callback); }); native.removers.push(remove); return { remove };
  },
}) }));
import { startHintSpeechRecognition } from "./speechRecognition";
const id = () => native.start.mock.lastCall?.[0].sessionId;
function emit(name: string, value: Record<string, unknown>, sessionId = id()) {
  native.listeners.get(name)?.forEach(callback => callback({ ...value, sessionId }));
}
function callbacks() {
  const events: string[] = [];
  return { language: "en-US", events, onStart: vi.fn(), onProcessing: vi.fn(() => events.push("processing")),
    onTranscript: vi.fn((text: string) => events.push(`text:${text}`)), onError: vi.fn(() => events.push("error")), onEnd: vi.fn(() => events.push("end")) };
}
beforeEach(() => {
  vi.useFakeTimers(); native.listeners.clear(); native.removers.length = 0;
  native.start.mockClear(); native.stop.mockReset().mockResolvedValue(undefined); native.cancel.mockReset().mockResolvedValue(undefined);
});
afterEach(() => { vi.useRealTimers(); });

it("delivers the final words arriving after Stop before ending once", async () => {
  const cb = callbacks(), session = await startHintSpeechRecognition(cb);
  emit("partialResults", { matches: ["Almost"] });
  const stopping = session.stop();
  expect(cb.onProcessing).toHaveBeenCalledOnce(); expect(cb.onEnd).not.toHaveBeenCalled();
  emit("partialResults", { matches: ["Almost finished"], isFinal: true });
  emit("listeningState", { status: "stopped" }); await stopping;
  expect(cb.events).toEqual(["text:Almost", "processing", "text:Almost finished", "end"]);
  native.removers.forEach(remove => expect(remove).toHaveBeenCalledOnce()); expect(native.cancel).not.toHaveBeenCalled();
});

it.each(["final-first", "error-first"])("settles %s ordering once without late words or contradictory errors", async order => {
  const cb = callbacks(), session = await startHintSpeechRecognition(cb); const stopping = session.stop();
  const final = () => emit("partialResults", { matches: ["Finished"], isFinal: true });
  const error = () => emit("speechError", { message: "fixture recognition error" });
  if (order === "final-first") { final(); error(); final(); } else { error(); final(); error(); }
  emit("listeningState", { status: "stopped" }); await stopping;
  expect(cb.events).toEqual(order === "final-first" ? ["processing", "text:Finished", "end"] : ["processing", "error", "end"]);
});

it("deduplicates Stop and bounds a missing final/state response", async () => {
  native.stop.mockReturnValue(new Promise(() => undefined));
  const cb = callbacks(), session = await startHintSpeechRecognition(cb);
  const one = session.stop(), two = session.stop();
  expect(native.stop).toHaveBeenCalledOnce(); expect(cb.onEnd).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(2499); expect(cb.onEnd).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); await Promise.all([one, two]);
  expect(cb.onEnd).toHaveBeenCalledOnce(); expect(native.cancel).toHaveBeenCalledOnce();
  emit("partialResults", { matches: ["Too late"], isFinal: true }); expect(cb.onTranscript).not.toHaveBeenCalled();
  native.removers.forEach(remove => expect(remove).toHaveBeenCalledOnce());
});

it.each(["cancel", "background", "navigation"])("%s immediately overrides a graceful stop and drops pending words", async action => {
  native.stop.mockReturnValue(new Promise(() => undefined));
  native.cancel.mockReturnValue(new Promise(() => undefined));
  const controller = new AbortController(), cb = callbacks();
  const session = await startHintSpeechRecognition({ ...cb, signal: controller.signal });
  const late = [...native.listeners.get("partialResults")!][0];
  const stopping = session.stop();
  if (action === "cancel") void session.cancel(); else controller.abort();
  expect(cb.onEnd).toHaveBeenCalledOnce(); expect(native.cancel).toHaveBeenCalledOnce();
  late({ sessionId: id(), matches: ["Discard me"], isFinal: true });
  await stopping; await vi.advanceTimersByTimeAsync(3000);
  expect(cb.onTranscript).not.toHaveBeenCalled(); expect(cb.onError).not.toHaveBeenCalled(); expect(cb.onEnd).toHaveBeenCalledOnce();
  native.removers.forEach(remove => expect(remove).toHaveBeenCalledOnce());
});

it("keeps cancel immediate without a processing state or a final transcript", async () => {
  const cb = callbacks(), session = await startHintSpeechRecognition(cb);
  await session.cancel(); emit("partialResults", { matches: ["discard"], isFinal: true });
  expect(cb.events).toEqual(["end"]); expect(native.stop).not.toHaveBeenCalled();
});

it("does not leak old events into a retry or send old stop/cancel commands to it", async () => {
  const first = callbacks(), old = await startHintSpeechRecognition(first); const oldId = id();
  const stopped = old.stop(); emit("partialResults", { matches: ["First"], isFinal: true }); await stopped;
  const second = callbacks(), current = await startHintSpeechRecognition(second); const currentId = id();
  expect(currentId).not.toBe(oldId);
  emit("partialResults", { matches: ["Old words"], isFinal: true }, oldId);
  emit("speechError", { message: "Old error" }, oldId); emit("listeningState", { status: "stopped" }, oldId);
  expect(second.events).toEqual([]); await old.cancel();
  emit("partialResults", { matches: ["Second"], isFinal: true }, currentId);
  expect(second.events).toEqual(["text:Second", "end"]); await current.cancel();
  expect(native.stop).toHaveBeenCalledWith({ sessionId: oldId }); expect(native.cancel).not.toHaveBeenCalled();
});

it("closes on bridge stop rejection, reports once and requests scoped cancellation", async () => {
  native.stop.mockRejectedValue(new Error("fixture bridge failed"));
  const cb = callbacks(), session = await startHintSpeechRecognition(cb); await session.stop();
  expect(cb.events).toEqual(["processing", "error", "end"]);
  expect(native.cancel).toHaveBeenCalledWith({ sessionId: id() });
  emit("partialResults", { matches: ["late"], isFinal: true }); expect(cb.onTranscript).not.toHaveBeenCalled();
});

it("late stop rejection after a final result cannot cancel a newer recording", async () => {
  let reject!: (error: Error) => void;
  native.stop.mockReturnValueOnce(new Promise((_resolve, no) => { reject = no; }));
  const first = callbacks(), old = await startHintSpeechRecognition(first); const stopping = old.stop();
  emit("partialResults", { matches: ["Done"], isFinal: true }); await stopping;
  const second = callbacks(), current = await startHintSpeechRecognition(second);
  reject(new Error("late stop failure")); await Promise.resolve(); await Promise.resolve();
  expect(native.cancel).not.toHaveBeenCalled(); expect(first.onError).not.toHaveBeenCalled();
  emit("partialResults", { matches: ["New"], isFinal: true }); expect(second.events).toEqual(["text:New", "end"]); await current.cancel();
});

it("listener removal rejection or a stuck removal cannot retain live callbacks or block completion", async () => {
  const cb = callbacks(), session = await startHintSpeechRecognition(cb);
  native.removers[0].mockRejectedValue(new Error("fixture listener removal failed"));
  native.removers[1].mockReturnValue(new Promise(() => undefined));
  const stopping = session.stop(); emit("partialResults", { matches: ["Final"], isFinal: true });
  await stopping; emit("partialResults", { matches: ["late"], isFinal: true }); emit("speechError", {});
  expect(cb.events).toEqual(["processing", "text:Final", "end"]);
  native.removers.forEach(remove => expect(remove).toHaveBeenCalledOnce());
});

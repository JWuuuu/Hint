import express from "express";
import type { Server } from "node:http";
import { APIConnectionTimeoutError, APIError } from "openai";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ take: vi.fn(), release: vi.fn(), transcribe: vi.fn(), speech: vi.fn(), log: vi.fn() }));
vi.mock("@workspace/db", () => ({ pool: {} }));
vi.mock("../lib/durableBudget", async original => ({
  ...await original<object>(), takeBudget: mock.take, releaseProviderLease: mock.release,
}));
vi.mock("../lib/logger", () => ({ logger: { error: mock.log } }));
vi.mock("../lib/openaiConfig.js", () => ({
  openaiApiKey: "test-only", openaiTtsModel: "test", openaiTtsVoice: "test", openaiTranscriptionModel: "test",
  getOpenAIClient: () => ({ audio: { transcriptions: { create: mock.transcribe }, speech: { create: mock.speech } } }),
}));
import router from "./speech";
import { BudgetExceeded } from "../lib/durableBudget";
import { errorHandler } from "../lib/errorHandler";
import { providerSignal } from "../lib/providerCancellation";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
let server: Server, url: string, serial = 0, charges = 0;
const active = new Set<string>();
beforeAll(async () => {
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => {
    req.deviceSession = { ownerId: `test-owner-${++serial}`, id: "test", expiresAt: new Date(Date.now() + 60000) };
    next();
  });
  app.use(router); app.use(errorHandler);
  server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(() => {
  active.clear(); charges = 0; vi.clearAllMocks();
  mock.take.mockReset().mockImplementation(async () => {
    if (active.size >= 8) throw new BudgetExceeded(30);
    const id = `lease-${++charges}`; active.add(id); return id;
  });
  mock.release.mockReset().mockImplementation(async (id: string) => { active.delete(id); });
  mock.transcribe.mockReset().mockResolvedValue({ text: "A spoken phrase." });
  mock.speech.mockReset().mockResolvedValue({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
});
const post = (path = "/speech/transcription", signal?: AbortSignal) => fetch(url + path, {
  method: "POST", headers: { "Content-Type": path === "/speech" ? "application/json" : "audio/webm" },
  body: path === "/speech" ? JSON.stringify({ text: "A reply." }) : "audio bytes", signal,
});
const released = () => vi.waitFor(() => expect(active.size).toBe(0));

it.each(["/speech/transcription", "/transcribe", "/speech"])("releases successful %s using the real budget guard", async path => {
  const response = await post(path); await response.arrayBuffer();
  expect(response.status).toBe(200); await released();
  expect(mock.release).toHaveBeenCalledExactlyOnceWith("lease-1"); expect(charges).toBe(1);
});

it.each([
  ["failure", () => new APIError(500, {}, "provider failed", new Headers())],
  ["timeout", () => new APIConnectionTimeoutError()],
] as const)("releases transcription after provider %s and preserves the 502 response", async (_reason, error) => {
  mock.transcribe.mockRejectedValueOnce(error());
  const response = await post();
  expect(response.status).toBe(502); expect(await response.json()).toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  await released(); expect(mock.release).toHaveBeenCalledTimes(1); expect(charges).toBe(1);
});

it("aborts voice and frees its lease after HTTP disconnection", async () => {
  const started = deferred<AbortSignal>();
  mock.transcribe.mockImplementationOnce((_input, { signal }: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }); started.resolve(signal);
  }));
  const client = new AbortController(), request = post(undefined, client.signal);
  const rejected = expect(request).rejects.toMatchObject({ name: "AbortError" });
  const signal = await started.promise; client.abort(); await rejected; await released();
  expect(signal.aborted).toBe(true); expect(mock.release).toHaveBeenCalledTimes(1); expect(charges).toBe(1);
  expect(mock.log).not.toHaveBeenCalled();
});

it("cancels while admission is pending, releasing the late lease without uploading audio", async () => {
  const entered = deferred<AbortSignal>(), admission = deferred<string>();
  mock.take.mockImplementationOnce(() => { entered.resolve(providerSignal()!); return admission.promise; });
  const client = new AbortController(), request = post(undefined, client.signal);
  const rejected = expect(request).rejects.toMatchObject({ name: "AbortError" });
  const signal = await entered.promise;
  const aborted = new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
  client.abort(); await rejected; await aborted;
  active.add("late-lease"); charges++; admission.resolve("late-lease");
  await released(); expect(mock.transcribe).not.toHaveBeenCalled();
  expect(mock.release).toHaveBeenCalledExactlyOnceWith("late-lease"); expect(charges).toBe(1);
});

it("keeps the TTS lease until the response body settles after cancellation", async () => {
  const started = deferred<AbortSignal>(), body = deferred<ArrayBuffer>();
  mock.speech.mockImplementationOnce(async (_input, { signal }: { signal: AbortSignal }) => ({
    arrayBuffer: () => { started.resolve(signal); return body.promise; },
  }));
  const client = new AbortController(), request = post("/speech", client.signal);
  const rejected = expect(request).rejects.toMatchObject({ name: "AbortError" });
  const signal = await started.promise;
  const aborted = new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
  client.abort(); await rejected; await aborted;
  expect(active.size).toBe(1); expect(mock.release).not.toHaveBeenCalled();
  body.resolve(new Uint8Array([1, 2, 3]).buffer); await released();
  expect(mock.release).toHaveBeenCalledTimes(1);
});

it("twelve HTTP voice cancellations leave capacity for the next user's request", async () => {
  for (let i = 0; i < 12; i++) {
    const started = deferred();
    mock.transcribe.mockImplementationOnce((_input, { signal }: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }); started.resolve();
    }));
    const client = new AbortController(), request = post(undefined, client.signal);
    const rejected = expect(request).rejects.toMatchObject({ name: "AbortError" });
    await started.promise; client.abort(); await rejected; await released();
  }
  const response = await post(); expect(response.status).toBe(200); await response.json(); await released();
  expect(charges).toBe(13); expect(mock.release).toHaveBeenCalledTimes(13);
});

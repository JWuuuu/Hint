import express from "express";
import type { Server } from "node:http";
import { APIError } from "openai";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => ({ transcribe: vi.fn(), budget: vi.fn(async (..._args: unknown[]) => true), log: vi.fn(), key: "test-only" }));
vi.mock("../lib/openaiConfig.js", () => ({
  get openaiApiKey() { return provider.key; }, openaiTtsModel: "test", openaiTtsVoice: "test", openaiTranscriptionModel: "test-transcribe",
  getOpenAIClient: () => ({ audio: { transcriptions: { create: provider.transcribe } } }),
}));
vi.mock("../lib/aiCostGuards.js", () => ({ consumeAiBudget: provider.budget }));
vi.mock("@workspace/db", () => ({ pool: {} }));
vi.mock("../lib/logger", () => ({ logger: { error: provider.log } }));
import { errorHandler } from "../lib/errorHandler";
import router from "./speech";
let server: Server, url: string;
beforeAll(async () => {
  const app = express(); app.use(express.json({ limit: "100kb" })); app.use(router);
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Missing test address");
  url = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(() => { provider.key = "test-only"; provider.budget.mockClear(); provider.log.mockClear(); provider.transcribe.mockReset().mockResolvedValue({ text: " A real phrase. " }); });
const post = (type = "audio/webm;codecs=opus", body: NonNullable<Parameters<typeof fetch>[1]>["body"] = "audio bytes", language = "en") => fetch(`${url}/speech/transcription?language=${language}`, { method: "POST", headers: { "Content-Type": type }, body });
it("accepts bounded audio through the JSON middleware and returns only the transcript", async () => {
  const response = await post(); expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ text: "A real phrase." });
  expect(response.headers.get("cache-control")).toBe("no-store");
  const [input, options] = provider.transcribe.mock.calls[0];
  expect(input.language).toBe("en"); expect(input.file.name).toBe("voice.webm");
  expect(await input.file.text()).toBe("audio bytes"); expect(options.signal).toBeInstanceOf(AbortSignal);
  expect(provider.budget).toHaveBeenCalledWith(expect.anything(), expect.anything(), { feature: "transcription", dailyLimit: 30 });
});
it.each([
  ["text/plain", "audio", "en", 415, "UNSUPPORTED_AUDIO"], ["audio/flac", "audio", "en", 415, "UNSUPPORTED_AUDIO"],
  ["audio/webm", "", "en", 400, "EMPTY_AUDIO"], ["audio/webm", "audio", "invalid", 400, "UNSUPPORTED_LANGUAGE"],
])("rejects invalid input before any provider use (%s, %s, %s)", async (type, body, language, status, code) => {
  const response = await post(type, body, language);
  expect(response.status).toBe(status); expect(((await response.json()) as { code?: string }).code).toBe(code);
  expect(provider.transcribe).not.toHaveBeenCalled(); expect(provider.budget).not.toHaveBeenCalled();
});
it("normalizes region-tagged locales and native recorder formats", async () => {
  expect((await post("audio/x-m4a", "audio bytes", "zh-CN")).status).toBe(200);
  const [input] = provider.transcribe.mock.calls[0];
  expect(input.language).toBe("zh"); expect(input.file.name).toBe("voice.m4a");
});
it("serves the d1fbcf8 /transcribe alias with the same handler and budget", async () => {
  const response = await fetch(`${url}/transcribe?language=ja-JP`, { method: "POST", headers: { "Content-Type": "audio/ogg;codecs=opus" }, body: "audio bytes" });
  expect(await response.json()).toEqual({ text: "A real phrase." });
  expect(provider.transcribe.mock.calls[0][0].language).toBe("ja");
  expect(provider.budget).toHaveBeenCalledWith(expect.anything(), expect.anything(), { feature: "transcription", dailyLimit: 30 });
});
it.each([[500, 502], [429, 429]])("maps provider status %s through the real shared error handler to %s", async (upstreamStatus, expectedStatus) => {
  provider.transcribe.mockRejectedValue(new APIError(upstreamStatus, { message: "upstream secret detail" }, "upstream secret detail", new Headers()));
  const response = await post();
  expect(response.status).toBe(expectedStatus);
  const body = await response.json() as { code: string; requestId: string };
  expect(body.code).toBe("PROVIDER_UNAVAILABLE");
  expect(body.requestId).toBe(response.headers.get("x-request-id"));
  expect(JSON.stringify(body)).not.toContain("secret");
  expect(provider.log).toHaveBeenCalledOnce();
  expect(JSON.stringify(provider.log.mock.calls)).not.toContain("secret");
});
it("aborts an in-flight provider request when the recording upload client disconnects", async () => {
  let providerStarted!: (signal: AbortSignal) => void;
  const started = new Promise<AbortSignal>(resolve => { providerStarted = resolve; });
  provider.transcribe.mockImplementation((_input, options: { signal: AbortSignal }) => {
    providerStarted(options.signal);
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("Request cancelled")), { once: true });
    });
  });
  const controller = new AbortController();
  const response = fetch(`${url}/speech/transcription?language=en`, {
    method: "POST", headers: { "Content-Type": "audio/webm" }, body: "audio bytes", signal: controller.signal,
  });
  const rejected = expect(response).rejects.toMatchObject({ name: "AbortError" });
  const signal = await started;
  const aborted = new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
  controller.abort();
  await rejected;
  await aborted;
  expect(signal.aborted).toBe(true);
  expect(provider.log).not.toHaveBeenCalled();
});
it("does not call the provider when the budget guard refuses", async () => {
  provider.budget.mockImplementationOnce(async (_req, res) => { (res as express.Response).status(429).json({ error: "limit" }); return false; });
  expect((await post()).status).toBe(429); expect(provider.transcribe).not.toHaveBeenCalled();
});
it("rejects uploads over four megabytes before provider use", async () => {
  expect((await post("audio/webm", new Uint8Array(4 * 1024 * 1024 + 1))).status).toBe(413);
  expect(provider.transcribe).not.toHaveBeenCalled();
});
it("exposes configuration readiness without requesting transcription", async () => {
  provider.key = "";
  const status = await fetch(`${url}/speech/transcription/status`);
  expect(await status.json()).toEqual({ available: false });
  expect((await post()).status).toBe(503); expect(provider.transcribe).not.toHaveBeenCalled();
});

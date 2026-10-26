import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => ({
  create: vi.fn(),
  budget: vi.fn(async (_req: unknown, _res: unknown, _options?: unknown): Promise<boolean> => true),
}));
vi.mock("@workspace/db", () => ({ db: {} }));
vi.mock("../lib/logger.js", () => ({ logger: { error: vi.fn() } }));
vi.mock("../lib/aiCostGuards.js", () => ({ consumeAiBudget: provider.budget }));
vi.mock("../lib/openaiConfig.js", () => ({
  openaiTranscribeModel: "test-transcribe-model",
  getOpenAIClient: () => ({ audio: { transcriptions: { create: provider.create } } }),
}));

import router, { MAX_TRANSCRIBE_BYTES } from "./transcribe.js";
import { errorHandler } from "../lib/errorHandler.js";

let server: Server;
let url: string;
const recording = Buffer.alloc(4096, 7);

function upload(body: NonNullable<RequestInit["body"]>, type = "audio/webm;codecs=opus", query = "?language=en-US", signal?: AbortSignal) {
  return fetch(`${url}/transcribe${query}`, { method: "POST", headers: { "Content-Type": type }, body, signal });
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server");
  url = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });
beforeEach(() => { provider.create.mockReset(); provider.budget.mockReset(); provider.budget.mockResolvedValue(true); });

describe("POST /transcribe", () => {
  it("returns the provider transcript for a recorded turn", async () => {
    provider.create.mockResolvedValue({ text: "  Will this move work out?  " });
    const response = await upload(recording);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ text: "Will this move work out?" });
    const [body, options] = provider.create.mock.calls[0]!;
    expect(body).toMatchObject({ model: "test-transcribe-model", language: "en", response_format: "json" });
    expect(body.file.name).toBe("speech.webm");
    expect(body.file.type).toBe("audio/webm");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(provider.budget).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ feature: "transcribe" }));
  });

  it("names Safari recordings so the provider can decode them and ignores unknown languages", async () => {
    provider.create.mockResolvedValue({ text: "hola" });
    await upload(recording, "audio/mp4", "?language=xx-YY");
    const [body] = provider.create.mock.calls[0]!;
    expect(body.file.name).toBe("speech.mp4");
    expect(body).not.toHaveProperty("language");
  });

  it("rejects non-audio uploads and empty recordings before spending provider budget", async () => {
    expect((await upload(JSON.stringify({ text: "hi" }), "application/json")).status).toBe(415);
    expect((await upload(recording, "video/webm")).status).toBe(415);
    const empty = await upload(Buffer.alloc(10), "audio/ogg");
    expect(empty.status).toBe(400);
    expect(await empty.json()).toMatchObject({ code: "EMPTY_AUDIO" });
    expect(provider.budget).not.toHaveBeenCalled();
    expect(provider.create).not.toHaveBeenCalled();
  });

  it("refuses recordings over the size cap", async () => {
    const response = await upload(Buffer.alloc(MAX_TRANSCRIBE_BYTES + 1024, 1));
    expect(response.status).toBe(413);
    expect(provider.create).not.toHaveBeenCalled();
  });

  it("stops before the provider when the budget is exhausted", async () => {
    provider.budget.mockImplementation(async (_req, res) => {
      (res as { status: (code: number) => { json: (body: unknown) => void } }).status(429).json({ code: "PROVIDER_BUDGET_EXHAUSTED" });
      return false;
    });
    expect((await upload(recording)).status).toBe(429);
    expect(provider.create).not.toHaveBeenCalled();
  });

  it("reports provider failure without inventing a transcript", async () => {
    provider.create.mockRejectedValue(new Error("upstream unavailable"));
    const response = await upload(recording);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Voice input is unavailable right now.", code: "TRANSCRIPTION_UNAVAILABLE" });
  });

  it("cancels the provider request when the phone disconnects", async () => {
    let resolveSignal!: (signal: AbortSignal) => void;
    const started = new Promise<AbortSignal>((resolve) => { resolveSignal = resolve; });
    provider.create.mockImplementation((_body: unknown, { signal }: { signal: AbortSignal }) => new Promise((_, reject) => {
      resolveSignal(signal);
      signal.addEventListener("abort", () => reject(new Error("Cancelled")), { once: true });
    }));
    const controller = new AbortController();
    const pending = upload(recording, undefined, undefined, controller.signal).catch(() => undefined);
    const signal = await started;
    controller.abort();
    await pending;
    await vi.waitFor(() => expect(signal.aborted).toBe(true));
  });
});

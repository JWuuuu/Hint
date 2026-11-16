import express from "express";
import type { Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";

// Keep the router, budget guard and provider adapters real. Only durable lease
// storage and outbound provider transport are fixtures; no external I/O is used.
const storage = vi.hoisted(() => ({ take: vi.fn(), release: vi.fn(), log: vi.fn() }));
vi.mock("@workspace/db", () => ({
  pool: { query: () => { throw new Error("Unexpected database access"); } },
  db: {}, compatibilityInvitesTable: {}, deviceSessionsTable: {}, historyClearsTable: {},
}));
vi.mock("../lib/durableBudget", async original => ({
  ...await original<object>(), takeBudget: storage.take, releaseProviderLease: storage.release,
}));
vi.mock("../lib/logger", () => ({ logger: { error: storage.log } }));
vi.mock("../lib/openaiConfig.js", () => ({
  openaiApiKey: "", openaiModel: "unused",
  getOpenAIClient: () => { throw new Error("Unexpected OpenAI access"); },
}));
import router from "./astrology";
import { errorHandler } from "../lib/errorHandler";
import { providerSignal } from "../lib/providerCancellation";

const httpFetch = globalThis.fetch;
const providerFetch = vi.fn<typeof fetch>();
const active = new Set<string>();
const pendingSettlers = new Set<() => void>();
const clients = new Set<AbortController>();
const profile = {
  name: "HTTP workflow fixture", birthDate: "1995-05-15", birthTime: "10:20",
  birthPlace: "Chicago", latitude: 41.87, longitude: -87.62, timezoneOffset: -5,
};
let server: Server, origin: string, charges = 0;

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function providerFixture(input: string | URL | Request, init?: RequestInit) {
  const url = new URL(String(input));
  expect(url.origin).toBe("https://astrology.invalid");
  const payload = JSON.parse(String(init?.body)) as { day: number };
  expect(init?.signal).toBeInstanceOf(AbortSignal);
  return new Response(JSON.stringify(url.pathname.endsWith("/planets/tropical")
    ? [payload.day === 15
      ? { name: "Venus", sign: "Taurus", normDegree: 1 }
      : { name: "Moon", sign: "Virgo", normDegree: 3.4 }]
    : {}), { status: 200 });
}
function post(path: string, body: unknown, signal?: AbortSignal) {
  return httpFetch(origin + path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000),
  });
}
const released = () => vi.waitFor(() => expect(active.size).toBe(0));

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.deviceSession = { ownerId: "workflow-owner", id: "fixture", expiresAt: new Date(Date.now() + 60000) };
    next();
  });
  app.use("/api", router);
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  origin = "http://127.0.0.1:" + (server.address() as { port: number }).port;
});
beforeEach(() => {
  charges = 0; active.clear(); vi.clearAllMocks();
  vi.stubEnv("ASTROLOGYAPI_API_KEY", "synthetic-workflow-key");
  vi.stubEnv("ASTROLOGYAPI_USER_ID", "synthetic-workflow-user");
  vi.stubEnv("ASTROLOGYAPI_BASE_URL", "https://astrology.invalid/v1");
  storage.take.mockReset().mockImplementation(async () => {
    const lease = "workflow-" + ++charges; active.add(lease); return lease;
  });
  storage.release.mockReset().mockImplementation(async (lease: string) => { active.delete(lease); });
  providerFetch.mockReset().mockImplementation(async (input, init) => providerFixture(input, init));
  vi.stubGlobal("fetch", providerFetch);
});
afterEach(async () => {
  for (const controller of clients) controller.abort();
  clients.clear();
  for (const settle of pendingSettlers) settle();
  pendingSettlers.clear();
  await released();
  vi.unstubAllGlobals(); vi.unstubAllEnvs();
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

it("rejects invalid natal input inside the real budget wrapper without calling a provider", async () => {
  const response = await post("/api/astro/natal", { profile: { ...profile, birthDate: "2026-02-30" } });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "Invalid birth profile." });
  expect(providerFetch).not.toHaveBeenCalled();
  await released();
  // Validation intentionally follows admission in the current route contract.
  expect(storage.take).toHaveBeenCalledWith(expect.arrayContaining([
    { key: "astrology:minute:workflow-owner", limit: 15, windowMs: 60000 },
    { key: "astrology:day:workflow-owner", limit: 30, windowMs: 86400000 },
  ]), "workflow-owner");
  expect(storage.release).toHaveBeenCalledExactlyOnceWith("workflow-1");
});

it("returns a safe natal fallback after provider failure and performs an explicit successful retry", async () => {
  providerFetch.mockImplementationOnce(async () => new Response("private upstream failure marker", { status: 502 }));
  const body = { profile: { ...profile, id: "natal-failure-retry" } };
  const failed = await post("/api/astro/natal", body);
  expect(failed.status).toBe(200);
  const fallback = await failed.json();
  expect(fallback).toMatchObject({ source: "fallback", mode: "fallback", cached: false });
  expect(JSON.stringify(fallback)).not.toMatch(/private upstream failure marker|synthetic-workflow-key/);
  await released();
  expect(storage.release).toHaveBeenCalledExactlyOnceWith("workflow-1");

  const retry = await post("/api/astro/natal", body);
  expect(retry.status).toBe(200);
  expect(await retry.json()).toMatchObject({
    source: "astrologyapi", mode: "live", cached: false,
    chart: { placements: [{ body: "venus", sign: "taurus", degree: 1 }] },
  });
  await released();
  expect(providerFetch).toHaveBeenCalledTimes(3);
  expect(charges).toBe(2);
  expect(storage.release.mock.calls).toEqual([["workflow-1"], ["workflow-2"]]);
});

it("drains both synastry provider branches before releasing a disconnected HTTP request, then accepts retry", async () => {
  const started = deferred();
  const signals: AbortSignal[] = [];
  const settleBranches: (() => void)[] = [];
  let inFlight = 0;
  providerFetch.mockImplementation((input, init) => {
    expect(new URL(String(input)).origin).toBe("https://astrology.invalid");
    const signal = init?.signal as AbortSignal;
    expect(signal).toBeInstanceOf(AbortSignal);
    signals.push(signal); inFlight++;
    return new Promise<Response>((_resolve, reject) => {
      // Simulate a provider whose cancellation settles later than the socket.
      const settle = () => { pendingSettlers.delete(settle); inFlight--; reject(signal.reason); };
      settleBranches.push(settle); pendingSettlers.add(settle);
      if (signals.length === 2) started.resolve();
    });
  });
  const body = {
    userProfile: { ...profile, id: "disconnect-user", birthDate: "1996-05-15" },
    partnerProfile: { ...profile, id: "disconnect-partner", birthDate: "1997-04-18" },
  };
  const controller = new AbortController(); clients.add(controller);
  const request = post("/api/astro/synastry", body, controller.signal);
  const rejected = expect(request).rejects.toMatchObject({ name: "AbortError" });
  await started.promise;
  expect(inFlight).toBe(2); expect(active.size).toBe(1);
  controller.abort(); await rejected;
  await vi.waitFor(() => expect(signals.every(signal => signal.aborted)).toBe(true));
  expect(storage.release).not.toHaveBeenCalled();

  settleBranches[0]!();
  await vi.waitFor(() => expect(inFlight).toBe(1));
  expect(active.size).toBe(1); expect(storage.release).not.toHaveBeenCalled();
  settleBranches[1]!();
  await released();
  expect(inFlight).toBe(0);
  expect(storage.release).toHaveBeenCalledExactlyOnceWith("workflow-1");
  expect(providerSignal()).toBeUndefined();
  expect(providerFetch).toHaveBeenCalledTimes(2);

  providerFetch.mockImplementation(async (input, init) => providerFixture(input, init));
  const retry = await post("/api/astro/synastry", body);
  expect(retry.status).toBe(200);
  expect(await retry.json()).toMatchObject({
    source: "astrologyapi", mode: "live", cached: false,
    aspects: [{ from: "venus", to: "moon", type: "trine", fromOwner: "user", toOwner: "partner" }],
  });
  await released();
  expect(providerFetch).toHaveBeenCalledTimes(6);
  expect(storage.release.mock.calls).toEqual([["workflow-1"], ["workflow-2"]]);
  expect(storage.log).not.toHaveBeenCalled();
}, 10000);

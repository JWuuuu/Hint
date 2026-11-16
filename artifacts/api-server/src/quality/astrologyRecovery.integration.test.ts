import crypto from "node:crypto";
import express from "express";
import type { Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/openaiConfig.js", () => ({
  openaiApiKey: "", openaiModel: "unused",
  getOpenAIClient: () => { throw new Error("Unexpected OpenAI access"); },
}));

const enabled = process.env.HINT_ISOLATED_DB === "1";
const httpFetch = globalThis.fetch;
const providerFetch = vi.fn<typeof fetch>();
const clients = new Set<AbortController>();
const settlers = new Set<() => void>();
const profile = { name: "Recovery fixture", birthDate: "1995-05-15", birthTime: "10:20", birthPlace: "Chicago", latitude: 41.87, longitude: -87.62, timezoneOffset: -5 };
let database: typeof import("@workspace/db"), server: Server, origin: string, owner: string;
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
const leases = async () => (await database.pool.query("SELECT id FROM provider_leases WHERE owner_id=$1", [owner])).rows;
const charges = async () => Number((await database.pool.query("SELECT COALESCE(sum(used),0) AS count FROM request_budgets WHERE bucket_key=$1", [`astrology:day:${owner}`])).rows[0].count);
const released = () => vi.waitFor(async () => expect(await leases()).toHaveLength(0));
function post(path: string, body: unknown, signal?: AbortSignal) {
  return httpFetch(origin + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25_000)]) : AbortSignal.timeout(25_000) });
}
function delayedBranches() {
  const started = deferred<void>();
  const signals: AbortSignal[] = [], finish: (() => void)[] = [];
  providerFetch.mockImplementation((input, init) => {
    expect(new URL(String(input)).origin).toBe("https://astrology.invalid");
    const signal = init?.signal as AbortSignal;
    signals.push(signal);
    return new Promise<Response>((_resolve, reject) => {
      // Deliberately wait for the fixture to drain AFTER receiving cancellation.
      const settle = () => { if (!settlers.delete(settle)) return; reject(signal.reason); };
      settlers.add(settle); finish.push(settle);
      if (signals.length === 2) started.resolve();
    });
  });
  return { started: started.promise, signals, finish };
}

describe.skipIf(!enabled)("astrology recovery with real isolated durable leases", () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== "postgresql://hint_test:isolated-test-only@127.0.0.1:55439/hint_quality") throw new Error("Refusing non-isolated database");
    database = await import("@workspace/db");
    const { default: router } = await import("../routes/astrology");
    const { errorHandler } = await import("../lib/errorHandler");
    const app = express(); app.use(express.json());
    // Authentication is covered by deviceAccess; this fixture gives the real
    // router and durable guard a distinct synthetic authenticated owner.
    app.use((req, _res, next) => { req.deviceSession = { ownerId: owner, id: "fixture", expiresAt: new Date(Date.now() + 60_000) }; next(); });
    app.use(router); app.use(errorHandler);
    server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  beforeEach(() => {
    owner = crypto.randomUUID();
    vi.stubEnv("ASTROLOGYAPI_API_KEY", "synthetic-h14-key");
    vi.stubEnv("ASTROLOGYAPI_USER_ID", "synthetic-h14-user");
    vi.stubEnv("ASTROLOGYAPI_BASE_URL", "https://astrology.invalid/v1");
    vi.stubEnv("HINT_PROVIDER_MAX_CONCURRENT", "1");
    providerFetch.mockReset(); vi.stubGlobal("fetch", providerFetch);
  });
  afterEach(async () => {
    for (const client of clients) client.abort(); clients.clear();
    for (const settle of settlers) settle(); settlers.clear();
    await released(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  });
  afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await database?.pool.end(); });

  it("keeps nested timeout work leased through simultaneous disconnect and rejects replacement work until both branches drain", async () => {
    const branches = delayedBranches();
    const client = new AbortController(); clients.add(client);
    const request = post("/astro/synastry", { userProfile: { ...profile, id: `${owner}-a` }, partnerProfile: { ...profile, id: `${owner}-b`, birthDate: "1997-04-18" } }, client.signal);
    const rejected = expect(request).rejects.toMatchObject({ name: "AbortError" });
    await branches.started;
    await vi.waitFor(() => expect(branches.signals.every(signal => signal.aborted)).toBe(true), { timeout: 17_000, interval: 20 });
    expect(branches.signals.map(signal => signal.reason.name)).toEqual(["TimeoutError", "TimeoutError"]);
    expect(await leases()).toHaveLength(1); expect(await charges()).toBe(1);
    client.abort(); await rejected;
    const blocked = await post("/astro/geo-details", { place: `blocked-${owner}` });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ code: "PROVIDER_BUDGET_EXHAUSTED" });
    expect(providerFetch).toHaveBeenCalledTimes(2); expect(await charges()).toBe(1);
    branches.finish[0]!();
    await new Promise(resolve => setTimeout(resolve, 25));
    expect(await leases()).toHaveLength(1);
    branches.finish[1]!(); await released();
    expect(await charges()).toBe(1);
    providerFetch.mockResolvedValueOnce(new Response(JSON.stringify({ geonames: [{ name: "Fixture", latitude: 1, longitude: 2 }] })));
    expect((await post("/astro/geo-details", { place: `retry-${owner}` })).status).toBe(200);
    await released(); expect(await charges()).toBe(2); expect(providerFetch).toHaveBeenCalledTimes(3);
  }, 25_000);

  it("returns a connected caller's timeout fallback, then charges explicit retry and cache hit once each", async () => {
    const started = deferred<AbortSignal>();
    providerFetch.mockImplementationOnce((input, init) => {
      expect(new URL(String(input)).origin).toBe("https://astrology.invalid");
      const signal = init?.signal as AbortSignal;
      started.resolve(signal);
      return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
    });
    const body = { place: `connected-${owner}` };
    const request = post("/astro/geo-details", body);
    const signal = await started.promise;
    const response = await request;
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ source: "fallback", mode: "fallback", cached: false });
    expect(signal.reason.name).toBe("TimeoutError"); await released();
    expect(await charges()).toBe(1); expect(providerFetch).toHaveBeenCalledTimes(1);
    providerFetch.mockResolvedValueOnce(new Response(JSON.stringify({ geonames: [{ name: "Fixture", latitude: 1, longitude: 2 }] })));
    expect(await (await post("/astro/geo-details", body)).json()).toMatchObject({ source: "astrologyapi", mode: "live", cached: false });
    await released(); expect(await charges()).toBe(2);
    expect(await (await post("/astro/geo-details", body)).json()).toMatchObject({ source: "astrologyapi", mode: "live", cached: true });
    await released(); expect(await charges()).toBe(3); expect(providerFetch).toHaveBeenCalledTimes(2);
  }, 25_000);

  it("propagates client disconnection to both natal branches without releasing the durable lease early", async () => {
    const branches = delayedBranches(), client = new AbortController(); clients.add(client);
    const request = post("/astro/synastry", { userProfile: { ...profile, id: `${owner}-a` }, partnerProfile: { ...profile, id: `${owner}-b`, birthDate: "1997-04-18" } }, client.signal);
    const rejected = expect(request).rejects.toMatchObject({ name: "AbortError" });
    await branches.started; client.abort(); await rejected;
    await vi.waitFor(() => expect(branches.signals.every(signal => signal.aborted)).toBe(true));
    expect(branches.signals.map(signal => signal.reason.name)).toEqual(["AbortError", "AbortError"]);
    expect(await leases()).toHaveLength(1);
    branches.finish[0]!(); await new Promise(resolve => setTimeout(resolve, 25));
    expect(await leases()).toHaveLength(1);
    branches.finish[1]!(); await released();
    expect(await charges()).toBe(1); expect(providerFetch).toHaveBeenCalledTimes(2);
  });
});

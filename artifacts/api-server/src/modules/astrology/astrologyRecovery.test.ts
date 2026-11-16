import { createServer, type Server, type ServerResponse } from "node:http";
import { performance } from "node:perf_hooks";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { withProviderSignal } from "../../lib/providerCancellation";
import { calculateBirthChart } from "./astrologyApiClient";
import { getGeoDetailsProxy, getTimezoneProxy } from "./astroProxyService";

vi.mock("../../lib/openaiConfig.js", () => ({
  openaiApiKey: "", openaiModel: "unused",
  getOpenAIClient: () => { throw new Error("Unexpected OpenAI access"); },
}));

// Real fetch, headers and body sockets; only the upstream is a loopback fixture.
let server: Server, origin: string, calls = 0, serial = 0;
let respond: (response: ServerResponse, path: string) => void;
const openResponses = new Set<ServerResponse>();
const profile = { birthday: "1995-05-15", birthTime: "10:20", birthCity: "Chicago", latitude: 41.87, longitude: -87.62, timezone: -5 };
function json(response: ServerResponse, data: unknown) {
  response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify(data));
}
const geo = { geonames: [{ name: "Chicago", latitude: 41.87, longitude: -87.62, timezone: "America/Chicago" }] };
const zone = { timezoneId: "America/Chicago", timezoneOffset: -5 };
const waitUntil = async (condition: () => boolean) => {
  const end = performance.now() + 2000;
  while (!condition() && performance.now() < end) await new Promise(resolve => setTimeout(resolve, 10));
  expect(condition()).toBe(true);
};

beforeAll(async () => {
  server = createServer((req, res) => {
    calls++; openResponses.add(res); res.once("close", () => openResponses.delete(res));
    req.resume(); respond(res, req.url ?? "");
  });
  server.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
beforeEach(() => {
  calls = 0; serial++;
  vi.stubEnv("ASTROLOGYAPI_API_KEY", "synthetic-h14-key");
  vi.stubEnv("ASTROLOGYAPI_USER_ID", "synthetic-h14-user");
  vi.stubEnv("ASTROLOGYAPI_BASE_URL", origin);
  respond = (res, path) => json(res, path.endsWith("planets/tropical") ? [{ name: "Sun", sign: "Taurus", normDegree: 24.5 }] : {});
});
afterEach(async () => {
  vi.useRealTimers(); vi.unstubAllEnvs();
  for (const res of openResponses) res.destroy();
  await waitUntil(() => openResponses.size === 0);
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });

it.each([
  ["natal", "headers"], ["natal", "body"], ["geo", "headers"], ["geo", "body"],
] as const)("bounds connected %s stalled %s to 15 seconds including the actual socket", async (kind, stage) => {
  respond = res => { if (stage === "body") { res.writeHead(200, { "Content-Type": "application/json" }); res.write('{"unfinished":'); } };
  const controller = new AbortController();
  let settled = false, settledAt: number | undefined;
  const started = performance.now();
  const work = withProviderSignal(controller, async () => kind === "natal"
    ? calculateBirthChart({ ...profile, name: `deadline-${serial}` }, { force: true })
    : getGeoDetailsProxy(`deadline-${serial}`));
  void work.then(() => { settled = true; settledAt = performance.now(); }, () => { settled = true; settledAt = performance.now(); });
  await waitUntil(() => calls === 1);
  // A bounded test watchdog cleans up the old unbounded implementation too.
  await new Promise(resolve => setTimeout(resolve, 15_500));
  const bounded = settled;
  controller.abort();
  const result = await work;
  await waitUntil(() => openResponses.size === 0);
  console.info(JSON.stringify({ kind, stage, bounded, settledAfterMs: Math.round(settledAt! - started), calls, source: "source" in result ? result.source : null }));
  expect(bounded).toBe(true);
  expect(result).toMatchObject(kind === "natal" ? { source: "fallback" } : { source: "fallback", mode: "fallback", cached: false });
  expect(calls).toBe(1);
}, 20_000);

it.each(["natal", "geo"] as const)("cancels the real %s response body immediately on disconnect", async kind => {
  respond = res => { res.writeHead(200); res.write('{"unfinished":'); };
  const controller = new AbortController();
  const work = withProviderSignal(controller, async () => kind === "natal"
    ? calculateBirthChart({ ...profile, name: `cancel-${serial}` }, { force: true })
    : getGeoDetailsProxy(`cancel-${serial}`));
  await waitUntil(() => calls === 1);
  controller.abort(); await work;
  await waitUntil(() => openResponses.size === 0);
  expect(calls).toBe(1);
});

it.each(["geo", "timezone"] as const)("retries %s after a transient failure and retains its successful cache lifetime", async kind => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
  const read = () => kind === "geo" ? getGeoDetailsProxy(`recovery-${serial}`) : getTimezoneProxy(41.87, -87.62, `1995-05-${String(serial).padStart(2, "0")}`);
  respond = res => { res.writeHead(502); res.end("private upstream diagnostic"); };
  const failed = await read();
  expect(failed).toMatchObject({ source: "fallback", mode: "fallback", cached: false });
  expect(JSON.stringify(failed)).not.toMatch(/private upstream|synthetic-h14/);
  respond = res => json(res, kind === "geo" ? geo : zone);
  vi.setSystemTime(Date.now() + 60_000);
  const retry = await read();
  expect(retry).toMatchObject({ source: "astrologyapi", mode: "live", cached: false });
  expect(calls).toBe(2);
  const ttl = (kind === "geo" ? 1 : 30) * 86_400_000;
  vi.setSystemTime(Date.now() + ttl - 1);
  expect(await read()).toMatchObject({ ...retry, cached: true });
  expect(calls).toBe(2);
  vi.setSystemTime(Date.now() + 1);
  expect(await read()).toMatchObject({ source: "astrologyapi", mode: "live", cached: false });
  expect(calls).toBe(3);
});

it("does not mark locally inferred timezone values as a cacheable live provider success", async () => {
  respond = res => json(res, {});
  expect(await getTimezoneProxy(41.8781, -87.6298, "2001-01-01")).toMatchObject({ source: "fallback", mode: "fallback", cached: false, timezoneId: null, timezoneOffset: null });
  respond = res => json(res, zone);
  expect(await getTimezoneProxy(41.8781, -87.6298, "2001-01-01")).toMatchObject({ source: "astrologyapi", mode: "live", cached: false, ...zone });
  expect(calls).toBe(2);
});

it("keeps successful natal data and its cache without multiplying provider calls", async () => {
  const input = { ...profile, name: `success-${serial}` };
  const chart = await calculateBirthChart(input);
  expect(chart).toMatchObject({ source: "api", placements: [{ body: "sun", sign: "taurus", degree: 24.5 }] });
  expect(await calculateBirthChart(input)).toEqual(chart);
  expect(calls).toBe(2);
});

it.each(["natal", "geo"] as const)("closes an unread %s non-success body before returning fallback", async kind => {
  respond = res => { res.writeHead(502); res.write("private unfinished error body"); };
  const result = await withProviderSignal(new AbortController(), async () => kind === "natal"
    ? calculateBirthChart({ ...profile, name: `error-body-${serial}` }, { force: true })
    : getGeoDetailsProxy(`error-body-${serial}`));
  expect(result).toMatchObject({ source: "fallback" });
  expect(JSON.stringify(result)).not.toContain("private unfinished");
  await waitUntil(() => openResponses.size === 0);
  expect(calls).toBe(1);
});

it("retries empty geo results while keeping local suggestions explicitly fallback", async () => {
  respond = res => json(res, { geonames: [] });
  expect(await getGeoDetailsProxy("Chicago")).toMatchObject({ source: "fallback", mode: "fallback", cached: false, results: [{ name: "Chicago" }] });
  respond = res => json(res, geo);
  expect(await getGeoDetailsProxy("Chicago")).toMatchObject({ source: "astrologyapi", mode: "live", cached: false });
  expect(calls).toBe(2);
});

it.each([
  [{ timezoneOffset: 0 }, { timezoneId: null, timezoneOffset: 0 }],
  [{ timezoneId: "America/Chicago" }, { timezoneId: "America/Chicago", timezoneOffset: -5 }],
] as const)("preserves usable provider timezone fields without adding a nearby city's identity: %j", async (payload, expected) => {
  respond = res => json(res, payload);
  const date = `2000-07-${String(serial).padStart(2, "0")}`;
  const result = await getTimezoneProxy(41.87, -87.62, date);
  expect(result).toMatchObject({ source: "astrologyapi", mode: "live", cached: false, ...expected });
  expect(await getTimezoneProxy(41.87, -87.62, date)).toMatchObject({ ...result, cached: true });
  expect(calls).toBe(1);
});

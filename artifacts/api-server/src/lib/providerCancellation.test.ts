import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { providerSignal, withProviderSignal } from "./providerCancellation";
const ai = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("./openaiConfig", () => ({
  openaiApiKey: "test-only", openaiModel: "test", getOpenAIClient: () => ({ chat: { completions: { create: ai.create } } }),
}));
import { calculateBirthChart } from "../modules/astrology/astrologyApiClient";
import { getGeoDetailsProxy, getNasaApodProxy, getAstroInterpretationProxy } from "../modules/astrology/astroProxyService";

beforeEach(() => {
  vi.stubEnv("ASTROLOGYAPI_API_KEY", "ak-test-fixture"); vi.stubEnv("ASTROLOGYAPI_USER_ID", "test-fixture");
  vi.stubEnv("NASA_API_KEY", "test-fixture"); ai.create.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each(["birth chart", "location", "NASA"])("passes request cancellation through the real %s provider adapter", async kind => {
  const controller = new AbortController();
  let started!: () => void, inFlight = 0;
  const began = new Promise<void>(resolve => { started = resolve; });
  const signals: AbortSignal[] = [];
  vi.stubGlobal("fetch", vi.fn((_url, options: RequestInit) => {
    const signal = options.signal!; expect(signal).toBeInstanceOf(AbortSignal);
    signal.throwIfAborted();
    signals.push(signal); inFlight++;
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => { inFlight--; reject(signal.reason); }, { once: true }); started();
    });
  }));
  const work = withProviderSignal(controller, async () => {
    if (kind === "birth chart") return calculateBirthChart({
      name: "cancellation-fixture", birthday: "1995-05-15", birthTime: "10:20", birthCity: "Chicago",
      latitude: 41.87, longitude: -87.62, timezone: -5,
    }, { force: true });
    if (kind === "location") return getGeoDetailsProxy("T11 cancellation location");
    return getNasaApodProxy("2026-10-30");
  });
  // Both existing adapter fallbacks and thrown failures must settle after abort.
  const settled = Promise.allSettled([work]);
  await began; controller.abort(); await settled;
  expect(signals.length).toBeGreaterThan(0); expect(signals.every(signal => signal.aborted)).toBe(true);
  expect(inFlight).toBe(0); expect(providerSignal()).toBeUndefined();
});

it("passes cancellation through astrology's OpenAI interpretation adapter", async () => {
  const controller = new AbortController();
  let started!: (signal: AbortSignal) => void;
  const began = new Promise<AbortSignal>(resolve => { started = resolve; });
  ai.create.mockImplementation((_input, { signal }: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true }); started(signal);
  }));
  const work = withProviderSignal(controller, () => getAstroInterpretationProxy({ kind: "transit", data: { test: "cancel" } }));
  const signal = await began; expect(signal).toBe(controller.signal);
  controller.abort(); await work; expect(signal.aborted).toBe(true);
});

it("retains the provider timeout as well as request cancellation", async () => {
  const controller = new AbortController();
  await withProviderSignal(controller, async () => {
    const signal = providerSignal(1)!;
    await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
    expect(signal.reason.name).toBe("TimeoutError"); expect(controller.signal.aborted).toBe(false);
  });
});

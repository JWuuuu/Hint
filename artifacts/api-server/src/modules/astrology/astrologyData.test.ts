import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateBirthChart } from "./astrologyApiClient";
import { getNatalProxy, getSynastryProxy, getTransitsProxy } from "./astroProxyService";

beforeEach(() => {
  vi.stubEnv("ASTROLOGYAPI_API_KEY", "ak-test-fixture");
  vi.stubEnv("ASTROLOGYAPI_USER_ID", "test-fixture");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const input = { birthday: "1995-05-15", birthTime: "10:20", birthCity: "Chicago", latitude: 41.87, longitude: -87.62, timezone: -5 };
const profile = { birthDate: "1995-05-15", birthTime: "10:20", birthPlace: "Chicago", latitude: 41.87, longitude: -87.62, timezoneOffset: -5 };

describe("calculated astrology data", () => {
  it("does not substitute angular separation for a missing natal orb", async () => {
    vi.stubGlobal("fetch", vi.fn(async url => new Response(JSON.stringify(String(url).endsWith("planets/tropical")
      ? [{name:"Sun",sign:"Aries",normDegree:1}]
      : {aspects:[{from:"Sun",to:"Moon",type:"Trine",diff:118.52}]}), {status:200})));
    const chart=await calculateBirthChart({...input,name:"missing-orb"},{force:true});
    expect(chart.aspects?.[0].orb).toBeUndefined();
  });

  it("does not fill a partial provider response with invented planets, houses, or aspects", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => new Response(JSON.stringify(String(url).endsWith("planets/tropical") ? [{ name: "Sun", sign: "Taurus", normDegree: 24.5 }] : {}), { status: 200 })));
    const chart = await calculateBirthChart(input, { force: true });
    expect(chart.source).toBe("api");
    expect(chart.placements.map((p) => p.body)).toEqual(["sun"]);
    expect(chart.houses).toEqual([]);
    expect(chart.aspects).toEqual([]);
    expect(chart.moonPhase).toBeUndefined();
    expect(chart.calculation).toEqual({ zodiacSystem: "tropical", requestedHouseSystem: "placidus", houseSystem: null, returned: { placements: 1, houses: 0, aspects: 0 } });
  });
  it("retains actual house cusps without assuming they supply an Ascendant", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => new Response(JSON.stringify(String(url).endsWith("planets/tropical") ? [{ name: "Sun", sign: "Taurus", normDegree: 24.5 }] : { houses: [{ house: 1, sign: "Libra", normDegree: 17.2 }] }), { status: 200 })));
    const chart = await calculateBirthChart(input, { force: true });
    expect(chart.risingSign).toBeUndefined();
    expect(chart.houses).toEqual([{ house: 1, sign: "libra", degree: 17.2 }]);
  });
  it("preserves the returned asteroid, chart point and angle parameters separately from the planets", async () => {
    const fetchMock = vi.fn(async url => new Response(JSON.stringify(String(url).endsWith("planets/tropical")
      ? [
        { name: "Sun", sign: "Aquarius", normDegree: 21.83 },
        { name: "Ketu", sign: "Sagittarius", normDegree: 5, isRetro: true },
        { name: "Black Moon Lilith", sign: "Taurus", normDegree: 0.5 },
      ]
      : { houses: [
        { house_id: 3, planets: [{ name: "Node", sign: "Gemini", full_degree: 65.2, is_retro: "true" }] },
        { house_id: 8, planets: [{ name: "Juno", sign: "Scorpio", full_degree: 228.75 }] },
        { house_id: 10, asteroids: [{ name: "Chiron", sign: "Capricorn", full_degree: 284.5 }] },
      ],
      asteroids: [
        { name: "Pallas Athena", sign: "Pisces", norm_degree: 7.5 },
        { name: "Ceres", sign: "Aries", norm_degree: 19, house: 1 },
        { name: "Vesta", sign: "Libra", norm_degree: 12, house: 7 },
      ],
      points: [{ name: "Part of Fortune", sign: "Cancer", norm_degree: 13 }, { name: "East Point", sign: "Pisces", norm_degree: 26 }],
      angles: [{ name: "IC", sign: "Gemini", norm_degree: 27.5 }, { name: "DSC", sign: "Virgo", norm_degree: 25.5 }],
      midheaven: 267.5,
      vertex: 178.5,
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await getNatalProxy({ ...profile, birthDate: "1998-02-11", id: "additional-points-fixture" });
    expect(response.chart.placements.map(p => p.body)).toEqual(["sun"]);
    expect(response.chart).toMatchObject({ additionalPlacements: [
      { body: "north_node", sign: "gemini", degree: expect.closeTo(5.2), house: 3, retrograde: true },
      { body: "juno", sign: "scorpio", degree: 18.75, house: 8 },
      { body: "chiron", sign: "capricorn", degree: 14.5, house: 10 },
      { body: "pallas", sign: "pisces", degree: 7.5 },
      { body: "ceres", sign: "aries", degree: 19, house: 1 },
      { body: "vesta", sign: "libra", degree: 12, house: 7 },
      { body: "fortune", sign: "cancer", degree: 13 },
      { body: "east_point", sign: "pisces", degree: 26 },
      { body: "imum_coeli", sign: "gemini", degree: 27.5 },
      { body: "descendant", sign: "virgo", degree: 25.5 },
      { body: "midheaven", sign: "sagittarius", degree: 27.5 },
      { body: "vertex", sign: "virgo", degree: 28.5 },
      { body: "south_node", sign: "sagittarius", degree: 5, retrograde: true },
      { body: "lilith", sign: "taurus", degree: 0.5 },
    ] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each([undefined, "whole_sign"])("does not label a %s house-one cusp as an explicitly calculated Ascendant", async houseSystem => {
    vi.stubGlobal("fetch", vi.fn(async url => new Response(JSON.stringify(String(url).endsWith("planets/tropical")
      ? [{ name: "Sun", sign: "Taurus", normDegree: 24.5 }]
      : { house_system: houseSystem, houses: [{ house: 1, sign: "Taurus", normDegree: 0 }] }), { status: 200 })));
    const chart = await calculateBirthChart(input, { force: true });
    expect(chart.houses).toEqual([{ house: 1, sign: "taurus", degree: 0 }]);
    expect(chart.placements.find(p => p.body === "rising")).toBeUndefined();
    expect(chart.risingSign).toBeUndefined();
  });
  it("retains an explicit provider Ascendant independently of whole-sign house cusps", async () => {
    vi.stubGlobal("fetch", vi.fn(async url => new Response(JSON.stringify(String(url).endsWith("planets/tropical")
      ? [{ name: "Sun", sign: "Taurus", normDegree: 24.5 }, { name: "Ascendant", sign: "Taurus", normDegree: 17.2 }]
      : { house_system: "whole_sign", houses: [{ house: 1, sign: "Taurus", normDegree: 0 }] }), { status: 200 })));
    const chart = await calculateBirthChart(input, { force: true });
    expect(chart.placements.find(p => p.body === "rising")).toMatchObject({ sign: "taurus", degree: 17.2 });
  });
  it("exposes provider-confirmed house metadata without treating the requested setting as confirmation", async () => {
    vi.stubEnv("HOUSE_SYSTEM", "equal");
    vi.stubGlobal("fetch", vi.fn(async url => new Response(JSON.stringify(String(url).endsWith("planets/tropical")
      ? [{ name: "Sun", sign: "Taurus", normDegree: 24.5 }]
      : { house_system: "Placidus", houses: [{ house: 1, sign: "Libra", normDegree: 17.2 }], aspects: [{ from: "Sun", to: "Ascendant", type: "Square", orb: 2 }] }), { status: 200 })));
    const response = await getNatalProxy({ ...profile, id: "metadata-fixture" });
    expect(response).toMatchObject({ source: "astrologyapi", mode: "live", calculation: {
      zodiacSystem: "tropical", requestedHouseSystem: "equal", houseSystem: "Placidus", returned: { placements: 1, houses: 1, aspects: 1 },
    } });
    expect(response.fetchedAt).toEqual(expect.any(String));
  });
  it("keeps an empty live transit result empty and uses its real calculation date", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ transit_date: "09-09-2026", transit_relation: [] }), { status: 200 })));
    const result = await getTransitsProxy(profile, "2026-09-20", "daily");
    expect(result.mode).toBe("live");
    expect(result.date).toBe("09-09-2026");
    expect(result.transits).toEqual([]);
    expect(result.strongestTransit).toBeUndefined();
  });
  it("does not invent exact dates or zero-degree orbs when the provider omitted them", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ transit_date: "09-09-2026", transit_relation: [{ transit_planet: "Venus", natal_planet: "Moon", aspect_type: "Trine" }] }), { status: 200 })));
    const result = await getTransitsProxy(profile, "2026-09-21", "daily");
    expect(result.transits[0]).toMatchObject({ title: "Venus trine Moon", evidence: [] });
    expect(result.transits[0].orb).toBeUndefined();
    expect(result.transits[0].peakDate).toBeUndefined();
  });
  it("returns unavailable without sample guidance on provider failure and allows retry", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(new Response(JSON.stringify({ transit_date: "09-09-2026", transit_relation: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const result = await getTransitsProxy(profile, "2026-09-22", "daily");
    expect(result.mode).toBe("fallback");
    expect(result.transits).toEqual([]);
    const retry = await getTransitsProxy(profile, "2026-09-22", "daily");
    expect(retry.mode).toBe("live");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("retries a failed synastry calculation and caches only its successful real result", async () => {
    let online = false;
    const fetch = vi.fn(async (url, init) => {
      if (!online) throw new Error("Temporary provider outage");
      const data = JSON.parse(String(init?.body));
      return new Response(JSON.stringify(String(url).endsWith("planets/tropical")
        ? [data.day === 15 ? {name:"Venus",sign:"Taurus",normDegree:1} : {name:"Moon",sign:"Virgo",normDegree:3.4}]
        : {}), {status:200});
    });
    vi.stubGlobal("fetch", fetch);
    const creator = { ...profile, id: "synastry-retry-creator" };
    const partner = { ...profile, id: "synastry-retry-partner", birthDate: "1997-04-18" };
    expect(await getSynastryProxy(creator, partner)).toMatchObject({ mode: "fallback", aspects: [] });
    online = true;
    const retry = await getSynastryProxy(creator, partner);
    expect(retry).toMatchObject({ schemaVersion:2, source: "astrologyapi", mode: "live", cached: false, aspects: [{ from: "venus", to: "moon", type: "trine", fromOwner:"user", toOwner:"partner" }] });
    expect(retry.aspects[0].orb).toBeCloseTo(2.4, 8);
    const calls=fetch.mock.calls.length;
    expect(await getSynastryProxy(creator, partner)).toMatchObject({ ...retry, cached: true });
    expect(fetch).toHaveBeenCalledTimes(calls);
    expect(fetch.mock.calls.every(([url]) => !String(url).includes("synastry_horoscope"))).toBe(true);
  });
});

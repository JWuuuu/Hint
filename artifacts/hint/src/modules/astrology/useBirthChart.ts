import { useMemo, useRef, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBirthProfileConflict } from "../../lib/astro/userBirthProfile";
import { getNatalChart } from "../../lib/astro/astroClient";
import { normalizeClientNatal } from "../../lib/astro/normalizeClientAstro";
import { profileToBirthInput, toLegacyCalculatedChart, verifiedBirthProfile, type ChartProfileDetails } from "../../lib/astro/verifiedBirthChart";
import { captureIdentityContext, getAnonId } from "../../lib/identity";
import { historyClearVersion } from "../../lib/clearHistory";
import { chartContext, natalCacheKey, readChart, storeChart } from "./chartState";
import type { BirthProfileInput, NormalizedBirthChart } from "./types";
export { profileToBirthInput } from "../../lib/astro/verifiedBirthChart";
export function birthChartCacheKey(input: BirthProfileInput) { return JSON.stringify(input); }
export function isCalculatedChart(chart: NormalizedBirthChart, input: BirthProfileInput): boolean {
  return chart.provider === "astrologyapi" && chart.source === "api" && !chart.approximate &&
    birthChartCacheKey(chart.input) === birthChartCacheKey(input);
}
function subscribeContext(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("hint:identity-changed", listener);
  window.addEventListener("pageshow", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("hint:identity-changed", listener);
    window.removeEventListener("pageshow", listener);
  };
}
function cacheRecord(owner: string) {
  try { return localStorage.getItem(natalCacheKey(owner)); } catch { return null; }
}

export function useBirthChart(anonId: string, details: ChartProfileDetails) {
  const external = useSyncExternalStore(subscribeContext, () => `${getAnonId()}:${historyClearVersion(anonId)}`, () => "");
  const storedRecord = useSyncExternalStore(subscribeContext, () => cacheRecord(anonId), () => null);
  const clearVersion = historyClearVersion(anonId);
  const currentOwner = getAnonId() === anonId;
  const conflict = getBirthProfileConflict();
  const birthInput = !currentOwner || conflict ? null : profileToBirthInput(anonId, details);
  const profile = birthInput ? verifiedBirthProfile(anonId, details) : null;
  const context = `${profile ? chartContext(anonId, profile) : `${anonId}:incomplete`}:${external}`;
  const currentContext = useRef(context); currentContext.current = context;
  const cached = useMemo(() => profile ? readChart(anonId, profile) : null, [context, storedRecord]);
  const query = useQuery({
    queryKey: ["verified-birth-chart", anonId, context],
    // Clearing history does not silently recreate the chart; a deliberate retry may.
    enabled: Boolean(profile && (!clearVersion || cached)),
    retry: false, staleTime: Infinity, networkMode: "always",
    initialData: cached ? { chart: cached, stored: true, cacheRecord: storedRecord } : undefined,
    queryFn: async ({ signal }) => {
      if (!profile) throw new Error("A complete birth profile is required.");
      const identity = captureIdentityContext();
      if (identity.owner !== anonId) throw new DOMException("Local profile changed", "AbortError");
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener("abort", abort, { once: true });
      identity.signal.addEventListener("abort", abort, { once: true });
      const assertCurrent = () => {
        identity.assertCurrent(); signal.throwIfAborted(); controller.signal.throwIfAborted();
        if (currentContext.current !== context || historyClearVersion(anonId) !== clearVersion) throw new DOMException("Chart context changed", "AbortError");
      };
      try {
        assertCurrent();
        const response = await getNatalChart(profile, controller.signal);
        assertCurrent();
        const chart = normalizeClientNatal(profile, response);
        if (!chart?.placements.length) throw new Error("A calculated personal chart is not available. Your birth details are preserved.");
        const stored = storeChart(anonId, profile, response, clearVersion);
        assertCurrent();
        return { chart, stored, cacheRecord: cacheRecord(anonId) };
      } finally {
        signal.removeEventListener("abort", abort); identity.signal.removeEventListener("abort", abort);
      }
    },
  });
  // A recalculation in My Chart may update shared storage while this query remains
  // cached. Prefer that new record, but retain a newer unsaved in-memory response.
  const displayed = cached && query.data?.cacheRecord !== storedRecord ? cached : query.data?.chart ?? cached;
  const locallyStored = displayed === cached || Boolean(query.data?.stored && query.data.cacheRecord === storedRecord && cached);
  const chart = birthInput && profile && displayed ? toLegacyCalculatedChart(displayed, birthInput) : null;
  return { birthInput, chart, isLoading: query.isFetching,
    storageStatus: chart ? locallyStored ? "local" as const : "memory" as const : "unsaved" as const,
    error: query.error instanceof Error ? query.error.message : null,
    recalculate: async () => {
      if (!profile || !birthInput) return null;
      // A user-requested refresh bypasses the local cache; normal mounts never do.
      const result = await query.refetch();
      return result.data && currentContext.current === context ? toLegacyCalculatedChart(result.data.chart, birthInput) : null;
    },
  };
}

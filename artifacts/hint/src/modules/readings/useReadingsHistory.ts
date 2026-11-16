import { useEffect, useSyncExternalStore } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { combineRequestSignals, getListReadingsQueryKey, listReadings } from "@workspace/api-client-react";
import { captureIdentityContext } from "../../lib/identity";
import { historyClearVersion } from "../../lib/clearHistory";

export const HISTORY_READ_TIMEOUT_MS = 10_000;

/** A saved-record read has its own budget; generation keeps the shared backstop. */
export async function readHistory(owner: string, caller?: AbortSignal) {
  const identity = captureIdentityContext();
  if (identity.owner !== owner) throw new DOMException("Local profile changed", "AbortError");
  const version = historyClearVersion(owner);
  const deadline = new AbortController();
  const { signal, dispose } = combineRequestSignals(caller, identity.signal, deadline.signal);
  const checkClear = () => {
    if (historyClearVersion(owner) !== version) deadline.abort(new DOMException("History was cleared", "AbortError"));
  };
  const timer = setTimeout(() => deadline.abort(new DOMException("History request timed out", "TimeoutError")), HISTORY_READ_TIMEOUT_MS);
  window.addEventListener("storage", checkClear);
  let onAbort: () => void = () => undefined;
  try {
    signal!.throwIfAborted(); identity.assertCurrent();
    const cancelled = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(signal!.reason ?? new DOMException("Request cancelled", "AbortError"));
      signal!.addEventListener("abort", onAbort, { once: true });
    });
    // Also settle if an enrollment/transport implementation ignores cancellation.
    const rows = await Promise.race([listReadings({ anonId: owner }, { signal }), cancelled]);
    checkClear(); signal!.throwIfAborted(); identity.assertCurrent();
    return rows;
  } finally {
    clearTimeout(timer); window.removeEventListener("storage", checkClear);
    signal!.removeEventListener("abort", onAbort); dispose();
  }
}

const knownVersions = new WeakMap<QueryClient, Map<string, string>>();
const subscribeClear = (listener: () => void) => {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
};

export function useReadingsHistory(owner: string) {
  const client = useQueryClient();
  const version = useSyncExternalStore(subscribeClear, () => historyClearVersion(owner), () => "");
  const versions = knownVersions.get(client) ?? new Map<string, string>();
  if (!knownVersions.has(client)) knownVersions.set(client, versions);
  if (!versions.has(owner)) versions.set(owner, version);
  const cleared = versions.get(owner) !== version;
  const queryKey = getListReadingsQueryKey({ anonId: owner });
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => readHistory(owner, signal),
    retry: false,
  });
  useEffect(() => {
    if (!cleared) return;
    versions.set(owner, version);
    // A clear in another tab must not leave an older cached list visible or
    // allow its cancelled request to restore pre-clear rows.
    void client.cancelQueries({ queryKey, exact: true });
    client.setQueryData(queryKey, []);
  }, [client, owner, version, cleared]);
  return { ...query, data: cleared ? undefined : query.data, isPending: cleared || query.isPending };
}

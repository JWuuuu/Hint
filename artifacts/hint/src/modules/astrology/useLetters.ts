import { historyClearVersion } from "@/lib/clearHistory";
import { useEffect, useState } from "react";
import { listLetters, LETTERS_CHANGED } from "./reportStore";
import type { CelestialLetter } from "./reportModel";
export function useLetters(owner: string) {
  const [state, setState] = useState<{
    owner: string;
    version: string;
    rows: CelestialLetter[];
    loading: boolean;
    error: boolean;
  }>({
    owner,
    version: historyClearVersion(owner),
    rows: [],
    loading: true,
    error: false,
  });
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let active = true,
      request = 0;
    const load = () => {
      const generation = ++request,
        version = historyClearVersion(owner);
      setState((s) => ({
        owner,
        version,
        rows: s.owner === owner && s.version === version ? s.rows : [],
        loading: true,
        error: false,
      }));
      listLetters(owner)
        .then((rows) => {
          if (active && generation === request)
            setState({ owner, version, rows, loading: false, error: false });
        })
        .catch(() => {
          if (active && generation === request)
            setState((s) => ({ ...s, loading: false, error: true }));
        });
    };
    load();
    window.addEventListener(LETTERS_CHANGED, load);
    window.addEventListener("storage", load);
    return () => {
      active = false;
      window.removeEventListener(LETTERS_CHANGED, load);
      window.removeEventListener("storage", load);
    };
  }, [owner, attempt]);
  return {
    ...(state.owner === owner
      ? state
      : {
          owner,
          version: historyClearVersion(owner),
          rows: [],
          loading: true,
          error: false,
        }),
    retry: () => retry((a) => a + 1),
  };
}

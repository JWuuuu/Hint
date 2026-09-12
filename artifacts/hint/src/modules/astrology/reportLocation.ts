import type { ReportEvidence } from "./reportModel";
export function readReportSelection(): ReportEvidence | null {
  const params = new URLSearchParams(window.location.search);
  const kind = (["body", "house", "aspect"] as const).find((k) =>
    params.has(k),
  );
  return kind
    ? {
        kind,
        id: params.get(kind)!,
        ...(params.has("person")
          ? {
              person:
                params.get("person") === "partner"
                  ? ("partner" as const)
                  : ("user" as const),
            }
          : {}),
      }
    : null;
}
export function writeReportSelection(selection: ReportEvidence | null) {
  const url = new URL(window.location.href);
  ["body", "house", "aspect", "person"].forEach((k) =>
    url.searchParams.delete(k),
  );
  if (selection) {
    url.searchParams.set(selection.kind, selection.id);
    if (selection.person) url.searchParams.set("person", selection.person);
  }
  window.history.replaceState(
    window.history.state,
    "",
    url.pathname + url.search,
  );
}

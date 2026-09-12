import { useRef, useState } from "react";
import { listLocalProfiles, switchLocalProfile } from "../../lib/identity";
import { useLanguage } from "../../lib/i18n";
import { localProfileDestination } from "../../lib/localProfileDestination";

export function LocalProfileSwitcher() {
  const { t } = useLanguage();
  const [error, setError] = useState(false);
  const [switching, setSwitching] = useState(false);
  const inFlight = useRef(false);
  const profiles = listLocalProfiles();
  async function select(id?: string) {
    if (inFlight.current) return;
    inFlight.current = true; setSwitching(true); setError(false);
    try {
      await switchLocalProfile(id);
      // Hooks capture the local owner. Reload only after successful selection.
      window.location.assign(localProfileDestination(import.meta.env.BASE_URL, window.location));
    } catch { setError(true); }
    finally { inFlight.current = false; setSwitching(false); }
  }
  return <details className="rounded-2xl border p-3" style={{ borderColor: "var(--hint-border)", color: "var(--hint-text)", background: "var(--hint-surface-soft)" }}>
    <summary className="min-h-11 cursor-pointer py-3 text-sm">{t("quality.localProfiles")}</summary>
    <p className="mb-2 text-xs leading-relaxed">{t("quality.localProfilesHint")}</p>
    {profiles.filter(profile => !profile.current).map((profile, index) => <button key={profile.id} type="button" disabled={switching} className="block min-h-11 w-full break-words py-2 text-left text-sm" onClick={() => void select(profile.id)}>{t("quality.restoreProfile").replace("{name}", profile.label || t("quality.unnamedProfile").replace("{number}", String(index + 1)))}</button>)}
    <button type="button" disabled={switching} className="min-h-11 w-full py-2 text-left text-sm underline" onClick={() => void select()}>{t("quality.newLocalProfile")}</button>
    {error && <p role="alert" className="mt-2 text-sm">{t("quality.accountSaveFailed")}</p>}
  </details>;
}

import { apiFetch, apiUrl } from "./api";
import { captureIdentityContext, getLocalDateString } from "./identity";
import { withIdentityLock } from "./identityLock";

const scopedArrays = ["hint_local_daily_readings", "hint_local_tarot_readings_v1", "hint_local_question_history_v1", "hint_local_collection_unlocks_v1"];
const ownerDraft = (owner: string) => `hint_text_draft_v1:${encodeURIComponent(owner)}:`;
const markerKey = (owner: string) => `hint_history_cleared_v1:${owner}`;
export function historyClearVersion(owner: string): string {
  try { return localStorage.getItem(`hint_history_clear_version_v1:${owner}`) ?? ""; } catch { return ""; }
}
export function wasDailyHistoryCleared(owner: string, dateKey: string): boolean {
  try { const day = localStorage.getItem(markerKey(owner)); return Boolean(day && dateKey <= day); }
  catch { return false; }
}
/** Run only after the server commits. Never erase identity, profile, preferences or draw locks. */
export function clearLocalHistory(owner: string): void {
  const identity = captureIdentityContext();
  if (identity.owner !== owner) throw new DOMException("Local profile changed", "AbortError");
  identity.assertCurrent();
  // Mark first so interrupted cleanup cannot resurrect an already deleted daily reading.
  localStorage.setItem(markerKey(owner), getLocalDateString());
  localStorage.setItem(`hint_history_clear_version_v1:${owner}`, crypto.randomUUID());
  const legacyQuizOwner = localStorage.getItem("hint_personality_legacy_owner_v3");
  for (const key of scopedArrays) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    const rows: Array<{ anonId?: string }> = JSON.parse(raw);
    if (Array.isArray(rows)) localStorage.setItem(key, JSON.stringify(rows.filter(row => row.anonId !== owner)));
  }
  for (const storage of [localStorage, sessionStorage]) {
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => Boolean(key));
    for (const key of keys) {
      let ownedLegacyNatal = false;
      if (key.startsWith("hint.astrology.savedNatalChart.v2:")) {
        try {
          const record = JSON.parse(storage.getItem(key) || "null");
          ownedLegacyNatal = record?.profileId === owner && record?.chart?.birthProfile?.id === owner;
        } catch { /* Unclaimed or malformed legacy data must not be guessed or erased. */ }
      }
      if (key.startsWith(ownerDraft(owner)) || key === `hint_journal_draft_v1:${owner}` ||
        key === `hint_astrology_natal_v3:${owner}` || ownedLegacyNatal ||
        key === `hint_active_tarot_reading_v2:${owner}` ||
        key === `hint_personality_progress_v3:${encodeURIComponent(owner)}` ||
        key === `hint_personality_results_v1:${encodeURIComponent(owner)}` ||
        key === `hint_ask_history_v1:${encodeURIComponent(owner)}` || key === `hint_ask_active_v1:${encodeURIComponent(owner)}` ||
        key.startsWith(`hint_compatibility_result_v2:${encodeURIComponent(owner)}:`) ||
        key === "hint_active_tarot_reading_v1" || key.startsWith("hint_compatibility_result_v1_") ||
        ((!legacyQuizOwner || legacyQuizOwner === owner) && (key === "hint.personalities.result.v2" || key === "hint.personalities.answers.v2"))) storage.removeItem(key);
    }
  }
  window.dispatchEvent(new Event("storage"));
}
export async function deleteHistory(owner: string): Promise<void> {
  const identity = captureIdentityContext();
  if (identity.owner !== owner) throw new DOMException("Local profile changed", "AbortError");
  const response = await apiFetch(apiUrl(`/api/history?anonId=${encodeURIComponent(owner)}&throughDay=${getLocalDateString()}`), { method: "DELETE" });
  identity.assertCurrent();
  if (!response.ok) throw new Error(`History deletion failed (${response.status})`);
  await withIdentityLock(async () => {
    identity.assertCurrent(); clearLocalHistory(owner);
    const { clearLetters } = await import("@/modules/astrology/reportStore");
    await clearLetters(owner);
  });
}

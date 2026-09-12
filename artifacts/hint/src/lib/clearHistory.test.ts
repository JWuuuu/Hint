// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("@/modules/astrology/reportStore", () => ({ clearLetters: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./api", () => ({ apiUrl: (path: string) => path, apiFetch: (...args: Parameters<typeof fetch>) => fetch(...args) }));
vi.mock("./identity", () => ({
  getLocalDateString: () => "2026-09-10",
  captureIdentityContext: () => {
    const owner = localStorage.getItem("hint_anon_id");
    const generation = localStorage.getItem("hint_identity_generation_v1");
    return { owner, assertCurrent: () => {
      if (owner !== localStorage.getItem("hint_anon_id") || generation !== localStorage.getItem("hint_identity_generation_v1")) throw new DOMException("Changed", "AbortError");
    } };
  },
}));
vi.mock("./identityLock", () => ({ withIdentityLock: async (work: () => void) => work() }));
import { clearLocalHistory, deleteHistory, wasDailyHistoryCleared } from "./clearHistory";
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("hint_anon_id", "a"); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("a server failure never deletes any local records", async () => {
  localStorage.setItem("hint_local_daily_readings", '[{"anonId":"a"}]');
  const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 503 });
  vi.stubGlobal("fetch", fetcher);
  await expect(deleteHistory("a")).rejects.toThrow("503");
  expect(fetcher).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/history\?anonId=a&throughDay=\d{4}-\d{2}-\d{2}$/), { method: "DELETE" });
  expect(localStorage.getItem("hint_local_daily_readings")).toBe('[{"anonId":"a"}]');
});
it("clears only owned history, retaining profile, preferences and reveal locks", () => {
  const preserved = ["hint-language", "hint.birthProfile", "hint_local_auth_v1", "hint-theme", "hint_daily_receipt_fallbacks_v1"];
  for (const key of preserved) localStorage.setItem(key, "keep");
  localStorage.setItem("hint_local_daily_readings", JSON.stringify([{ anonId: "a" }, { anonId: "b" }]));
  localStorage.setItem("hint_text_draft_v1:a:daily:2026-09-09", "remove");
  localStorage.setItem("hint_text_draft_v1:b:ask:", "keep");
  sessionStorage.setItem("hint_active_tarot_reading_v1", "remove");
  clearLocalHistory("a");
  for (const key of preserved) expect(localStorage.getItem(key)).toBe("keep");
  expect(localStorage.getItem("hint_anon_id")).toBe("a");
  expect(JSON.parse(localStorage.getItem("hint_local_daily_readings")!)).toEqual([{ anonId: "b" }]);
  expect(localStorage.getItem("hint_text_draft_v1:a:daily:2026-09-09")).toBeNull();
  expect(localStorage.getItem("hint_text_draft_v1:b:ask:")).toBe("keep");
  expect(sessionStorage.getItem("hint_active_tarot_reading_v1")).toBeNull();
  expect(wasDailyHistoryCleared("a", "2000-01-01")).toBe(true);
  expect(wasDailyHistoryCleared("a", "2999-01-01")).toBe(false);
});
it("clears owned conversations, quiz state and compatibility caches while preserving other profiles", () => {
  const owned = ["hint_ask_history_v1:a", "hint_ask_active_v1:a", "hint_personality_progress_v3:a", "hint_personality_results_v1:a", "hint_compatibility_result_v2:a:result", "hint_active_tarot_reading_v2:a"];
  const retained = ["hint_ask_history_v1:b", "hint_personality_progress_v3:b", "hint_personality_results_v1:b", "hint_compatibility_result_v2:b:result", "hint_local_profile_index_v1", "hint_device_session_v1:a", "hint_active_tarot_reading_v2:b"];
  for (const key of [...owned, ...retained]) localStorage.setItem(key, "fixture");
  clearLocalHistory("a");
  for (const key of owned) expect(localStorage.getItem(key)).toBeNull();
  for (const key of retained) expect(localStorage.getItem(key)).toBe("fixture");
});
it("does not delete another namespace's not-yet-migrated legacy quiz", () => {
  localStorage.setItem("hint_personality_legacy_owner_v3", "a");
  localStorage.setItem("hint.personalities.answers.v2", '["think"]');
  localStorage.setItem("hint_anon_id", "b");
  clearLocalHistory("b"); expect(localStorage.getItem("hint.personalities.answers.v2")).toBe('["think"]');
  localStorage.setItem("hint_anon_id", "a");
  clearLocalHistory("a"); expect(localStorage.getItem("hint.personalities.answers.v2")).toBeNull();
});

it("deletes owned natal caches and only provably owned legacy imports after the server commits", async () => {
  const owned = ["hint_astrology_natal_v3:a", "hint.astrology.savedNatalChart.v2:a@example.test"];
  const retained = ["hint_astrology_natal_v3:b", "hint.astrology.savedNatalChart.v2:b@example.test", "hint.astrology.savedNatalChart.v2:unclaimed", "hint_birth_profile_v3:a", "hint_daily_receipt_fallbacks_v1"];
  localStorage.setItem(owned[0], "natal-a");
  localStorage.setItem(owned[1], JSON.stringify({ profileId: "a", chart: { birthProfile: { id: "a" } } }));
  for (const key of retained) localStorage.setItem(key, "keep");
  const before = localStorage.getItem(owned[1]);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  await expect(deleteHistory("a")).rejects.toThrow();
  expect(localStorage.getItem(owned[0])).toBe("natal-a");
  expect(localStorage.getItem(owned[1])).toBe(before);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  await deleteHistory("a");
  for (const key of owned) expect(localStorage.getItem(key)).toBeNull();
  for (const key of retained) expect(localStorage.getItem(key)).toBe("keep");
});

it("does not erase the next owner's shared recovery slot when deletion finishes late", async () => {
  let complete!: (response: { ok: boolean }) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { complete = resolve; })));
  const deleting = deleteHistory("a");
  const rejected = expect(deleting).rejects.toMatchObject({ name: "AbortError" });
  localStorage.setItem("hint_anon_id", "b");
  sessionStorage.setItem("hint_active_tarot_reading_v1", "B recovery");
  complete({ ok: true }); await rejected;
  expect(sessionStorage.getItem("hint_active_tarot_reading_v1")).toBe("B recovery");
  expect(localStorage.getItem("hint_history_clear_version_v1:a")).toBeNull();
});

it("rejects stale generations even when the selected owner returns to the same ID", async () => {
  let complete!: (response: { ok: boolean }) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { complete = resolve; })));
  const deleting = deleteHistory("a");
  const rejected = expect(deleting).rejects.toMatchObject({ name: "AbortError" });
  localStorage.setItem("hint_identity_generation_v1", "after-switch-away-and-back");
  complete({ ok: true }); await rejected;
  expect(localStorage.getItem("hint_history_clear_version_v1:a")).toBeNull();
});

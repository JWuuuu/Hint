import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, RefreshCw } from "lucide-react";
import { ACCENT, GLASS } from "../hold/atmosphere";
import { AppScreen, ScreenHeader, GlassPanel, SectionLabel } from "../../components/app/AppChrome";
import { JournalSigil } from "../home/data/sigils";
import {
  useListJournalEntries,
  useCreateJournalEntry,
  getListJournalEntriesQueryKey,
  type JournalEntry,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getAnonId } from "../../lib/identity";
import { useLanguage } from "../../lib/i18n";
import { historyClearVersion } from "../../lib/clearHistory";
import { clearSavedJournalDraft, EMPTY_JOURNAL_DRAFT, readJournalDraftRecord, writeJournalDraftRecord, type JournalDraft } from "./journalDraft";
import { markRoomVisitStarted, roomVisitWasClosed } from "../../components/app/roomVisits";
import { useRoomVisit } from "../../components/app/RoomVisitBoundary";
import { roomResumeText } from "../../components/app/roomResumeCopy";
import "./journal.css";

const MOODS = ["tender", "lighter", "heavy", "still", "hopeful"] as const;

function formatDate(iso: string, language: string, todayLabel: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  if (date.toDateString() === new Date().toDateString()) return todayLabel;
  return date.toLocaleDateString(language, {
    month: "short", day: "numeric",
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" as const } : {}),
  });
}

export function JournalView() {
  const anonId = getAnonId();
  const queryClient = useQueryClient();
  const queryKey = getListJournalEntriesQueryKey({ anonId });
  const { data, isLoading, isError, isFetching, refetch } = useListJournalEntries({ anonId }, { query: { queryKey, retry: false } });
  const [entry] = useState(() => ({ fresh: roomVisitWasClosed("journal"), record: readJournalDraftRecord(anonId) }));
  const [draft, setDraft] = useState(() => entry.fresh ? { ...EMPTY_JOURNAL_DRAFT } : entry.record.draft);
  const draftRevision = useRef(entry.fresh ? null : entry.record.revision);
  const [recoverableDraft, setRecoverableDraft] = useState<JournalDraft | null>(entry.fresh ? entry.record.draft : null);
  const [draftStored, setDraftStored] = useState(true);
  const [saved, setSaved] = useState(false);
  const saving = useRef(false);
  const saveGeneration = useRef(0);
  const { t, language } = useLanguage();
  const { title, body, mood } = draft;
  const hasDraft = Boolean(title || body || mood);

  const createMutation = useCreateJournalEntry({ mutation: { retry: false } });
  useRoomVisit({ room: "journal", hasProgress: hasDraft || createMutation.isPending, onLeave: () => { saveGeneration.current++; saving.current = false; } });
  useEffect(() => {
    let clearVersion = historyClearVersion(anonId);
    const stored = readJournalDraftRecord(anonId);
    const fresh = roomVisitWasClosed("journal");
    setDraft(fresh ? { ...EMPTY_JOURNAL_DRAFT } : stored.draft);
    draftRevision.current = fresh ? null : stored.revision;
    setRecoverableDraft(fresh ? stored.draft : null);
    setSaved(false);
    setDraftStored(true);
    saving.current = false;
    createMutation.reset();
    const syncClear = () => {
      const nextVersion = historyClearVersion(anonId);
      if (nextVersion === clearVersion) return;
      clearVersion = nextVersion;
      saveGeneration.current++;
      saving.current = false;
      const stored = readJournalDraftRecord(anonId);
      setDraft(stored.draft); draftRevision.current = stored.revision; setRecoverableDraft(null);
      setSaved(false);
      setDraftStored(true);
      createMutation.reset();
    };
    window.addEventListener("storage", syncClear);
    return () => { saveGeneration.current++; window.removeEventListener("storage", syncClear); };
  }, [anonId, createMutation.reset]);

  function updateDraft(patch: Partial<JournalDraft>) {
    const next = { ...draft, ...patch };
    markRoomVisitStarted("journal"); setRecoverableDraft(null);
    setDraft(next);
    const result = writeJournalDraftRecord(anonId, next);
    draftRevision.current = result.revision;
    setDraftStored(result.saved);
    setSaved(false);
    createMutation.reset();
  }

  async function handleSave() {
    if (!body.trim() || body.length > 8000 || title.length > 200 || saving.current) return;
    saving.current = true;
    setSaved(false);
    const submitted = { ...draft };
    const submittedRevision = draftRevision.current;
    const generation = ++saveGeneration.current;
    const clearVersion = historyClearVersion(anonId);
    const current = () => generation === saveGeneration.current && getAnonId() === anonId && historyClearVersion(anonId) === clearVersion;
    try {
      const entry = await createMutation.mutateAsync({ data: {
        anonId, title: title.trim() || undefined, body: body.trim(), mood: mood ?? undefined, editedAt: new Date().toISOString(),
      } });
      // Navigation does not undo a confirmed server save. Remove only its exact
      // draft, even after unmount, so returning cannot accidentally submit it twice.
      const draftCleared = historyClearVersion(anonId) === clearVersion ? clearSavedJournalDraft(anonId, submitted, submittedRevision) : true;
      if (!current()) return;
      // A late success must not put cleared history or another identity's entry
      // back into the cache. Recheck after cancellation's asynchronous boundary.
      await queryClient.cancelQueries({ queryKey });
      if (!current()) return;
      queryClient.setQueryData<JournalEntry[]>(queryKey, (previous = []) => [entry, ...previous.filter((item) => item.id !== entry.id)]);
      void queryClient.invalidateQueries({ queryKey });
      setDraftStored(draftCleared);
      setDraft({ ...EMPTY_JOURNAL_DRAFT });
      draftRevision.current = null;
      setSaved(true);
    } catch {
      // Keep the full draft for a deliberate retry; the mutation exposes the error.
    } finally {
      if (generation === saveGeneration.current) saving.current = false;
    }
  }

  const entries = data ?? [];
  return (
    <AppScreen>
      <div className="hint-journal">
        <ScreenHeader
          eyebrow={t("journal.eyebrow")}
          title={t("journal.title")}
          subtitle={t("journal.subtitle")}
          sigil={JournalSigil}
          backHref="/app/rooms"
          backLabel={t("nav.rooms")}
        />
        {recoverableDraft && Boolean(recoverableDraft.title || recoverableDraft.body || recoverableDraft.mood) && <div className="journal-notice mb-4">
          <p>{roomResumeText(language, "draftReady")}</p>
          <button type="button" className="min-h-11 py-2 text-left underline" onClick={() => {
            const stored = readJournalDraftRecord(anonId);
            const restored = writeJournalDraftRecord(anonId, stored.draft);
            markRoomVisitStarted("journal"); setDraft(stored.draft); draftRevision.current = restored.revision;
            setRecoverableDraft(null); setDraftStored(restored.saved); setSaved(false);
          }}>{roomResumeText(language, "restoreDraft")}</button>
        </div>}
        <GlassPanel hero className="mb-6">
          <form onSubmit={(event) => { event.preventDefault(); void handleSave(); }} aria-label={t("journal.title")}>
            <div className="journal-prompt">
              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: ACCENT.aqua }}>
                {t("journal.promptLabel")}
              </p>
              <p className="mt-2 font-serif text-[20px] leading-snug" style={{ color: GLASS.text }}>
                {t("journal.prompt")}
              </p>
            </div>
            <fieldset disabled={createMutation.isPending} className="min-w-0 border-0 p-0">
              <label htmlFor="journal-title" className="journal-label">{t("journal.titleLabel")}</label>
              <input
                id="journal-title" type="text" value={title} maxLength={200}
                onChange={(event) => updateDraft({ title: event.target.value })}
                placeholder={t("journal.titlePlaceholder")}
                className="journal-input mb-4" data-testid="input-journal-title"
              />
              <label htmlFor="journal-body" className="journal-label">{t("journal.bodyLabel")}</label>
              <textarea
                id="journal-body" value={body} maxLength={8000}
                onChange={(event) => updateDraft({ body: event.target.value })}
                placeholder={t("journal.bodyPlaceholder")}
                aria-describedby="journal-count"
                className="journal-input journal-body" data-testid="input-journal-body"
              />
              <p id="journal-count" className="mt-1 text-right font-sans text-[11px] tabular-nums" style={{ color: GLASS.muted }}>
                {body.length.toLocaleString(language)} / {(8000).toLocaleString(language)}
              </p>
              <fieldset className="mt-3 min-w-0 border-0 p-0">
                <legend className="journal-label">{t("journal.moodLabel")}</legend>
                <div className="flex flex-wrap gap-2">
                  {MOODS.map((id) => (
                    <button key={id} type="button" aria-pressed={mood === id}
                      onClick={() => updateDraft({ mood: mood === id ? null : id })}
                      className="journal-mood" data-testid={`mood-${id}`}>
                      {t(`journal.mood.${id}`)}
                    </button>
                  ))}
                </div>
              </fieldset>
              <button type="submit" disabled={!body.trim() || body.length > 8000 || title.length > 200 || createMutation.isPending}
                className="journal-save" data-testid="button-save-journal">
                {createMutation.isPending ? t("profile.keeping") : t("journal.keep")}
              </button>
            </fieldset>
            <div className="mt-3 font-sans text-[12px] leading-relaxed" aria-live="polite" role="status">
              {saved ? <p className="flex items-center justify-center gap-2" style={{ color: ACCENT.aqua }}><Check size={15} aria-hidden />{t("journal.saved")}</p> : null}
              {hasDraft && draftStored ? <p style={{ color: GLASS.muted }}>{t("journal.draftSaved")}</p> : null}
              {!draftStored ? <p style={{ color: GLASS.text }}>{t("journal.draftUnavailable")}</p> : null}
            </div>
            {createMutation.isError ? <p role="alert" className="journal-notice mt-3">{t("journal.saveError")}</p> : null}
          </form>
        </GlassPanel>

        <section className="mb-6" aria-label={t("journal.past")}>
          <SectionLabel>{t("journal.past")}</SectionLabel>
          {isError ? (
            <div className="journal-notice mb-3" role="alert">
              <p>{t("journal.loadError")}</p>
              <button type="button" onClick={() => void refetch()} disabled={isFetching} className="journal-retry">
                <RefreshCw size={14} aria-hidden />{isFetching ? t("journal.loading") : t("journal.retry")}
              </button>
            </div>
          ) : null}
          {isLoading ? (
            <p role="status" className="py-6 text-center font-sans text-[13px]" style={{ color: GLASS.muted }}>{t("journal.loading")}</p>
          ) : entries.length === 0 && !isError ? (
            <GlassPanel>
              <BookOpen size={24} className="mx-auto mb-3" style={{ color: ACCENT.aqua }} aria-hidden />
              <p className="text-center font-sans text-[13px] leading-relaxed" style={{ color: GLASS.muted }}>{t("journal.empty")}</p>
            </GlassPanel>
          ) : (
            <div className="flex flex-col gap-3">
              {entries.map((entry) => (
                <article key={entry.id} className="journal-entry">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <time dateTime={entry.createdAt} className="font-sans text-[11px]" style={{ color: GLASS.muted }}>
                      {formatDate(entry.createdAt, language, t("readings.today"))}
                    </time>
                    {entry.mood ? <span className="journal-mood-tag">{MOODS.some((id) => id === entry.mood) ? t(`journal.mood.${entry.mood}`) : entry.mood}</span> : null}
                  </div>
                  <h2 className="mb-2 break-words font-serif text-[22px] leading-tight" style={{ color: GLASS.text }}>{entry.title || t("journal.untitled")}</h2>
                  <p className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed [overflow-wrap:anywhere]" style={{ color: GLASS.muted }}>{entry.body}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppScreen>
  );
}

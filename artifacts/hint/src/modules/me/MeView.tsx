import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { Profile } from "@workspace/api-client-react";
import { AppScreen, SpaceNavigation } from "../../components/app/AppChrome";
import { useProfile } from "../../lib/useProfile";
import { ProfileForm } from "../../components/app/ProfileForm";
import { ProfileCard, type SkySigns } from "./components/ProfileCard";
import { SettingsList } from "./components/SettingsList";
import { StoragePanel } from "./components/StoragePanel";
import { useLanguage } from "../../lib/i18n";
import { useMotionPolicy } from "../../lib/motionPolicy";
import { ME_COPY } from "./meCopy";
import { PracticeLedger, type KeptLetter } from "./components/PracticeLedger";
import type { PracticeEntry } from "./utils";
import { getAnonId } from "../../lib/identity";
import { verifiedBirthProfile } from "../../lib/astro/verifiedBirthChart";
import { readChart } from "../astrology/chartState";
import { listLocalTarotReadings, subscribeToLocalTarotReadings } from "../readings/localTarotReadings";
import { listLocalDailyReadings, subscribeToLocalDailyReadings } from "../readings/localDailyReadings";
import { readPersonalityResults } from "../features/personalityProgress";
import "./me.css";

type Practice = { entries: PracticeEntry[]; latest: KeptLetter | null; personality: string | null };
type View = "home" | "edit" | "storage";

function attempt<T>(read: () => T, fallback: T): T {
  try { return read(); } catch { return fallback; }
}

const newest = <T extends { createdAt: string }>(items: T[]): T | null =>
  items.reduce<T | null>((best, item) => !best || Date.parse(item.createdAt) > Date.parse(best.createdAt) ? item : best, null);

/** Everything the page summarises, read from this device's saved history. */
function readPractice(): Practice {
  const owner = getAnonId();
  const tarot = attempt(() => listLocalTarotReadings(owner), []);
  const daily = attempt(() => listLocalDailyReadings(owner), []);
  const entries = [
    ...tarot.map(({ id, createdAt }) => ({ id, createdAt })),
    ...daily.map(({ id, createdAt }) => ({ id: `daily:${id}`, createdAt })),
  ];
  const letters: KeptLetter[] = [
    ...tarot.map(reading => ({
      kind: "tarot" as const, createdAt: reading.createdAt, question: reading.question, spreadLabel: reading.spreadLabel,
      cards: reading.cards.map(card => ({ cardId: card.cardId, name: card.name, reversed: card.orientation === "reversed" })),
    })),
    ...daily.map(reading => ({
      kind: "daily" as const, createdAt: reading.createdAt,
      cards: [{ cardId: reading.cardId, name: reading.cardName, reversed: false }],
    })),
  ].filter(letter => Number.isFinite(Date.parse(letter.createdAt)));
  const personality = attempt(() => readPersonalityResults(owner).at(-1)?.result ?? null, null);
  return { entries, latest: newest(letters), personality };
}

/** Sun, Moon and Rising only from a chart the app already calculated and cached. */
function readSigns(profile: Profile | null): SkySigns | null {
  if (!profile?.birthDate) return null;
  const owner = getAnonId();
  const birth = verifiedBirthProfile(owner, {
    name: profile.name, birthDate: profile.birthDate, birthTime: profile.birthTime, birthPlace: profile.birthPlace,
    latitude: profile.latitude ?? undefined, longitude: profile.longitude ?? undefined,
    timezone: profile.timezone ?? undefined, timezoneOffset: profile.timezoneOffset ?? undefined,
  });
  const chart = birth ? readChart(owner, birth) : null;
  return chart?.sunSign ? { sun: chart.sunSign, moon: chart.moonSign, rising: chart.risingSign } : null;
}

/**
 * A personal page: the envelope (who you are), what you have kept, then the
 * everyday choices. Device plumbing lives one step away.
 */
export function MeView() {
  const { profile, saveProfile, isSaving, storageStatus } = useProfile();
  const [view, setView] = useState<View>("home");
  const { language, t } = useLanguage();
  const copy = ME_COPY[language];
  const { reduced, pageVisible } = useMotionPolicy();
  const container = useRef<HTMLDivElement>(null);
  const previousView = useRef<View>("home");
  const editSession = useRef(0);
  const editRevision = useRef(0);
  const [practice, setPractice] = useState(readPractice);
  const signs = useMemo(() => attempt(() => readSigns(profile), null), [profile, practice]);

  useEffect(() => {
    const sync = () => setPractice(readPractice());
    const stopTarot = subscribeToLocalTarotReadings(sync);
    const stopDaily = subscribeToLocalDailyReadings(sync);
    window.addEventListener("storage", sync);
    return () => { stopTarot(); stopDaily(); window.removeEventListener("storage", sync); };
  }, []);

  useEffect(() => {
    const root = container.current;
    if (view !== "home") {
      root?.querySelector<HTMLElement>(view === "edit" ? "#me-edit-heading" : "#me-storage-heading")?.focus();
      root?.closest(".hint-app-scroll")?.scrollTo?.({ top: 0, behavior: "instant" });
    } else if (previousView.current !== "home") {
      const target = previousView.current === "edit" ? '[data-testid="button-edit-profile"]' : '[data-testid="button-open-storage"]';
      root?.querySelector<HTMLElement>(target)?.focus();
    }
    previousView.current = view;
  }, [view]);

  function beginEditing() {
    editSession.current += 1;
    editRevision.current = 0;
    setView("edit");
  }

  function finishEditing() {
    editSession.current += 1;
    setView("home");
  }

  async function handleSave(input: Parameters<typeof saveProfile>[0]) {
    const session = editSession.current;
    const revision = editRevision.current;
    await saveProfile(input);
    // The saved version must not dismiss a reopened editor or newer unsaved text.
    if (session === editSession.current && revision === editRevision.current) finishEditing();
  }

  return <AppScreen>
    <div ref={container} className="me-page" data-reduced-motion={reduced} data-motion-paused={!pageVisible}>
      {view === "edit" ? <section className="me-edit-page" aria-labelledby="me-edit-heading">
        <button type="button" onClick={finishEditing} className="me-back"><ArrowLeft size={17} aria-hidden="true" />{copy.back}</button>
        <header className="me-heading"><p className="me-kicker">{copy.localProfile}</p><h1 id="me-edit-heading" tabIndex={-1}>{t("me.editProfile")}</h1><p>{copy.editIntro}</p></header>
        <div className="me-surface me-form" onChangeCapture={() => { editRevision.current += 1; }}><ProfileForm initial={profile} submitLabel={t("me.saveChanges")} onSubmit={handleSave} isSaving={isSaving} onCancel={finishEditing} /></div>
      </section> : view === "storage" ? <StoragePanel onBack={() => setView("home")} /> : <>
        <SpaceNavigation />
        <header className="me-heading"><h1>{copy.title}</h1></header>
        <ProfileCard profile={profile} onEdit={beginEditing} signs={signs} />
        <PracticeLedger entries={practice.entries} latest={practice.latest} personality={practice.personality} />
        <div id="me-settings" className="scroll-mt-6"><SettingsList onOpenStorage={() => setView("storage")} storageStatus={storageStatus} /></div>
        <footer className="me-footer"><span aria-hidden="true">✧</span><p>{copy.footer}</p></footer>
      </>}
    </div>
  </AppScreen>;
}

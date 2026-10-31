import { SavedLetters } from "../astrology/components/CelestialReports";
import { rt } from "../astrology/reportCopy";
import "../astrology/components/astrology-guide.css";
import "./readings.css";
import { LocalizedText, translateText } from "../../lib/LocalizedText";
import { DAILY_TAROT_DECK, getDailyPullById } from "../home/data/dailyPulls";
import { listAskHistory, subscribeToAskHistory } from "../ask/askHistory";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ArrowUpRight, BookOpen, CalendarDays, HelpCircle, MessageCircle, Orbit, Sparkles } from "lucide-react";
import { AppScreen, ScreenHeader } from "../../components/app/AppChrome";
import { useListReadings } from "@workspace/api-client-react";
import type { ReadingSummary } from "@workspace/api-client-react";
import { getAnonId } from "../../lib/identity";
import { useLanguage, type HintLanguage } from "../../lib/i18n";
import {
  getLocalDailyReading,
  listLocalDailyReadings,
  subscribeToLocalDailyReadings,
} from "./localDailyReadings";
import {
  listLocalQuestionHistory,
  subscribeToLocalQuestionHistory,
  type QuestionHistoryItem,
} from "./localQuestionHistory";
import {
  getLocalTarotReading,
  listLocalTarotReadings,
  subscribeToLocalTarotReadings,
  type LocalTarotReading,
} from "./localTarotReadings";
import {
  getTarotRoomStarClassName,
  getTarotRoomSurfaceBackground,
} from "../tarot/logic/roomVisuals";
import type { SpreadType } from "../hold/chat/types";
import { getTarotCardImage } from "../tarot/logic/cardImageMap";
import { readBirthProfile } from "../../lib/astro/userBirthProfile";
import type { BirthProfile } from "../../types/astrology";
import { HISTORY_COPY, HISTORY_LOCALES } from "./historyCopy";

/**
 * ReadingsView — the room's memory. A real archive of every reading the user
 * has sat with, newest first, scoped to their anonymous id.
 *
 * Layout: a single count ledger, one filter row, then dated archive entries.
 * Each entry carries a date stamp, a type cue and the original saved words.
 */

type HistoryTab = "all" | "tarot" | "daily" | "astrology" | "questions";
type EntryKind = "tarot" | "daily" | "question" | "ask";

function isToday(date: Date) {
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

/** A calendar stamp: day number over short month, or the localized "Today". */
function DateStamp({ iso, todayLabel, language }: { iso: string; todayLabel: string; language: HintLanguage }) {
  const date = new Date(iso);
  const valid = !Number.isNaN(date.getTime());
  const locale = HISTORY_LOCALES[language];
  return (
    <time className="hr-stamp" dateTime={valid ? date.toISOString() : undefined} data-today={valid && isToday(date) ? "true" : undefined}>
      {!valid ? null : isToday(date) ? <span className="hr-stamp-today">{todayLabel}</span> : <>
        <span className="hr-stamp-day">{new Intl.DateTimeFormat(locale, { day: "numeric" }).format(date)}</span>
        <span className="hr-stamp-month">{new Intl.DateTimeFormat(locale, { month: "short" }).format(date)}</span>
      </>}
    </time>
  );
}

const KIND_ICONS: Record<EntryKind, typeof BookOpen> = { tarot: Sparkles, daily: CalendarDays, question: HelpCircle, ask: MessageCircle };

function readingKind(reading: ReadingSummary): EntryKind {
  return reading.spreadType === "daily-pull" ? "daily" : "tarot";
}

function displayReading(reading: ReadingSummary, language: HintLanguage) {
  const storedId = (reading as ReadingSummary & { cardId?: string }).cardId;
  const cardId = storedId ?? DAILY_TAROT_DECK.find(card => card.name === reading.cardName)?.id;
  const cardName = cardId ? getDailyPullById(cardId, language).cardName : translateText(reading.cardName, language);
  // Preserve the original saved reading; changing locale must not rewrite its meaning.
  return { cardName, whisper: reading.whisper };
}

function KindCue({ kind, label }: { kind: EntryKind; label: ReactNode }) {
  const Icon = KIND_ICONS[kind];
  return <span className="hr-kind" data-kind={kind}><Icon size={12} strokeWidth={1.7} aria-hidden="true" />{label}</span>;
}

function ReadingCard({
  reading,
  language,
  todayLabel,
  featured = false,
}: {
  reading: ReadingSummary;
  language: HintLanguage;
  todayLabel: string;
  featured?: boolean;
}) {
  const { t } = useLanguage();
  const displayed = displayReading(reading, language);
  const kind = readingKind(reading);
  const spread = SPREAD_LABELS[reading.spreadType as SpreadType] ?? (reading.spreadType === "daily-pull" ? "Daily" : reading.spreadType);

  return (
    <Link href={`/app/readings/${reading.id}`} className="hr-entry" data-kind={kind} data-featured={featured ? "true" : undefined}>
      <DateStamp iso={reading.createdAt} todayLabel={todayLabel} language={language} />
      <span className="hr-entry-body">
        <span className="hr-entry-meta">
          <KindCue kind={kind} label={t(kind === "daily" ? "readings.tab.daily" : "readings.tab.tarot")} />
          {kind === "tarot" && <span className="hr-entry-spread"><LocalizedText text={spread} /></span>}
        </span>
        <span className="hr-entry-title">{displayed.cardName}</span>
        {reading.question && <span className="hr-entry-question"><LocalizedText text={reading.question} /></span>}
        {displayed.whisper && <span className="hr-entry-text">{displayed.whisper}</span>}
        {language !== "en" && displayed.whisper && <span className="hr-entry-note">{t("quality.originalText")}</span>}
      </span>
      <ArrowUpRight size={16} className="hr-entry-arrow" aria-hidden="true" />
    </Link>
  );
}

function tarotToSummary(reading: LocalTarotReading): ReadingSummary {
  return {
    id: reading.id,
    cardName: reading.spreadLabel,
    whisper: reading.shortAnswer,
    spreadType: reading.spreadType,
    question: reading.question,
    territory: reading.focusLabel ?? "tarot",
    createdAt: reading.createdAt,
  };
}

function questionFromTarotReading(reading: LocalTarotReading): QuestionHistoryItem | null {
  const question = reading.question?.trim();
  if (!question) return null;
  return {
    id: `reading-question-${reading.id}`,
    anonId: reading.anonId,
    question,
    focus: reading.focusLabel ?? reading.spreadLabel,
    spreadType: reading.spreadType as SpreadType,
    readingId: reading.id,
    createdAt: reading.createdAt,
  };
}

function mergeQuestionHistory(
  stored: QuestionHistoryItem[],
  tarotReadings: LocalTarotReading[],
): QuestionHistoryItem[] {
  const byKey = new Map<string, QuestionHistoryItem>();
  for (const item of stored) {
    byKey.set(item.readingId ?? item.id, item);
  }
  for (const reading of tarotReadings) {
    const item = questionFromTarotReading(reading);
    if (!item) continue;
    byKey.set(item.readingId ?? item.id, item);
  }
  return [...byKey.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function displayQuestionMeaning(reading: LocalTarotReading): string {
  const question = reading.question?.trim();
  if (!question) return reading.questionMeaning;
  return reading.questionMeaning
    .replace(`For "${question}", `, "For this question, ")
    .replace(`For “${question}”, `, "For this question, ");
}

const SPREAD_LABELS: Record<SpreadType, string> = {
  single: "One card",
  three: "Three cards",
  relationship: "Connection",
  futureLover: "Future Lover",
  peachBlossom: "Peach Blossom",
  reconciliation: "Reconciliation",
  trueHeart: "True Heart",
  loveTree: "Love Tree",
  xRelationship: "X Relationship",
};

function QuestionCard({
  item,
  todayLabel,
}: {
  item: QuestionHistoryItem;
  todayLabel: string;
}) {
  const { language, t } = useLanguage();
  return (
    <article className="hr-entry hr-entry-question-card" data-kind="question">
      <DateStamp iso={item.createdAt} todayLabel={todayLabel} language={language} />
      <div className="hr-entry-body">
        <span className="hr-entry-meta">
          <KindCue kind="question" label={t("readings.tab.questions")} />
          <span className="hr-entry-spread"><LocalizedText text={SPREAD_LABELS[item.spreadType] ?? item.spreadType} /></span>
        </span>
        <p className="hr-entry-title">{item.question}</p>
        <p className="hr-entry-text"><LocalizedText text={item.focus} /></p>
        <Link href={`/app/readings/${item.readingId ?? item.id}`} className="hr-open-link">{HISTORY_COPY[language].openReading}</Link>
      </div>
    </article>
  );
}

function EmptyPanel({ children }: { children: ReactNode }) {
  return <div className="hr-empty"><span aria-hidden="true">✧</span><p>{children}</p></div>;
}

function HistoryLedger({
  readingCount,
  dailyCount,
  questionCount,
}: {
  readingCount: number;
  dailyCount: number;
  questionCount: number;
}) {
  const { language } = useLanguage();
  const copy = HISTORY_COPY[language];
  const stats = [
    { id: "readings", icon: BookOpen, value: readingCount, label: copy.readings },
    { id: "daily", icon: CalendarDays, value: dailyCount, label: copy.daily },
    { id: "questions", icon: HelpCircle, value: questionCount, label: copy.questions },
  ];
  return (
    <dl className="hr-ledger">
      {stats.map(({ id, icon: Icon, value, label }) => <div key={id} data-stat={id}>
        <dt><Icon size={13} strokeWidth={1.6} aria-hidden="true" />{label}</dt>
        <dd>{value}</dd>
      </div>)}
    </dl>
  );
}

function buildAstrologyArchive(profile: BirthProfile | null, language: HintLanguage) {
  return [
    {
      id: "birth",
      title: profile ? "Birth profile saved" : "Birth profile",
      label: profile ? `${profile.birthDate} · ${profile.birthPlace}` : "Add birth details",
      body: profile
        ? "Review the birth details saved on this device before calculating a personal chart."
        : "Add birth date, time, and place once, then reuse it across Astrology.",
      href: "/app/astrology?tab=birth",
    },
    {
      id: "chart",
      title: "Chart graph",
      label: "Natal wheel",
      body: "Open your calculated birth chart, or complete the birth details needed to create it.",
      href: "/app/astrology?tab=chart",
    },
    {
      id: "transits",
      title: "Transit checks",
      label: "Current sky",
      body: "Check current transits and the calculation date returned by the service.",
      href: "/app/astrology?tab=transits",
    },
    {
      id: "together",
      title: "Together invites",
      label: "Synastry",
      body: "Open relationship maps and invite another person into the web flow.",
      href: "/app/astrology?tab=together",
    },
    {
      id: "reports",
      title: rt(language,"reports"),
      label: rt(language,"open"),
      body: rt(language,"snapshot"),
      href: "/app/astrology?tab=reports",
    },
  ];
}

function ReadingList({
  readings,
  language,
  todayLabel,
  empty,
  limit,
}: {
  readings: ReadingSummary[];
  language: HintLanguage;
  todayLabel: string;
  empty: string;
  limit?: number;
}) {
  const rows = typeof limit === "number" ? readings.slice(0, limit) : readings;
  if (!rows.length) return <EmptyPanel>{empty}</EmptyPanel>;

  return (
    <ol className="hr-list">
      {rows.map((reading) => (
        <li key={reading.id}>
          <ReadingCard reading={reading} language={language} todayLabel={todayLabel} />
        </li>
      ))}
    </ol>
  );
}

function QuestionList({
  items,
  todayLabel,
  empty,
  limit,
}: {
  items: QuestionHistoryItem[];
  todayLabel: string;
  empty: string;
  limit?: number;
}) {
  const rows = typeof limit === "number" ? items.slice(0, limit) : items;
  if (!rows.length) return <EmptyPanel>{empty}</EmptyPanel>;

  return (
    <ol className="hr-list">
      {rows.map((item) => (
        <li key={item.id}><QuestionCard item={item} todayLabel={todayLabel} /></li>
      ))}
    </ol>
  );
}

function AstrologyArchiveGrid({ profile }: { profile: BirthProfile | null }) {
  const { language } = useLanguage();
  const items = buildAstrologyArchive(profile, language);
  return (
    <div className="hr-astro">
      <div className="astro-theme"><SavedLetters /></div>
      <p className="hr-note"><LocalizedText text={"These are shortcuts to Astrology tools. They are not saved reading records."} /></p>
      <ul className="hr-shortcuts">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={item.href} className="hr-shortcut">
              <Orbit size={16} strokeWidth={1.4} className="hr-shortcut-icon" aria-hidden="true" />
              <span className="hr-shortcut-copy">
                <strong><LocalizedText text={item.title} /></strong>
                <span className="hr-shortcut-label"><LocalizedText text={item.label} /></span>
                <span className="hr-shortcut-body"><LocalizedText text={item.body} /></span>
              </span>
              <ArrowUpRight size={15} className="hr-entry-arrow" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArchiveSection({ title, children, id }: { title: ReactNode; children: ReactNode; id: string }) {
  return (
    <section className="hr-section" aria-labelledby={`hr-${id}`}>
      <h2 id={`hr-${id}`} className="hr-section-title">{title}</h2>
      {children}
    </section>
  );
}

export function ReadingsView() {
  const { language, t } = useLanguage();
  const anonId = getAnonId();
  const { data, isLoading, isError, refetch } = useListReadings({ anonId });
  const [activeTab, setActiveTab] = useState<HistoryTab>("all");
  const [localReadings, setLocalReadings] = useState<ReadingSummary[]>(() =>
    listLocalDailyReadings(anonId),
  );
  const [questionHistory, setQuestionHistory] = useState<QuestionHistoryItem[]>(() =>
    listLocalQuestionHistory(anonId),
  );
  const [tarotReadings, setTarotReadings] = useState<LocalTarotReading[]>(() =>
    listLocalTarotReadings(anonId),
  );
  const [birthProfile, setBirthProfile] = useState<BirthProfile | null>(() => readBirthProfile());
  const [askHistory, setAskHistory] = useState(() => listAskHistory(anonId));
  useEffect(() => subscribeToAskHistory(() => setAskHistory(listAskHistory(anonId))), [anonId]);
  const apiReadings = useMemo(() => (data ?? []) as ReadingSummary[], [data]);
  const tarotHistory = useMemo(
    () =>
      tarotReadings
        .map(tarotToSummary)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [tarotReadings],
  );
  const dailyHistory = useMemo(
    () =>
      [...localReadings].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [localReadings],
  );
  const readings = useMemo(() => {
    const byId = new Map<string, ReadingSummary>();
    [...tarotHistory, ...dailyHistory, ...apiReadings].forEach((reading) => {
      byId.set(reading.id, reading);
    });
    return [...byId.values()].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [apiReadings, dailyHistory, tarotHistory]);
  const displayedQuestionHistory = useMemo(
    () => mergeQuestionHistory(questionHistory, tarotReadings),
    [questionHistory, tarotReadings],
  );
  // Filters derive from the merged, id-deduplicated collection so server-only
  // records appear under Tarot/Daily too; All shows each reading exactly once.
  const tarotEntries = useMemo(() => readings.filter((reading) => readingKind(reading) === "tarot"), [readings]);
  const dailyEntries = useMemo(() => readings.filter((reading) => readingKind(reading) === "daily"), [readings]);
  const lastReading = readings[0];
  const earlierReadings = readings.slice(1);
  const historyTabs = useMemo(
    () => [
      { key: "all" as const, label: t("readings.tab.all"), count: readings.length + displayedQuestionHistory.length + askHistory.length },
      { key: "tarot" as const, label: t("readings.tab.tarot"), count: tarotEntries.length },
      { key: "daily" as const, label: t("readings.tab.daily"), count: dailyEntries.length },
      { key: "astrology" as const, label: t("readings.tab.astrology"), count: null },
      { key: "questions" as const, label: t("readings.tab.questions"), count: displayedQuestionHistory.length + askHistory.length },
    ],
    [dailyEntries.length, displayedQuestionHistory.length, readings.length, t, tarotEntries.length, askHistory.length],
  );
  const todayLabel = t("readings.today");

  useEffect(() => {
    return subscribeToLocalDailyReadings(() => {
      setLocalReadings(listLocalDailyReadings(anonId));
    });
  }, [anonId]);

  useEffect(() => {
    return subscribeToLocalQuestionHistory(() => {
      setQuestionHistory(listLocalQuestionHistory(anonId));
    });
  }, [anonId]);

  useEffect(() => {
    return subscribeToLocalTarotReadings(() => {
      setTarotReadings(listLocalTarotReadings(anonId));
    });
  }, [anonId]);

  useEffect(() => {
    const syncBirthProfile = () => setBirthProfile(readBirthProfile());
    window.addEventListener("hint.birthProfile.updated", syncBirthProfile);
    window.addEventListener("storage", syncBirthProfile);
    return () => {
      window.removeEventListener("hint.birthProfile.updated", syncBirthProfile);
      window.removeEventListener("storage", syncBirthProfile);
    };
  }, []);

  const nothingLoaded = readings.length === 0 && displayedQuestionHistory.length === 0 && askHistory.length === 0;

  return (
    <AppScreen>
      <div className="hr-page">
      <ScreenHeader
        eyebrow={t("readings.eyebrow")}
        title={t("readings.title")}
        subtitle={t("readings.subtitle")}
        backHref="/app"
      />

      {isError && <div role="status" className="hr-error">
        <p>{t("quality.historyError")}</p>
        <button type="button" onClick={() => void refetch()}>{t("quality.retry")}</button>
      </div>}
      <HistoryLedger
        readingCount={readings.length}
        dailyCount={dailyEntries.length}
        questionCount={displayedQuestionHistory.length}
      />

      <div className="hr-filters" role="group" aria-label={HISTORY_COPY[language].filter}>
        {historyTabs.map((tab) => (
          <button key={tab.key} type="button" className="hr-filter" aria-pressed={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>
            <span>{tab.label}</span>
            {tab.count !== null && <span className="hr-filter-count">{tab.count}</span>}
          </button>
        ))}
      </div>

      {(activeTab === "all" || activeTab === "questions") && askHistory.length > 0 && <ArchiveSection id="ask" title={t("quality.askHistory")}>
        <ol className="hr-list">{askHistory.map(conversation => <li key={conversation.id}>
          <Link href={`/app/ask?conversation=${encodeURIComponent(conversation.id)}`} className="hr-entry" data-kind="ask">
            <DateStamp iso={conversation.updatedAt} todayLabel={todayLabel} language={language} />
            <span className="hr-entry-body">
              <span className="hr-entry-meta"><KindCue kind="ask" label={t("nav.ask")} /></span>
              <span className="hr-entry-title">{conversation.messages.find(message => message.role === "user")?.content}</span>
              <span className="hr-open-link">{t("quality.askResume")}</span>
            </span>
            <ArrowUpRight size={16} className="hr-entry-arrow" aria-hidden="true" />
          </Link>
        </li>)}</ol>
      </ArchiveSection>}
      {isLoading && nothingLoaded ? (
        <p className="hr-loading" role="status">{t("readings.loading")}</p>
      ) : isError && nothingLoaded && activeTab !== "astrology" ? null : activeTab === "questions" ? (
        <ArchiveSection id="questions" title={t("readings.questions")}>
          {(displayedQuestionHistory.length > 0 || askHistory.length === 0) && <QuestionList
            items={displayedQuestionHistory}
            todayLabel={todayLabel}
            empty={t("readings.questionsEmpty")}
          />}
        </ArchiveSection>
      ) : activeTab === "astrology" ? (
        <ArchiveSection id="astrology" title={t("readings.astrologyHistory")}>
          <AstrologyArchiveGrid profile={birthProfile} />
        </ArchiveSection>
      ) : activeTab === "daily" ? (
        <ArchiveSection id="daily" title={t("readings.dailyCalendarHistory")}>
          <ReadingList readings={dailyEntries} language={language} todayLabel={todayLabel} empty={t("readings.dailyEmpty")} />
        </ArchiveSection>
      ) : activeTab === "tarot" ? (
        <ArchiveSection id="tarot" title={t("readings.tarotHistory")}>
          <ReadingList readings={tarotEntries} language={language} todayLabel={todayLabel} empty={t("readings.tarotEmpty")} />
        </ArchiveSection>
      ) : (
        <>
          <ArchiveSection id="last" title={t("readings.last")}>
            {lastReading ? (
              <ReadingCard reading={lastReading} language={language} todayLabel={todayLabel} featured />
            ) : (
              <EmptyPanel>{t("readings.empty")}</EmptyPanel>
            )}
          </ArchiveSection>

          {/* Every remaining reading once, newest first; type cues tell tarot from daily. */}
          {lastReading && <ArchiveSection id="recent" title={t("readings.recent")}>
            <ReadingList readings={earlierReadings} language={language} todayLabel={todayLabel} empty={t("readings.recentEmpty")} />
          </ArchiveSection>}

          <ArchiveSection id="questions" title={t("readings.questions")}>
            <QuestionList items={displayedQuestionHistory} todayLabel={todayLabel} empty={t("readings.questionsEmpty")} limit={4} />
          </ArchiveSection>

          {/* Astrology tools and saved letters close the archive: they are references, not entries. */}
          <ArchiveSection id="astrology" title={t("readings.tab.astrology")}>
            <AstrologyArchiveGrid profile={birthProfile} />
          </ArchiveSection>
        </>
      )}
      </div>
    </AppScreen>
  );
}

export function ReadingDetailView() {
  const { t } = useLanguage();
  const [location, navigate] = useLocation();
  const pathname = location.split(/[?#]/, 1)[0] ?? "";
  const readingPathIndex = pathname.indexOf("/readings/");
  const encodedId =
    readingPathIndex >= 0
      ? pathname.slice(readingPathIndex + "/readings/".length).split("/", 1)[0]
      : "";
  let id = encodedId;
  try {
    id = decodeURIComponent(encodedId);
  } catch {
    // Keep the raw identifier if an old saved URL contains malformed escaping.
  }
  const anonId = getAnonId();
  const { data } = useListReadings({ anonId });
  const tarotReading = getLocalTarotReading(id, anonId);
  const dailyReading = getLocalDailyReading(id, anonId);
  const question = listLocalQuestionHistory(anonId).find((item) => item.id === id);
  const apiReading = ((data ?? []) as ReadingSummary[]).find((reading) => reading.id === id);
  const fallbackReading = dailyReading ?? apiReading;

  if (tarotReading) {
    // The tarot room design chosen for this reading is content, so it stays.
    const backgroundId = tarotReading.roomDesign?.backgroundId ?? "stars";
    return (
      <div
        data-testid="tarot-history-detail"
        data-room-background={backgroundId}
        className="relative h-full w-full overflow-hidden"
        style={{ background: getTarotRoomSurfaceBackground(backgroundId) }}
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 ${getTarotRoomStarClassName(backgroundId)}`}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent_30%,rgba(255,249,244,0.16))]"
        />
        <div className="relative z-10 h-full">
          <AppScreen>
            <div className="hr-page hr-detail">
            <ScreenHeader
              eyebrow={t("readings.detail")}
              title={tarotReading.spreadLabel}
              subtitle={tarotReading.focusLabel ?? t("readings.savedTarot")}
              backHref="/app/readings"
              backLabel={t("nav.history")}
              backClassName="min-h-11"
            />
            <ReadingDetailMeta
              spreadType={tarotReading.spreadLabel}
              createdAt={tarotReading.createdAt}
              question={tarotReading.question}
            />
            <div className="hr-detail-actions">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/app/tarot?reading=${encodeURIComponent(tarotReading.id)}&returnTo=detail`,
                  )
                }
                className="hr-primary"
              >
                {t("readings.returnToChat")}
              </button>
            </div>
            <ArchiveSection id="cards" title={t("readings.cardsDrawn")}>
              <div className="hr-panel">
                <div className="overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none]">
                  <div className={`flex gap-3 ${tarotReading.cards.length <= 3 ? "justify-center" : "justify-start"}`}>
                  {tarotReading.cards.map((card, index) => {
                    const image = getTarotCardImage(card.cardId, tarotReading.cardArtId ?? "original");
                    return (
                      <div key={`${card.cardId}-${index}`} className="hr-drawn-card">
                        <div className="hr-drawn-card-face">
                          {image ? (
                            <img
                              src={image}
                              alt={card.name}
                              className={`h-full w-full object-cover ${card.orientation === "reversed" ? "rotate-180" : ""}`}
                            />
                          ) : null}
                        </div>
                        <p className="hr-drawn-card-position">{card.positionLabel}</p>
                        <p className="hr-drawn-card-name">{card.name}</p>
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>
            </ArchiveSection>
            <ArchiveSection id="answer" title={t("readings.answer")}>
              <div className="hr-panel">
                <p className="hr-answer">{tarotReading.shortAnswer}</p>
                <div className="hr-meanings">
                  {tarotReading.cardMeanings.map((meaning, index) => (
                    <p key={`${tarotReading.id}-meaning-${index}`}>{meaning}</p>
                  ))}
                </div>
                <p className="hr-detail-text">{displayQuestionMeaning(tarotReading)}</p>
              </div>
            </ArchiveSection>
            </div>
          </AppScreen>
        </div>
      </div>
    );
  }

  if (fallbackReading) {
    return (
      <AppScreen>
        <div className="hr-page hr-detail">
        <ScreenHeader
          eyebrow={t("readings.detail")}
          title={fallbackReading.cardName}
          subtitle={t("readings.savedReading")}
          backHref="/app/readings"
          backLabel={t("nav.history")}
        />
        <ReadingDetailMeta
          spreadType={String(fallbackReading.spreadType)}
          createdAt={fallbackReading.createdAt}
          question={fallbackReading.question ?? undefined}
        />
        <div className="hr-panel" data-hero="true">
          <p className="hr-answer">{fallbackReading.whisper}</p>
        </div>
        </div>
      </AppScreen>
    );
  }

  if (question) {
    return (
      <AppScreen>
        <div className="hr-page hr-detail">
        <ScreenHeader
          eyebrow={t("readings.questionDetail")}
          title={SPREAD_LABELS[question.spreadType] ?? question.spreadType}
          subtitle={question.focus}
          backHref="/app/readings"
          backLabel={t("nav.history")}
        />
        <ReadingDetailMeta
          spreadType={SPREAD_LABELS[question.spreadType] ?? question.spreadType}
          createdAt={question.createdAt}
          question={question.question}
        />
        <div className="hr-panel" data-hero="true">
          <p className="hr-detail-text">{question.focus}</p>
        </div>
        </div>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <div className="hr-page hr-detail">
      <ScreenHeader
        eyebrow={t("nav.history")}
        title={t("readings.notFound")}
        subtitle={t("readings.notFoundBody")}
        backHref="/app/readings"
        backLabel={t("nav.history")}
      />
      <EmptyPanel>{t("readings.notFoundHint")}</EmptyPanel>
      </div>
    </AppScreen>
  );
}

/** Detail summary uses the same ledger language as the archive counts. */
function ReadingDetailMeta({
  spreadType,
  createdAt,
  question,
}: {
  spreadType: string;
  createdAt: string;
  question?: string;
}) {
  const { t, language } = useLanguage();

  return (
    <section className="hr-section" aria-labelledby="hr-summary">
      <h2 id="hr-summary" className="hr-section-title">{t("readings.summary")}</h2>
      {language !== "en" && <p className="hr-note">{t("quality.originalText")}</p>}
      <dl className="hr-detail-meta">
        <div><dt>{t("readings.meta.spread")}</dt><dd><LocalizedText text={spreadType} /></dd></div>
        <div><dt>{t("readings.meta.time")}</dt><dd>{new Date(createdAt).toLocaleString(language)}</dd></div>
        <div data-wide="true"><dt>{t("readings.meta.question")}</dt><dd>{question || t("readings.meta.noQuestion")}</dd></div>
      </dl>
    </section>
  );
}

import { useQuery } from "@tanstack/react-query";
import { apiFetch, apiUrl } from "../../lib/api";
import { countReadingDays } from "../../lib/readingDays";
import { LocalizedText, translateText } from "../../lib/LocalizedText";
import { useLocalDay } from "../../lib/useLocalDay";
import { getCachedDailyReceipt, getOrCreateDailyReceipt, openDailyReceipt, subscribeToDailyReceiptFallbacks, type DailyReceipt } from "../../lib/dailyReceipts";
import { getDailyPullById } from "../home/data/dailyPulls";
import { withDailyCardIdentity } from "../home/data/dailyCardSync";
import { listLocalTarotReadings } from "../readings/localTarotReadings";
import { listLocalDailyReadings, saveLocalDailyReading } from "../readings/localDailyReadings";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { ACCENT, GLASS } from "../hold/atmosphere";
import { AppScreen, SectionLabel } from "../../components/app/AppChrome";
import { DailyReportCard } from "../home/components/DailyReportCard";
import { getSyncedDailyCard } from "../home/data/dailyCardSync";
import { getDailyReport } from "../home/data/dailyReport";
import {
  useGetOrCreateDailyPull,
  useUpdateDailyPull,
} from "@workspace/api-client-react";
import type { DailyPull } from "@workspace/api-client-react";
import type { DailyReport, DailyScore, DailyScoreKey } from "../home/types/home.types";
import { getAnonId, getLocalDateString } from "../../lib/identity";
import { useLanguage } from "../../lib/i18n";
import { useProfile } from "../../lib/useProfile";
import { readBirthProfile } from "../../lib/astro/userBirthProfile";
import {
  listLocalDailyReadingMemory,
  subscribeToLocalDailyReadings,
} from "../readings/localDailyReadings";
import type { DailyCardMemory } from "../../lib/tarot/skyGuidedTarot";

import { readTextDraft, writeTextDraft, clearTextDraft, textDraftKey, type TextDraft } from "../../lib/textDraft";

const OPTION_WINDOW = [-2, -1, 0, 1, 2] as const;
const PERIODS = [
  { key: "day", labelKey: "dailyPull.period.day" },
  { key: "week", labelKey: "dailyPull.period.week" },
  { key: "month", labelKey: "dailyPull.period.month" },
  { key: "year", labelKey: "dailyPull.period.year" },
] as const;
const SCORE_ORDER: DailyScoreKey[] = ["love", "wealth", "career", "study", "people"];

type PeriodMode = (typeof PERIODS)[number]["key"];
type PeriodOffsets = Record<PeriodMode, number>;
type Translate = (key: string) => string;

function startOfLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addLocalMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addLocalYears(date: Date, years: number): Date {
  return new Date(date.getFullYear() + years, 0, 1);
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addLocalDays(startOfLocalDay(date), mondayOffset);
}

function startOfPeriod(period: PeriodMode, date: Date): Date {
  const day = startOfLocalDay(date);
  if (period === "week") return startOfWeek(day);
  if (period === "month") return new Date(day.getFullYear(), day.getMonth(), 1);
  if (period === "year") return new Date(day.getFullYear(), 0, 1);
  return day;
}

function endOfPeriod(period: PeriodMode, date: Date): Date {
  const start = startOfPeriod(period, date);
  if (period === "week") return addLocalDays(start, 6);
  if (period === "month") return new Date(start.getFullYear(), start.getMonth() + 1, 0);
  if (period === "year") return new Date(start.getFullYear(), 11, 31);
  return start;
}

function getPeriodAnchor(period: PeriodMode, today: Date, offset: number): Date {
  if (period === "week") return addLocalDays(today, offset * 7);
  if (period === "month") return addLocalMonths(today, offset);
  if (period === "year") return addLocalYears(today, offset);
  return addLocalDays(today, offset);
}

function daysBetween(date: Date, base: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfLocalDay(date).getTime() - startOfLocalDay(base).getTime()) / msPerDay);
}

function offsetForPeriod(period: PeriodMode, date: Date, today: Date): number {
  if (period === "week") {
    return Math.round(daysBetween(startOfWeek(date), startOfWeek(today)) / 7);
  }
  if (period === "month") {
    return (date.getFullYear() - today.getFullYear()) * 12 + (date.getMonth() - today.getMonth());
  }
  if (period === "year") {
    return date.getFullYear() - today.getFullYear();
  }
  return daysBetween(date, today);
}

function datesInPeriod(period: PeriodMode, anchor: Date): Date[] {
  const start = startOfPeriod(period, anchor);
  const end = endOfPeriod(period, anchor);

  const dates: Date[] = [];
  for (let cursor = start; cursor <= end; cursor = addLocalDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

function withCount(template: string, count: number): string {
  return template.replace("{count}", String(count));
}

function formatDayLabel(date: Date, offset: number, t: Translate): string {
  if (offset === 0) return t("dailyPull.relative.today");
  if (offset === -1) return t("dailyPull.relative.yesterday");
  if (offset === 1) return t("dailyPull.relative.tomorrow");

  return date.toLocaleDateString(document.documentElement.lang || "en", { weekday: "short" });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString(document.documentElement.lang || "en", { month: "short", day: "numeric" });
}

function sameLocalDay(a: Date, b: Date): boolean {
  return getLocalDateString(a) === getLocalDateString(b);
}

function formatPeriodRange(period: PeriodMode, anchor: Date): string {
  const start = startOfPeriod(period, anchor);
  const end = endOfPeriod(period, anchor);

  if (period === "day") {
    return start.toLocaleDateString(document.documentElement.lang || "en", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  if (period === "month") {
    return start.toLocaleDateString(document.documentElement.lang || "en", { month: "long", year: "numeric" });
  }

  if (period === "year") {
    return String(start.getFullYear());
  }

  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

function formatPeriodButtonLabel(period: PeriodMode, offset: number, anchor: Date, t: Translate): string {
  if (period === "day") return formatDayLabel(anchor, offset, t);
  if (period === "week") {
    if (offset === 0) return t("dailyPull.relative.thisWeek");
    if (offset === -1) return t("dailyPull.relative.lastWeek");
    if (offset === 1) return t("dailyPull.relative.nextWeek");
    return offset < 0
      ? withCount(t("dailyPull.relative.weeksAgo"), Math.abs(offset))
      : withCount(t("dailyPull.relative.inWeeks"), offset);
  }
  if (period === "month") {
    if (offset === 0) return t("dailyPull.relative.thisMonth");
    if (offset === -1) return t("dailyPull.relative.lastMonth");
    if (offset === 1) return t("dailyPull.relative.nextMonth");
    return anchor.toLocaleDateString(document.documentElement.lang || "en", { month: "short" });
  }
  if (offset === 0) return t("dailyPull.relative.thisYear");
  if (offset === -1) return t("dailyPull.relative.lastYear");
  if (offset === 1) return t("dailyPull.relative.nextYear");
  return offset < 0
    ? withCount(t("dailyPull.relative.yearsAgo"), Math.abs(offset))
    : withCount(t("dailyPull.relative.inYears"), offset);
}

function periodTitle(period: PeriodMode, t: Translate): string {
  if (period === "week") return t("dailyPull.score.weekly");
  if (period === "month") return t("dailyPull.score.monthly");
  if (period === "year") return t("dailyPull.score.yearly");
  return t("dailyPull.score.daily");
}

function periodBadgeKey(period: PeriodMode): string {
  if (period === "week") return "dailyPull.badge.weekly";
  if (period === "month") return "dailyPull.badge.monthly";
  if (period === "year") return "dailyPull.badge.yearly";
  return "dailyPull.badge.daily";
}

type PeriodSummary = {
  period: PeriodMode;
  rangeLabel: string;
  overallScore: number;
  scores: DailyScore[];
  strongest: DailyScore;
  softest: DailyScore;
  bestDay: DailyReport;
  sampleCount: number;
  summary: string;
  suggestion: string;
  avoid: string;
};

function averageScores(reports: DailyReport[]): DailyScore[] {
  return SCORE_ORDER.map((key) => {
    const first = reports[0]!.scores.find((score) => score.key === key)!;
    const average = Math.round(
      reports.reduce((total, report) => {
        const score = report.scores.find((item) => item.key === key);
        return total + (score?.score ?? 0);
      }, 0) / reports.length,
    );
    return { ...first, score: average };
  });
}

function buildPeriodSummary({
  period,
  anchor,
  language,
  birthDetails,
  dailyHistory,
  serverDays = [],
}: {
  serverDays?: string[];
  period: PeriodMode;
  anchor: Date;
  language: ReturnType<typeof useLanguage>["language"];
  birthDetails?: {
    birthDate?: string | null;
    birthTime?: string | null;
    birthPlace?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    timezoneOffset?: number | null;
  };
  dailyHistory?: DailyCardMemory[];
}): PeriodSummary | null {
  const dates = datesInPeriod(period, anchor);
  if (!dates.length) return null;

  const reports = dates.map((date) =>
    getDailyReport({
      anonId: getAnonId(),
      date,
      language,
      birthDetails,
      dailyHistory,
    }),
  );
  const scores = averageScores(reports);
  const overallScore = Math.round(
    reports.reduce((total, report) => total + report.overallScore, 0) / reports.length,
  );
  const strongest = scores.reduce((best, score) => (score.score > best.score ? score : best), scores[0]!);
  const softest = scores.reduce((lowest, score) => (score.score < lowest.score ? score : lowest), scores[0]!);
  const bestDay = reports.reduce((best, report) =>
    report.overallScore > best.overallScore ? report : best,
  );
  const middleReport = reports[Math.floor(reports.length / 2)] ?? reports[0]!;

  return {
    period,
    rangeLabel: formatPeriodRange(period, anchor),
    overallScore,
    scores,
    strongest,
    softest,
    bestDay,
    sampleCount: countReadingDays([...serverDays, ...[...listLocalDailyReadings(), ...listLocalTarotReadings()].map(reading => reading.createdAt)], getLocalDateString(dates[0]!), getLocalDateString(dates[dates.length - 1]!)),
    summary: `${strongest.label} carries the strongest signal at ${strongest.score}. ${softest.label} needs the most space, so keep that area simple.`,
    suggestion: middleReport.suggestion,
    avoid: middleReport.avoid,
  };
}

function PeriodScoreBar({ score }: { score: DailyScore }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="font-sans text-[12px] leading-[1.4]" style={{ color: GLASS.muted }}>
          {score.label}
        </span>
        <span className="font-serif text-[17px] leading-[1.3] tabular-nums" style={{ color: GLASS.text }}>
          {score.score}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--hint-border) 54%, transparent)" }}>
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${score.score}%`,
            background: `linear-gradient(90deg, ${score.tone}, rgba(255,255,255,0.74))`,
          }}
        />
      </div>
    </div>
  );
}

function PeriodSummaryCard({ summary }: { summary: PeriodSummary }) {
  const { t } = useLanguage();

  return (
    <section className="grid gap-6">
      <div className="grid gap-5">
        <div>
          <p
            className="font-sans text-[12px] leading-[1.4] uppercase tracking-[0.22em]"
            style={{ color: ACCENT.aqua }}
          >
            {summary.rangeLabel}
          </p>
          <h2 className="mt-2 font-serif text-[28px] leading-[1.15] sm:text-[30px]" style={{ color: GLASS.text }}>
            {periodTitle(summary.period, t)}
          </h2>
          <div className="mt-3 flex items-end gap-2">
            <span
              className="font-serif text-[54px] leading-[0.82] tabular-nums sm:text-[64px]"
              style={{
                color: "var(--hint-score-ink)",
                textShadow: "var(--hint-score-shadow)",
              }}
            >
              {summary.overallScore}
            </span>
            <span className="pb-1.5 font-serif text-[16px]" style={{ color: "var(--hint-score-ink)" }}>
              {t("daily.score")}
            </span>
          </div>
          <p className="mt-4 max-w-md font-sans text-[15px] leading-[1.6]" style={{ color: GLASS.muted }}>
            {summary.summary}
          </p>
        </div>

        <div className="grid gap-4 min-[390px]:grid-cols-2 min-[390px]:gap-x-5">
          {summary.scores.map((score) => (
            <PeriodScoreBar key={score.key} score={score} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="min-w-0">
          <p className="font-sans text-[12px] leading-[1.4] uppercase tracking-[0.18em]" style={{ color: GLASS.faint }}>
            {t("dailyPull.strongest")}
          </p>
          <p className="mt-2 truncate font-serif text-[16px] leading-[1.4]" style={{ color: GLASS.text }}>
            {summary.strongest.label} · {summary.strongest.score}
          </p>
        </div>
        <div className="min-w-0">
          <p className="font-sans text-[12px] leading-[1.4] uppercase tracking-[0.18em]" style={{ color: GLASS.faint }}>
            {t("dailyPull.bestDay")}
          </p>
          <p className="mt-2 truncate font-serif text-[16px] leading-[1.4]" style={{ color: GLASS.text }}>
            {formatShortDate(new Date(`${summary.bestDay.date}T00:00:00`))} · {summary.bestDay.overallScore}
          </p>
        </div>
        <div className="min-w-0">
          <p className="font-sans text-[12px] leading-[1.4] uppercase tracking-[0.18em]" style={{ color: GLASS.faint }}>
            {t("dailyPull.daysRead")}
          </p>
          <p className="mt-2 truncate font-serif text-[16px] leading-[1.4]" style={{ color: GLASS.text }}>
            {summary.sampleCount}
          </p>
        </div>
      </div>

      <div className="grid gap-5 min-[390px]:grid-cols-2">
        <div>
          <p className="font-sans text-[12px] leading-[1.4] uppercase tracking-[0.2em]" style={{ color: GLASS.faint }}>
            {t("daily.suggest")}
          </p>
          <p className="mt-2 font-serif text-[15px] leading-[1.6]" style={{ color: GLASS.text }}>
            {summary.suggestion}
          </p>
        </div>
        <div>
          <p className="font-sans text-[12px] leading-[1.4] uppercase tracking-[0.2em]" style={{ color: GLASS.faint }}>
            {t("daily.avoid")}
          </p>
          <p className="mt-2 font-serif text-[15px] leading-[1.6]" style={{ color: GLASS.text }}>
            {summary.avoid}
          </p>
        </div>
      </div>
    </section>
  );
}

function calendarCells(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = addLocalDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addLocalDays(start, index));
}

function weekDayLabels(): string[] {
  const base = new Date(2026, 5, 14);
  return Array.from({ length: 7 }, (_, index) =>
    addLocalDays(base, index).toLocaleDateString(document.documentElement.lang || "en", { weekday: "short" }).slice(0, 2),
  );
}

function CalendarJumpMenu({
  selectedDate,
  currentPeriod,
  today,
  onSelect,
  onClose,
}: {
  selectedDate: Date;
  currentPeriod: PeriodMode;
  today: Date;
  onSelect: (date: Date, mode: PeriodMode) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<PeriodMode>(currentPeriod);
  const [cursor, setCursor] = useState(() => new Date(selectedDate));
  const cells = useMemo(() => calendarCells(cursor), [cursor]);
  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, month) => new Date(cursor.getFullYear(), month, 1)),
    [cursor],
  );
  const yearStart = Math.floor(cursor.getFullYear() / 12) * 12;
  const years = useMemo(
    () => Array.from({ length: 12 }, (_, index) => yearStart + index),
    [yearStart],
  );
  const selectedWeekKey = getLocalDateString(startOfWeek(selectedDate));

  function shiftCursor(delta: number) {
    if (mode === "year") {
      setCursor((date) => new Date(date.getFullYear() + delta * 12, date.getMonth(), 1));
      return;
    }
    if (mode === "month") {
      setCursor((date) => new Date(date.getFullYear() + delta, date.getMonth(), 1));
      return;
    }
    setCursor((date) => new Date(date.getFullYear(), date.getMonth() + delta, 1));
  }

  return (
    <div
      data-testid="daily-calendar-jump-menu"
      className="hint-liquid-panel rounded-[28px] p-2"
      style={{
        position: "absolute",
        left: 0,
        top: "2.75rem",
        zIndex: 40,
        width: "100%",
        maxWidth: 340,
        borderColor: "color-mix(in srgb, var(--hint-rose) 24%, var(--hint-border))",
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftCursor(-1)}
          className="grid size-11 shrink-0 place-items-center rounded-full border"
          style={{ color: GLASS.text, background: "var(--hint-input-bg)", borderColor: GLASS.border }}
          aria-label={t("common.previous")}
        >
          <ChevronLeft size={17} />
        </button>
        <div className="min-w-0 text-center">
          <p className="font-serif text-[20px] leading-none" style={{ color: GLASS.text }}>
            {mode === "year"
              ? `${years[0]} - ${years[years.length - 1]}`
              : cursor.toLocaleDateString(document.documentElement.lang || "en", { month: "long", year: "numeric" })}
          </p>
          <p className="mt-1 font-sans text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: GLASS.faint }}><LocalizedText text={" Calendar jump "} /></p>
        </div>
        <button
          type="button"
          onClick={() => shiftCursor(1)}
          className="grid size-11 shrink-0 place-items-center rounded-full border"
          style={{ color: GLASS.text, background: "var(--hint-input-bg)", borderColor: GLASS.border }}
          aria-label={t("common.next")}
        >
          <ChevronRight size={17} />
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1 rounded-[22px] border p-1" style={{ borderColor: GLASS.border, background: "color-mix(in srgb, var(--hint-surface-soft) 74%, transparent)" }}>
        {PERIODS.map((item) => {
          const selected = mode === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setMode(item.key)}
              className="min-h-11 min-w-max max-w-full flex-[1_1_5em] rounded-full px-2 font-sans text-[10px] font-black uppercase tracking-[0.08em]"
              style={{
                color: selected ? "var(--hint-special-action-text)" : GLASS.muted,
                background: selected ? "var(--hint-special-action-bg)" : "transparent",
                boxShadow: selected ? "inset 0 1px 0 rgba(255,255,255,0.46)" : "none",
              }}
            >
              {t(item.labelKey)}
            </button>
          );
        })}
      </div>

      {(mode === "day" || mode === "week") && (
        <>
          <div className="mb-1 grid grid-cols-7 gap-1 px-1">
            {weekDayLabels().map((day) => (
              <span key={day} className="text-center font-sans text-[9px] font-black uppercase" style={{ color: GLASS.faint }}>
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((date) => {
              const inMonth = date.getMonth() === cursor.getMonth();
              const isSelected = sameLocalDay(date, selectedDate);
              const isSameWeek = getLocalDateString(startOfWeek(date)) === selectedWeekKey;
              const selected = mode === "week" ? isSameWeek : isSelected;
              return (
                <button
                  key={getLocalDateString(date)}
                  type="button"
                  onClick={() => onSelect(date, mode)}
                  className="min-h-11 rounded-[13px] font-sans text-[13px] tabular-nums transition active:scale-[0.96]"
                  style={{
                    color: selected ? "var(--hint-special-action-text)" : inMonth ? GLASS.text : GLASS.faint,
                    background: selected
                      ? "var(--hint-special-action-bg)"
                      : sameLocalDay(date, today)
                        ? "color-mix(in srgb, var(--hint-rose) 12%, var(--hint-surface-soft))"
                        : "transparent",
                    border: selected ? "1px solid color-mix(in srgb, var(--hint-rose) 30%, var(--hint-border))" : "1px solid transparent",
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </>
      )}

      {mode === "month" && (
        <div className="grid grid-cols-3 gap-1.5">
          {monthNames.map((date) => {
            const selected = selectedDate.getFullYear() === date.getFullYear() && selectedDate.getMonth() === date.getMonth();
            return (
              <button
                key={date.getMonth()}
                type="button"
                onClick={() => onSelect(date, "month")}
                className="min-h-11 rounded-[16px] px-2 font-serif text-[13px] transition active:scale-[0.96]"
                style={{
                  color: selected ? "var(--hint-special-action-text)" : GLASS.text,
                  background: selected ? "var(--hint-special-action-bg)" : "color-mix(in srgb, var(--hint-surface-soft) 64%, transparent)",
                  border: `1px solid ${selected ? "color-mix(in srgb, var(--hint-rose) 30%, var(--hint-border))" : GLASS.border}`,
                }}
              >
                {date.toLocaleDateString(document.documentElement.lang || "en", { month: "short" })}
              </button>
            );
          })}
        </div>
      )}

      {mode === "year" && (
        <div className="grid grid-cols-3 gap-1.5">
          {years.map((year) => {
            const selected = selectedDate.getFullYear() === year;
            return (
              <button
                key={year}
                type="button"
                onClick={() => onSelect(new Date(year, 0, 1), "year")}
                className="min-h-11 rounded-[16px] px-2 font-serif text-[14px] tabular-nums transition active:scale-[0.96]"
                style={{
                  color: selected ? "var(--hint-special-action-text)" : GLASS.text,
                  background: selected ? "var(--hint-special-action-bg)" : "color-mix(in srgb, var(--hint-surface-soft) 64%, transparent)",
                  border: `1px solid ${selected ? "color-mix(in srgb, var(--hint-rose) 30%, var(--hint-border))" : GLASS.border}`,
                }}
              >
                {year}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        className="hint-ghost-button mt-3 min-h-11 w-full rounded-full font-sans text-[11px] font-black uppercase tracking-[0.12em]"
      ><LocalizedText text={" Close "} /></button>
    </div>
  );
}

function DayDateStrip({ options, selectedOffset, onSelect }: {
  options: Array<{ offset: number; date: Date; key: string; label: string; detail: string; day: string }>;
  selectedOffset: number;
  onSelect: (offset: number) => void;
}) {
  const { language } = useLanguage();
  const stripRef = useRef<HTMLDivElement>(null);
  const selectedButtonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const strip = stripRef.current;
    const button = selectedButtonRef.current;
    if (!strip || !button) return;
    strip.scrollLeft = button.offsetLeft - (strip.clientWidth - button.offsetWidth) / 2;
  }, [selectedOffset]);

  return (
    <div
      ref={stripRef}
      role="group"
      aria-label={translateText("Choose a date", language)}
      data-testid="daily-date-strip"
      className="relative flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y", overflowAnchor: "none" }}
    >
      {options.map(({ offset, date, key, label, detail, day }) => {
        const selected = selectedOffset === offset;
        return (
          <button
            key={key}
            ref={selected ? selectedButtonRef : undefined}
            type="button"
            onClick={() => onSelect(offset)}
            aria-pressed={selected}
            aria-current={offset === 0 ? "date" : undefined}
            aria-label={date.toLocaleDateString(language, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            data-date={getLocalDateString(date)}
            className="hint-tap-sparkle min-h-[60px] w-[72px] shrink-0 rounded-[14px] border px-1.5 py-2 text-left transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px]"
            style={{
              background: selected ? "var(--hint-special-action-bg)" : "transparent",
              borderColor: selected ? "var(--hint-special-action-border)" : "transparent",
              color: selected ? "var(--hint-special-action-text)" : "var(--hint-text)",
            }}
          >
            <span className="block truncate font-sans text-[9px] leading-[1.4] font-black uppercase tracking-normal" style={{ color: selected ? "var(--hint-special-action-text)" : "var(--hint-faint)" }}>
              {label}
            </span>
            <span className="mt-1 block font-serif text-[24px] leading-[1.1] tabular-nums">
              {day}
            </span>
            <span className="mt-1 block truncate font-sans text-[9px] leading-[1.4] font-semibold" style={{ color: selected ? "color-mix(in srgb, var(--hint-special-action-text) 72%, transparent)" : "var(--hint-faint)" }}>
              {detail}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function DailyPullView() {
  const drawMutation = useGetOrCreateDailyPull();
  const updateMutation = useUpdateDailyPull();
  const [pull, setPull] = useState<DailyPull | null>(null);
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [noteError, setNoteError] = useState(false);
  const [draftError, setDraftError] = useState(false);
  const noteDrafts = useRef(new Map<string, TextDraft>());
  const noteSaving = useRef(new Set<string>());
  const noteSaveVersions = useRef(new Map<string, number>());
  const noteKey = (date: string) => textDraftKey("daily", getAnonId(), date);
  const [period, setPeriod] = useState<PeriodMode>("day");
  const [periodOffsets, setPeriodOffsets] = useState<PeriodOffsets>({
    day: 0,
    week: 0,
    month: 0,
    year: 0,
  });
  const [selectedOffset, setSelectedOffset] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const activePullDateRef = useRef("");
  const { language, t } = useLanguage();
  const { profile } = useProfile();
  const { data: serverDays = [] } = useQuery<string[]>({
    queryKey: ["reading-days", getAnonId()],
    queryFn: async ({ signal }) => {
      const response = await apiFetch(apiUrl(`/api/reading-days?anonId=${encodeURIComponent(getAnonId())}`), { signal });
      if (!response.ok) throw new Error("Reading dates unavailable");
      return response.json();
    }, staleTime: 30_000, retry: 1,
  });
  const [birthProfile, setBirthProfile] = useState(() => readBirthProfile());
  const [historyVersion, setHistoryVersion] = useState(0);
  const activeBirthDetails = profile?.birthDate || birthProfile
    ? {
        birthDate: profile?.birthDate ?? birthProfile?.birthDate,
        birthTime: profile?.birthTime ?? birthProfile?.birthTime,
        birthPlace: profile?.birthPlace ?? birthProfile?.birthPlace,
        latitude: birthProfile?.latitude,
        longitude: birthProfile?.longitude,
        timezoneOffset: birthProfile?.timezoneOffset,
      }
    : null;
  const dailyHistory = useMemo(
    () => listLocalDailyReadingMemory().slice(0, 30),
    [historyVersion],
  );
  const currentDay = useLocalDay();
  const today = useMemo(() => startOfLocalDay(new Date(`${currentDay}T12:00:00`)), [currentDay]);
  const [receiptVersion, setReceiptVersion] = useState(0);
  const activeOffset = period === "day" ? selectedOffset : periodOffsets[period];
  const selectedDate = useMemo(() => getPeriodAnchor(period, today, activeOffset), [activeOffset, period, today]);
  const selectedDateKey = useMemo(() => getLocalDateString(selectedDate), [selectedDate]);
  const syncedDailyCard = useMemo(
    () => {
      const cached = getCachedDailyReceipt("daily-card", { dailyKey: selectedDateKey });
      if (selectedDateKey !== currentDay) {
        const archived = listLocalDailyReadings().find(row => row.id === `daily-${selectedDateKey}`);
        if (archived?.cardId) {
          const saved = getDailyPullById(archived.cardId, language);
          return saved.cardId === archived.cardId ? saved : null;
        }
        const serverCard = getSyncedDailyCard(pull, selectedDateKey, language);
        if (pull?.isFlipped && serverCard && serverCard.cardId === pull.cardId) return serverCard;
        if (cached?.openedAt && cached.assignedCardId) {
          const saved = getDailyPullById(cached.assignedCardId, language);
          return saved.cardId === cached.assignedCardId ? saved : null;
        }
        return null;
      }
      if (cached?.assignedCardId) {
        const base = getDailyReport({ anonId: getAnonId(), date: selectedDate, language }).card;
        return withDailyCardIdentity(base, cached.assignedCardId, language);
      }
      return getSyncedDailyCard(pull, selectedDateKey, language);
    },
    [language, pull, selectedDateKey, receiptVersion, currentDay, historyVersion],
  );
  useEffect(() => subscribeToDailyReceiptFallbacks(() => setReceiptVersion(value => value + 1)), []);
  useEffect(() => {
    let active = true;
    if (period !== "day" || selectedDateKey !== currentDay) return;
    const dailyKey = selectedDateKey;
    const fallbackAssignedCardId = getDailyReport({ anonId: getAnonId(), date: selectedDate, language }).card.cardId;
    void getOrCreateDailyReceipt("daily-card", { dailyKey, fallbackAssignedCardId }).then(async receipt => {
      if (!active || dailyKey !== currentDay) return;
      const revealed = receipt.openedAt ? receipt : await openDailyReceipt("daily-card", { dailyKey, fallbackAssignedCardId: receipt.assignedCardId });
      if (revealed.assignedCardId) saveLocalDailyReading(getDailyPullById(revealed.assignedCardId, language), new Date(`${dailyKey}T12:00:00`));
    });
    return () => { active = false; };
  }, [selectedDateKey, currentDay, period]);
  const activeLabel = formatPeriodButtonLabel(period, activeOffset, selectedDate, t);
  const activeDetail = formatPeriodRange(period, selectedDate);
  const dayOptions = useMemo(
    () =>
      OPTION_WINDOW.map((relative) => {
        const offset = selectedOffset + relative;
        const date = addLocalDays(today, offset);
        return {
          offset,
          date,
          key: `${offset}:${getLocalDateString(date)}`,
          label: formatDayLabel(date, offset, t),
          month: date.toLocaleDateString(language, { month: "short" }),
          detail: date.toLocaleDateString(document.documentElement.lang || "en", { month: "short", day: "numeric", year: "numeric" }),
          day: date.toLocaleDateString(document.documentElement.lang || "en", { day: "numeric" }),
        };
      }),
    [selectedOffset, t, today, language],
  );
  const periodOptions = useMemo(
    () =>
      OPTION_WINDOW.map((relative) => {
        const offset = activeOffset + relative;
        const date = getPeriodAnchor(period, today, offset);
        return {
          offset,
          date,
          key: `${period}:${offset}:${getLocalDateString(date)}`,
          selected: offset === activeOffset,
          label: formatPeriodButtonLabel(period, offset, date, t),
          detail: formatPeriodRange(period, date),
        };
      }),
    [activeOffset, period, t, today],
  );
  const periodSummary = useMemo(
    () =>
      period === "day"
        ? null
        : buildPeriodSummary({
            period,
            anchor: selectedDate,
            language,
            birthDetails: activeBirthDetails ?? undefined,
            dailyHistory,
            serverDays,
          }),
    [
      activeBirthDetails?.birthDate,
      activeBirthDetails?.birthPlace,
      activeBirthDetails?.birthTime,
      activeBirthDetails?.latitude,
      activeBirthDetails?.longitude,
      activeBirthDetails?.timezoneOffset,
      dailyHistory,
      serverDays,
      language,
      period,
      selectedDate,
    ],
  );

  useEffect(() => {
    if (period !== "day") return;
    const pullDate = selectedDateKey;
    const draftKey = noteKey(pullDate);
    const saveVersion = noteSaveVersions.current.get(draftKey) ?? 0;
    activePullDateRef.current = pullDate;
    setPull(null);
    setNote(noteDrafts.current.get(pullDate)?.text ?? readTextDraft(noteKey(pullDate))?.text ?? "");
    setSavedNote("");
    setNoteError(false);
    let current = true;
    drawMutation.mutate(
      { data: { anonId: getAnonId(), date: pullDate } },
      {
        onSuccess: (data) => {
          if (!current || activePullDateRef.current !== pullDate) return;
          setPull(data);
          // The initial request can finish after a PATCH has saved newer text and
          // cleared its draft. Its older snapshot must not hydrate the note again.
          if ((noteSaveVersions.current.get(draftKey) ?? 0) !== saveVersion) return;
          setNote(noteDrafts.current.get(pullDate)?.text ?? readTextDraft(noteKey(pullDate))?.text ?? data.note ?? "");
          setSavedNote(data.note ?? "");
        },
      },
    );
    return () => { current = false; activePullDateRef.current = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, selectedDateKey]);

  useEffect(() => {
    const syncBirthProfile = () => setBirthProfile(readBirthProfile());
    window.addEventListener("hint.birthProfile.updated", syncBirthProfile);
    window.addEventListener("storage", syncBirthProfile);
    return () => {
      window.removeEventListener("hint.birthProfile.updated", syncBirthProfile);
      window.removeEventListener("storage", syncBirthProfile);
    };
  }, []);

  useEffect(
    () =>
      subscribeToLocalDailyReadings(() =>
        setHistoryVersion((version) => version + 1),
      ),
    [],
  );

  function saveNote() {
    if ((note === savedNote && !noteError) || noteSaving.current.has(selectedDateKey)) return;
    const pullDate = selectedDateKey;
    const draftKey = noteKey(pullDate);
    const submitted = noteDrafts.current.get(pullDate) ?? readTextDraft(draftKey) ?? writeTextDraft(draftKey, note).draft;
    noteSaving.current.add(pullDate);
    setNoteError(false);
    // mutateAsync callbacks remain attached when the selected date changes.
    void updateMutation.mutateAsync({ data: { anonId: getAnonId(), date: pullDate, note: submitted.text, editedAt: submitted.editedAt } })
      .then((data) => {
        noteSaveVersions.current.set(draftKey, (noteSaveVersions.current.get(draftKey) ?? 0) + 1);
        clearTextDraft(draftKey, submitted);
        if (noteDrafts.current.get(pullDate)?.revision === submitted.revision) noteDrafts.current.delete(pullDate);
        if (activePullDateRef.current === pullDate) setSavedNote(data.note ?? "");
      })
      .catch(() => { if (activePullDateRef.current === pullDate) setNoteError(true); })
      .finally(() => noteSaving.current.delete(pullDate));
  }

  function shiftActivePeriod(delta: number) {
    setCalendarOpen(false);

    if (period === "day") {
      setSelectedOffset((value) => value + delta);
      return;
    }

    setPeriodOffsets((next) => ({
      ...next,
      [period]: next[period] + delta,
    }));
  }

  function jumpToDate(date: Date, nextPeriod: PeriodMode) {
    const normalizedDate = startOfLocalDay(date);

    setPeriod(nextPeriod);
    if (nextPeriod === "day") {
      setSelectedOffset(offsetForPeriod("day", normalizedDate, today));
    } else {
      setPeriodOffsets((next) => ({
        ...next,
        [nextPeriod]: offsetForPeriod(nextPeriod, normalizedDate, today),
      }));
    }
    setCalendarOpen(false);
  }

  return (
    <AppScreen
      allowHorizontalPan
      contentStyle={{ paddingTop: "max(56px, calc(var(--hint-safe-top) + 16px))" }}
    >
      <div className="hint-daily-page grid min-w-0 grid-cols-1 gap-6">
        <h1 className="sr-only">{t("dailyPull.title")}</h1>

        <section className="relative min-w-0">
          <div className="grid min-w-0 grid-cols-1 gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex min-w-0 flex-1 flex-wrap gap-1"
              >
                {PERIODS.map((item) => {
                  const selected = period === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setPeriod(item.key);
                        setCalendarOpen(false);
                      }}
                      aria-pressed={selected}
                      className="min-h-11 min-w-11 flex-auto px-2 py-2 rounded-full font-sans text-[13px] leading-[1.3] font-black transition active:scale-[0.98]"
                      style={{
                        background: selected ? "var(--hint-special-action-bg)" : "transparent",
                        color: selected ? "var(--hint-special-action-text)" : GLASS.muted,
                        boxShadow: selected ? "inset 0 1px 0 rgba(255,255,255,0.42)" : "none",
                      }}
                    >
                      {t(item.labelKey)}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                data-testid="button-calendar-jump"
                onClick={() => setCalendarOpen((open) => !open)}
                aria-expanded={calendarOpen}
                aria-label={t("dailyPull.calendarTitle")}
                className="hint-tap-sparkle grid size-11 shrink-0 place-items-center rounded-full border"
                style={{
                  background: calendarOpen
                    ? "var(--hint-special-action-bg)"
                    : "color-mix(in srgb, var(--hint-rose) 9%, transparent)",
                  borderColor: calendarOpen
                    ? "color-mix(in srgb, var(--hint-rose) 34%, var(--hint-border))"
                    : "color-mix(in srgb, var(--hint-rose) 24%, var(--hint-border))",
                  color: calendarOpen ? "var(--hint-special-action-text)" : "var(--hint-rose)",
                }}
              >
                <CalendarDays size={15} />
              </button>
            </div>
            {period !== "day" && <div
              className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3"
            >
              <button
                type="button"
                onClick={() => shiftActivePeriod(-1)}
                aria-label={`${t("common.previous")} ${t(`dailyPull.period.${period}`)}`}
                className="grid size-11 shrink-0 place-items-center rounded-full border transition active:scale-[0.96]"
                style={{ background: "var(--hint-surface-soft)", borderColor: "var(--hint-border)", color: GLASS.text }}
              >
                <ChevronLeft size={17} />
              </button>
              <div className="min-w-0 text-center">
                <p className="truncate font-serif text-[20px] leading-[1.3]" style={{ color: GLASS.text }}>
                  {activeLabel}
                </p>
                <p className="mt-1 truncate font-sans text-[12px] leading-[1.4] font-bold uppercase tracking-[0.13em]" style={{ color: GLASS.faint }}>
                  {activeDetail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => shiftActivePeriod(1)}
                aria-label={`${t("common.next")} ${t(`dailyPull.period.${period}`)}`}
                className="grid size-11 shrink-0 place-items-center rounded-full border transition active:scale-[0.96]"
                style={{ background: "var(--hint-surface-soft)", borderColor: "var(--hint-border)", color: GLASS.text }}
              >
                <ChevronRight size={17} />
              </button>
            </div>}

            {period === "day" ? (
              <div className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-1">
                <button
                  type="button"
                  onClick={() => shiftActivePeriod(-1)}
                  aria-label={`${t("common.previous")} ${t("dailyPull.period.day")}`}
                  className="grid size-11 shrink-0 place-items-center rounded-full transition active:scale-[0.96]"
                  style={{ color: GLASS.muted }}
                >
                  <ChevronLeft size={16} />
                </button>
                <DayDateStrip
                  options={dayOptions}
                  selectedOffset={selectedOffset}
                  onSelect={(offset) => setSelectedOffset(offset)}
                />
                <button
                  type="button"
                  onClick={() => shiftActivePeriod(1)}
                  aria-label={`${t("common.next")} ${t("dailyPull.period.day")}`}
                  className="grid size-11 shrink-0 place-items-center rounded-full transition active:scale-[0.96]"
                  style={{ color: GLASS.muted }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : <div className="grid grid-cols-5 gap-1.5">
              {periodOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() =>
                        setPeriodOffsets((next) => ({
                          ...next,
                          [period]: option.offset,
                        }))
                      }
                      aria-pressed={option.selected}
                      className="hint-tap-sparkle min-h-[48px] rounded-[12px] border px-1 py-1.5 text-left transition active:scale-[0.98]"
                      style={{
                        background: option.selected
                          ? "var(--hint-special-action-bg)"
                          : "transparent",
                        borderColor: option.selected ? "var(--hint-special-action-border)" : "transparent",
                        color: option.selected ? "var(--hint-special-action-text)" : "var(--hint-text)",
                      }}
                    >
                      <span className="block truncate font-serif text-[13px] leading-[1.3]" style={{ color: option.selected ? "var(--hint-special-action-text)" : "var(--hint-text)" }}>
                        {option.label}
                      </span>
                      <span className="mt-1 block truncate font-sans text-[8px] leading-[1.4] font-bold uppercase tracking-normal" style={{ color: option.selected ? "color-mix(in srgb, var(--hint-special-action-text) 72%, transparent)" : "var(--hint-faint)" }}>
                        {option.detail}
                      </span>
                    </button>
                  ))}
            </div>}
          </div>
          {calendarOpen ? (
            <CalendarJumpMenu
              selectedDate={selectedDate}
              currentPeriod={period}
              today={today}
              onSelect={jumpToDate}
              onClose={() => setCalendarOpen(false)}
            />
          ) : null}
        </section>

        {periodSummary ? (
          <PeriodSummaryCard summary={periodSummary} />
        ) : (
          <DailyReportCard
            key={selectedDateKey}
            detailed
            appearance="page"
            dateOverride={selectedDate}
            cardOverride={syncedDailyCard}
            dailyHistory={dailyHistory}
            statusMessage={
              getCachedDailyReceipt("daily-card", { dailyKey: selectedDateKey })?.syncStatus === "conflict"
                ? t("quality.cardConflict")
                : getCachedDailyReceipt("daily-card", { dailyKey: selectedDateKey })?.syncStatus === "pending"
                  ? t("quality.cardPending")
                  : undefined
            }
          />
        )}

        {period === "day" && drawMutation.isError && (
          <p className="font-serif italic text-[15px] leading-[1.6] text-center" style={{ color: GLASS.muted }}>
            {t("dailyPull.error")}
          </p>
        )}

        {period === "day" && (
          <section className="[&>div:first-child>p]:text-[12px] [&>div:first-child>p]:leading-[1.4]">
            <SectionLabel>{t("dailyPull.noteTitle")}</SectionLabel>
            <div>
              <textarea
                value={note}
                maxLength={2000}
                onChange={(e) => {
                  const value = e.target.value; setNote(value);
                  const result = writeTextDraft(noteKey(selectedDateKey), value);
                  noteDrafts.current.set(selectedDateKey, result.draft); setDraftError(!result.saved);
                }}
                onBlur={saveNote}
                placeholder={t("dailyPull.notePlaceholder")}
                className="h-20 w-full resize-none rounded-[22px] bg-transparent px-3.5 py-3 font-serif text-[16px] leading-[1.5] focus:outline-none"
                style={{
                  background: "color-mix(in srgb, var(--hint-input-bg) 86%, transparent)",
                  border: `1px solid ${GLASS.border}`,
                  color: GLASS.text,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
                }}
                data-testid="input-pull-note"
              />
              {draftError && <p role="status">{t("quality.draftFailed")}</p>}
              {noteError && <button type="button" onClick={saveNote} className="min-h-11 text-sm">{t("quality.saveRetry")}</button>}
              <div className="mt-2 flex min-h-4 items-center justify-between">
                <span className="font-sans text-[12px] leading-[1.4]" style={{ color: GLASS.faint }}>
                  {updateMutation.isPending
                    ? t("profile.keeping")
                    : note === savedNote && savedNote
                      ? t("dailyPull.kept")
                      : ""}
                </span>
              </div>
            </div>
          </section>
        )}
      </div>
    </AppScreen>
  );
}

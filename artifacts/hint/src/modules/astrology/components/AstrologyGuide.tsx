import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Expand,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useLanguage, type HintLanguage } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type {
  AstroTransitsResponse,
  NatalChart,
  ZodiacSign,
} from "@/types/astrology";
import { astroText, at } from "../astrologyCopy";
import {
  SIGN_ORDER,
  SIGN_SYMBOLS,
  signName,
  bodyName,
  bodyDescription,
  signArticle,
  houseDescription,
  aspectName,
  aspectDescription,
  canonicalBody,
} from "../astrologyLibrary";
import { NatalWheel, ZodiacSymbol, BODY_SYMBOLS, CHART_POINT_SYMBOLS, aspectId, chartPointName } from "./NatalWheel";
import type { ChartSelection } from "../chartState";
import { rt } from "../reportCopy";
import {
  placementReading,
  placementHouseReading,
  aspectReading,
} from "../interpretationLibrary";
import { ElementDistribution, zodiacArt } from "./CelestialReports";
import { NatalChartDetails } from "./NatalChartDetails";
import "./astrology-guide.css";
import "./natal-chart-approved.css";
export { SIGN_ORDER, SIGN_SYMBOLS, signName };
export const label = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export function AstroPanel({
  title,
  eyebrow,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`astro-guide-panel ${className}`}>
      {eyebrow && <p className="astro-guide-eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function AstrologyOrientation() {
  const { language } = useLanguage();
  return (
    <header className="astro-guide-intro">
      <h2>{at(language, "title")}</h2>
      <p>{at(language, "intro")}</p>
    </header>
  );
}
function LearningKey() {
  const { language } = useLanguage();
  return (
    <div className="astro-learning-key">
      {(
        [
          ["planets", "what"],
          ["signs", "how"],
          ["houses", "where"],
          ["aspects", "connection"],
        ] as const
      ).map(([name, meaning]) => (
        <div key={name}>
          <span aria-hidden="true">
            {name === "signs" ? (
              <ZodiacSymbol index={0} />
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.1"
              >
                {name === "planets" ? (
                  <>
                    <circle cx="12" cy="12" r="7" />
                    <circle cx="12" cy="12" r="1" fill="currentColor" />
                  </>
                ) : name === "houses" ? (
                  <path d="M4 11L12 4L20 11V21H4ZM10 21V14H14V21" />
                ) : (
                  <>
                    <path d="M5 18L12 5L20 18Z" />
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="5" cy="18" r="2" />
                    <circle cx="20" cy="18" r="2" />
                  </>
                )}
              </svg>
            )}
          </span>
          <strong>{at(language, name)}</strong>
          <small>
            {meaning === "connection"
              ? rt(language, "connection")
              : at(language, meaning)}
          </small>
        </div>
      ))}
    </div>
  );
}
export function ZodiacGuide({
  chart,
  selected,
  onSign,
  onChart,
}: {
  chart: NatalChart | null;
  selected?: string | null;
  onSign: (sign: ZodiacSign | null) => void;
  onChart: (selection?: ChartSelection) => void;
}) {
  const { language } = useLanguage();
  const index = SIGN_ORDER.indexOf(selected as ZodiacSign);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (index >= 0) heading.current?.focus({ preventScroll: true });
  }, [selected]);
  if (index >= 0) {
    const sign = SIGN_ORDER[index];
    const article = signArticle(sign, language);
    const personal = chart?.placements.filter((p) => p.sign === sign) ?? [];
    return (
      <div className="astro-guide-stack astro-page-enter" key={sign}>
        <button
          type="button"
          className="astro-guide-link"
          onClick={() => onSign(null)}
        >
          <ArrowLeft size={16} />
          {at(language, "backSigns")}
        </button>
        <article className="astro-sign-story">
          <img
            className="astro-sign-illustration"
            src={zodiacArt(sign)}
            alt=""
            width="800"
            height="800"
            fetchPriority="high"
          />
          <p className="astro-guide-eyebrow">{at(language, "learning")}</p>
          <h2 ref={heading} tabIndex={-1}>
            {signName(sign, language)}
          </h2>
          <p className="astro-sign-theme">{article.theme}</p>
          <div className="astro-guide-chips">
            <span>{article.element}</span>
            <span>{article.modality}</span>
          </div>
          <p className="astro-story-copy">{article.description}</p>
        </article>
        <AstroPanel title={at(language, "everyday")}>
          <p>{article.example}</p>
        </AstroPanel>
        <section className="astro-reflection">
          <Sparkles size={18} aria-hidden="true" />
          <p className="astro-guide-eyebrow">{at(language, "reflection")}</p>
          <p>{article.question}</p>
        </section>
        {chart ? (
          <AstroPanel title={at(language, "yourPlacements")}>
            {personal.length ? (
              <div className="astro-placement-list">
                {personal.map((p) => (
                  <button
                    type="button"
                    key={p.body}
                    onClick={() => onChart({ kind: "body", id: p.body })}
                  >
                    <span>
                      <i aria-hidden="true">{BODY_SYMBOLS[p.body]}</i>
                      {bodyName(p.body, language)}
                    </span>
                    <span>
                      {signName(sign, language)}
                      <ArrowRight size={16} />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p>{at(language, "noneInSign")}</p>
            )}
          </AstroPanel>
        ) : (
          <button
            type="button"
            className="astro-guide-button"
            onClick={() => onChart()}
          >
            {at(language, "create")}
            <ArrowRight size={16} />
          </button>
        )}
        <p className="astro-guide-note">{at(language, "signNote")}</p>
      </div>
    );
  }
  return (
    <div className="astro-guide-stack astro-page-enter">
      <AstroPanel
        eyebrow={at(language, "building")}
        title={at(language, "difference")}
        className="astro-learning-panel"
      >
        <LearningKey />
      </AstroPanel>
      <details className="astro-library-details">
        <summary>{at(language, "building")}</summary>
        <LearningKey />
        <p className="astro-guide-note">{at(language, "signNote")}</p>
        <h3>{at(language, "signs")}</h3>
        <ul className="astro-sign-index" role="list" aria-label={at(language, "signs")}>
          {SIGN_ORDER.map((sign) => (
            <li key={sign}>
              <button type="button" className="astro-guide-link" onClick={() => onSign(sign)}>
                {signName(sign, language)}
              </button>
            </li>
          ))}
        </ul>
        <h3>{at(language, "planets")}</h3>
        {Object.keys(BODY_SYMBOLS).map((body) => (
          <div key={body}>
            <h4>{bodyName(body, language)}</h4>
            <p>{bodyDescription(body, language)}</p>
          </div>
        ))}
        <h3>{at(language, "houses")}</h3>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i}>
            <h4>
              {at(language, "house")} {i + 1}
            </h4>
            <p>{houseDescription(i + 1, language)}</p>
          </div>
        ))}
        <h3>{at(language, "aspects")}</h3>
        {["conjunction", "sextile", "square", "trine", "opposition"].map(
          (type) => (
            <div key={type}>
              <h4>{aspectName(type, language)}</h4>
              <p>{aspectDescription(type, language)}</p>
            </div>
          ),
        )}
      </details>
    </div>
  );
}
export function chartDate(
  value: string,
  language: HintLanguage,
  includeTime = false,
) {
  // Preserve unknown formats, invalid dates and timestamps without a supplied zone.
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
  if (!match) return value;
  const [, y, m, d] = match;
  const check = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (
    check.getUTCFullYear() !== Number(y) ||
    check.getUTCMonth() !== Number(m) - 1 ||
    check.getUTCDate() !== Number(d)
  )
    return value;
  if (value.includes("T") && !/(?:Z|[+-]\d{2}:?\d{2})$/.test(value))
    return value;
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(language, {
        year: "numeric",
        month: "short",
        day: "numeric",
        ...(includeTime && value.includes("T")
          ? {
              hour: "numeric" as const,
              minute: "2-digit" as const,
              timeZoneName: "short" as const,
            }
          : {}),
      }).format(date);
}

function PlacementValue({ chart, body }: { chart: NatalChart; body: string }) {
  const { language } = useLanguage();
  const p = chart.placements.find((p) => p.body === body)
    ?? chart.additionalPlacements?.find((p) => p.body === body);
  return (
    <>
      {p?.sign ? signName(p.sign, language) : at(language, "unavailable")}
      {typeof p?.degree === "number" && Number.isFinite(p.degree)
        ? ` · ${new Intl.NumberFormat(language, { maximumFractionDigits: 4 }).format(p.degree)}°`
        : ""}
      {p?.retrograde ? ` · ${at(language, "retrograde")}` : ""}
    </>
  );
}

const natalPageCopy = {
  chart: ["Your natal chart", "你的本命星盘", "Tu carta natal", "あなたの出生図", "나의 출생 차트"],
  details: ["Tap a symbol for details", "点按符号查看详情", "Toca un símbolo para ver más", "記号をタップして詳細を見る", "기호를 눌러 자세히 보기"],
} as const;

function birthClock(value: string | undefined, language: HintLanguage) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value ?? "");
  if (!match) return value;
  // Format the stored local clock time without shifting it to the device's zone.
  return new Intl.DateTimeFormat(language, { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(2000, 0, 1, Number(match[1]), Number(match[2]))));
}

export function NatalReading({
  chart,
  selection,
  onSelection,
  onEdit,
  onTransits,
  refreshing,
  onRefresh,
  error,
}: {
  chart: NatalChart;
  selection: ChartSelection | null;
  onSelection: (selection: ChartSelection | null) => void;
  onEdit: () => void;
  onTransits: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  error?: string;
}) {
  const { language } = useLanguage();
  const chartId = useId();
  const [zoom, setZoom] = useState(false);
  const [layers, setLayers] = useState({
    planets: true,
    houses: true,
    aspects: true,
  });
  const opener = useRef<HTMLElement | null>(null);
  const readingRoot = useRef<HTMLDivElement>(null);
  const activeDialog = useRef<string | null>(null);
  const placements = [...chart.placements, ...(chart.additionalPlacements ?? [])];
  const formattedBirthDate = chartDate(chart.birthProfile.birthDate, language);
  const formattedBirthTime = birthClock(chart.birthProfile.birthTime, language);
  const chartTitle = astroText(language, natalPageCopy.chart);
  function rememberOpener(event: import("react").SyntheticEvent) {
    const target = event.target as Element;
    if (target.closest('[role="dialog"]')) return;
    const control = target.closest(
      'button, [role="button"]',
    ) as HTMLElement | null;
    if (control) opener.current = control;
  }
  function restoreFocus(event: Event) {
    event.preventDefault();
    if (activeDialog.current) return;
    const target = opener.current?.isConnected
      ? opener.current
      : readingRoot.current?.querySelector<HTMLElement>("button");
    target?.focus({ preventScroll: true });
  }
  const [highlight, setHighlight] = useState<ChartSelection | null>(selection);
  useEffect(() => {
    if (selection) setHighlight(selection);
  }, [selection]);
  const p =
    selection?.kind === "body"
      ? placements.find((p) => p.body === selection.id)
      : null;
  const h =
    selection?.kind === "house"
      ? chart.houses.find((h) => String(h.house) === selection.id)
      : null;
  const a =
    selection?.kind === "aspect"
      ? chart.aspects.find((a) => aspectId(a) === selection.id)
      : null;
  const article = p?.sign ? signArticle(p.sign, language) : null;
  const standardPlacement = p && chart.placements.find((placement) => placement.body === p.body);
  activeDialog.current = p || h || a ? "detail" : zoom ? "zoom" : null;
  const title = p
    ? `${chartPointName(p.body, language)} · ${p.sign ? signName(p.sign, language) : at(language, "unavailable")}`
    : h
      ? `${at(language, "house")} ${h.house}`
      : a
        ? `${chartPointName(a.from, language)} · ${aspectName(a.type, language)} · ${chartPointName(a.to, language)}`
        : "";
  return (
    <div
      ref={readingRoot}
      onClickCapture={rememberOpener}
      onKeyDownCapture={rememberOpener}
      className="astro-guide-stack astro-page-enter astro-natal-reading"
    >
      {selection && !p && !h && !a && (
        <p role="status">{at(language, "missingSelection")}</p>
      )}
      <section className="astro-natal-section" aria-labelledby={chartId}>
        <header>
          <h2 id={chartId}>{chartTitle}</h2>
          <p>{[formattedBirthDate, formattedBirthTime].filter(Boolean).join(" · ")}</p>
          {chart.birthProfile.birthPlace && <p>{chart.birthProfile.birthPlace}</p>}
        </header>
        <div className="astro-natal-canvas">
          <NatalWheel variant="traditional" chart={chart} selection={selection ?? highlight} onSelect={onSelection} layers={layers} />
          <button type="button" className="astro-natal-expand" aria-label={at(language, "zoom")} onClick={() => setZoom(true)}>
            <Expand size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="astro-natal-actions">
          <p className="astro-natal-help">{astroText(language, natalPageCopy.details)}</p>
          <NatalChartDetails chart={chart} />
        </div>
      </section>
      <details className="astro-natal-layer-settings">
        <summary>{rt(language, "layers")}</summary>
        <div className="astro-chart-modes" role="group" aria-label={rt(language, "layers")}>
          {(["planets", "houses", "aspects"] as const).map((key) => (
            <button type="button" key={key} aria-pressed={layers[key]}
              onClick={() => setLayers((value) => ({ ...value, [key]: !value[key] }))}>
              {at(language, key)}
            </button>
          ))}
        </div>
      </details>
      <AstroPanel title={at(language, "houses")}>
        <div className="astro-placement-list">
          {chart.houses.map((h) => (
            <button
              type="button"
              key={h.house}
              onClick={() =>
                onSelection({ kind: "house", id: String(h.house) })
              }
            >
              <span>
                {at(language, "house")} {h.house}
              </span>
              <span>
                {h.sign
                  ? signName(h.sign, language)
                  : at(language, "unavailable")}
                {typeof h.degree === "number"
                  ? ` · ${h.degree.toFixed(1)}°`
                  : ""}
              </span>
              <ArrowRight size={14} />
            </button>
          ))}
        </div>
        {!chart.houses.length && <p>{at(language, "unavailable")}</p>}
      </AstroPanel>
      <ElementDistribution chart={chart} />
      <AstroPanel title={at(language, "transitTitle")}>
        <p>{at(language, "transitIntro")}</p>
        <button
          type="button"
          className="astro-guide-button"
          onClick={onTransits}
        >
          {at(language, "now")}
          <ArrowRight size={16} />
        </button>
      </AstroPanel>
      <details>
        <summary>{at(language, "birth")}</summary>
        <p>
          {chart.birthProfile.birthDate} · {chart.birthProfile.birthTime} ·{" "}
          {chart.birthProfile.birthPlace}
        </p>
        <p>
          {at(language, "calculated")} ·{" "}
          {chartDate(chart.calculatedAt, language)}
        </p>
        <p>
          {at(language, "system")} ·{" "}
          {chart.calculation?.houseSystem || at(language, "unavailable")}
        </p>
        <p>{at(language, "returnedOnly")}</p>
        <button type="button" className="astro-guide-link" onClick={onEdit}>
          <Settings2 size={15} aria-hidden="true" />
          {at(language, "edit")}
        </button>
        <button
          className="astro-guide-link"
          type="button"
          disabled={refreshing}
          onClick={onRefresh}
        >
          {refreshing ? at(language, "calculating") : at(language, "refresh")}
        </button>
        {error && <p role="alert">{error}</p>}
      </details>
      <Dialog
        open={Boolean(p || h || a)}
        onOpenChange={(open) => {
          if (!open) onSelection(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={restoreFocus}
          className="astro-theme astro-detail-dialog"
        >
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{at(language, "evidence")}</DialogDescription>
          <div className="astro-dialog-scroll">
            {p && (
              <>
                <p className="astro-detail-evidence">
                  <PlacementValue chart={chart} body={p.body} />
                </p>
                {standardPlacement && (
                  <>
                    <p>{bodyDescription(p.body, language)}</p>
                    {placementReading(standardPlacement, language).map((text, i) => <p key={i}>{text}</p>)}
                  </>
                )}
                {p.house && (
                  <section>
                    <h3>
                      {at(language, "house")} {p.house}
                    </h3>
                    {standardPlacement
                      ? placementHouseReading(standardPlacement, language).map((text, i) => <p key={i}>{text}</p>)
                      : <p>{houseDescription(p.house, language)}</p>}
                  </section>
                )}
                {p.retrograde && <p>{at(language, "retroNote")}</p>}
                <h3>{at(language, "aspects")}</h3>
                <div className="astro-placement-list">
                  {chart.aspects
                    .filter((a) => a.from === p.body || a.to === p.body)
                    .map((a) => (
                      <button
                        type="button"
                        key={aspectId(a)}
                        onClick={() =>
                          onSelection({ kind: "aspect", id: aspectId(a) })
                        }
                      >
                        {chartPointName(a.from, language)} ·{" "}
                        {aspectName(a.type, language)} ·{" "}
                        {chartPointName(a.to, language)}
                      </button>
                    ))}
                </div>
                {article && (
                  <section className="astro-reflection">
                    <p className="astro-guide-eyebrow">
                      {at(language, "reflection")}
                    </p>
                    <p>{article.question}</p>
                  </section>
                )}
              </>
            )}
            {h && (
              <>
                <p className="astro-detail-evidence">
                  {h.sign
                    ? signName(h.sign, language)
                    : at(language, "unavailable")}
                  {typeof h.degree === "number"
                    ? ` · ${h.degree.toFixed(1)}°`
                    : ""}
                </p>
                <p>{houseDescription(h.house, language)}</p>
                <div className="astro-placement-list">
                  {placements
                    .filter((p) => p.house === h.house)
                    .map((p) => (
                      <button
                        type="button"
                        key={p.body}
                        onClick={() =>
                          onSelection({ kind: "body", id: p.body })
                        }
                      >
                        {chartPointName(p.body, language)} ·{" "}
                        <PlacementValue chart={chart} body={p.body} />
                      </button>
                    ))}
                </div>
              </>
            )}
            {a && (
              <>
                {aspectReading(a.from, a.to, a.type, language).map(
                  (text, i) => (
                    <p key={i}>{text}</p>
                  ),
                )}
                {typeof a.orb === "number" && (
                  <p className="astro-detail-evidence">
                    {rt(language, "orb")} ·{" "}
                    {new Intl.NumberFormat(language, {
                      maximumFractionDigits: 4,
                    }).format(a.orb)}
                    °
                  </p>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent
          onCloseAutoFocus={restoreFocus}
          className="astro-theme astro-detail-dialog astro-zoom-dialog"
        >
          <DialogTitle>{chartTitle}</DialogTitle>
          <DialogDescription>{at(language, "wheelHelp")}</DialogDescription>
          <div className="astro-dialog-scroll">
            <div className="astro-zoom-canvas">
              <NatalWheel variant="traditional" chart={chart} selection={selection ?? highlight} layers={layers}
                onSelect={(next) => {
                  setZoom(false);
                  onSelection(next);
                }} />
            </div>
            <div className="astro-placement-list">
              {placements.map((p) => (
                <button
                  type="button"
                  key={p.body}
                  onClick={() => {
                    setZoom(false);
                    onSelection({ kind: "body", id: p.body });
                  }}
                >
                  <span>{chartPointName(p.body, language)}</span>
                  <PlacementValue chart={chart} body={p.body} />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export function TransitReading({
  chart,
  transits,
  loading,
  error,
  range,
  onRange,
  onRefresh,
  onPlacement,
}: {
  chart: NatalChart;
  transits: AstroTransitsResponse | null;
  loading: boolean;
  error: string;
  range: "daily" | "weekly";
  onRange: (range: "daily" | "weekly") => void;
  onRefresh: () => void;
  onPlacement: (body: string) => void;
}) {
  const { language } = useLanguage();
  const live = transits?.source === "astrologyapi" && transits.mode === "live";
  return (
    <div className="astro-guide-stack astro-page-enter">
      <AstroPanel
        eyebrow={at(language, "now")}
        title={at(language, "transitTitle")}
      >
        <p>{at(language, "transitIntro")}</p>
        <div className="astro-period-tabs">
          {(["daily", "weekly"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={range === value}
              onClick={() => onRange(value)}
            >
              {at(language, value === "daily" ? "today" : "week")}
            </button>
          ))}
        </div>
        <button
          className="astro-guide-link"
          type="button"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? at(language, "loading") : at(language, "refresh")}
        </button>
        {loading && <p role="status">{at(language, "loading")}</p>}
        {error && <p role="alert">{error}</p>}
        {live && (
          <p className="astro-guide-note">
            {at(language, "calculated")} · {chartDate(transits.date, language)}
          </p>
        )}
      </AstroPanel>
      {live &&
        !loading &&
        (transits.transits.length ? (
          transits.transits.map((row) => {
            const body = canonicalBody(row.natalPlanet);
            const available =
              body && chart.placements.some((p) => p.body === body);
            return (
              <AstroPanel
                key={row.id}
                eyebrow={at(language, "evidence")}
                title={aspectName(row.aspect, language)}
              >
                <div className="astro-transit-connection">
                  <div>
                    <small>{at(language, "moving")}</small>
                    <strong>{bodyName(row.transitPlanet, language)}</strong>
                  </div>
                  <ArrowRight size={18} />
                  <div>
                    {available ? (
                      <button type="button" onClick={() => onPlacement(body!)}>
                        <small>{at(language, "natal")}</small>
                        <strong>{bodyName(row.natalPlanet, language)}</strong>
                      </button>
                    ) : (
                      <>
                        <small>{at(language, "natal")}</small>
                        <strong>{bodyName(row.natalPlanet, language)}</strong>
                        <small>{at(language, "unavailable")}</small>
                      </>
                    )}
                  </div>
                </div>
                <p>{aspectDescription(row.aspect, language)}</p>
                <p>{bodyDescription(row.transitPlanet, language)}</p>
                <details>
                  <summary>{at(language, "timing")}</summary>
                  {[row.startDate, row.peakDate, row.endDate].filter(Boolean)
                    .length ? (
                    <dl>
                      {(
                        [
                          ["starts", row.startDate],
                          ["exact", row.peakDate],
                          ["ends", row.endDate],
                        ] as const
                      ).map(([key, date]) =>
                        date ? (
                          <div key={key}>
                            <dt>{at(language, key)}</dt>
                            <dd>{chartDate(date, language, true)}</dd>
                          </div>
                        ) : null,
                      )}
                    </dl>
                  ) : (
                    <p>{at(language, "noTiming")}</p>
                  )}
                  {typeof row.orb === "number" && (
                    <p>
                      {at(language, "orb")} ·{" "}
                      {new Intl.NumberFormat(language, {
                        maximumFractionDigits: 4,
                      }).format(row.orb)}
                      °
                    </p>
                  )}
                </details>
              </AstroPanel>
            );
          })
        ) : (
          <AstroPanel title={at(language, "now")}>
            <p>{at(language, "noTransits")}</p>
          </AstroPanel>
        ))}
    </div>
  );
}

import { useChartDialogFocus } from "../useChartDialogFocus";
import { readReportSelection, writeReportSelection } from "../reportLocation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, BookOpen, Check, Bookmark } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { historyClearVersion } from "@/lib/clearHistory";
import { getAnonId } from "@/lib/identity";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { NatalChart } from "@/types/astrology";
import {
  createLetter,
  type CelestialLetter,
  type ReportEvidence,
  aspectKey,
  crossAspectKey,
  placementLabel,
  degreeText,
} from "../reportModel";
import { saveLetter } from "../reportStore";
import { useLetters } from "../useLetters";
import { rt } from "../reportCopy";
import { at } from "../astrologyCopy";
import {
  bodyName,
  aspectName,
  signName,
  signArticle,
  houseDescription,
} from "../astrologyLibrary";
import {
  aspectReading,
  placementReading,
  placementHouseReading,
} from "../interpretationLibrary";
import { NatalWheel } from "./NatalWheel";
import { ComparisonChart, SynastryWheel } from "./ComparisonChart";

export const zodiacArt = (sign: string) =>
  `${import.meta.env.BASE_URL}astrology/pearl-zodiac/${sign}.webp`;
export function ElementDistribution({ chart }: { chart: NatalChart }) {
  const { language } = useLanguage();
  const total = chart.placements.filter(
    (p) => p.body !== "rising" && p.sign,
  ).length;
  const elements = (["fire", "earth", "air", "water"] as const).map(
    (key, i) => ({
      key,
      name: signArticle(
        (["aries", "taurus", "gemini", "cancer"] as const)[i],
        language,
      ).element,
      value: chart.elementBalance[key],
    }),
  );
  const modes = (["cardinal", "fixed", "mutable"] as const).map((key, i) => ({
    key,
    name: signArticle((["aries", "taurus", "gemini"] as const)[i], language)
      .modality,
    value: chart.modalityBalance[key],
  }));
  return (
    <section className="astro-distribution">
      <h3>{rt(language, "balance")}</h3>
      <div className="astro-balance-bars">
        {[...elements, ...modes].map((row) => (
          <div key={row.key}>
            <span>{row.name}</span>
            <span className="astro-bar-track">
              <i
                style={{
                  width: total ? `${(row.value / total) * 100}%` : "0%",
                }}
              />
            </span>
            <span>
              {row.value}/{total}
            </span>
          </div>
        ))}
      </div>
      <p className="astro-guide-note">{rt(language, "balanceNote")}</p>
      <p className="astro-guide-note">
        {chart.placements
          .filter((p) => p.body !== "rising" && p.sign)
          .map((p) => bodyName(p.body, language))
          .join(" · ")}
      </p>
    </section>
  );
}
export function CelestialReport({
  letter,
  onBack,
}: {
  letter: CelestialLetter;
  onBack?: () => void;
}) {
  const { language } = useLanguage();
  const dialogFocus = useChartDialogFocus();
  const copy = letter.text[language];
  const [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(Boolean(letter.savedAt)),
    [error, setError] = useState(false);
  const [selection, setSelection] = useState<ReportEvidence | null>(() =>
    readReportSelection(),
  );
  const inFlight = useRef(false),
    current = useRef(letter.id);
  current.current = letter.id;
  useEffect(() => {
    setSaved(Boolean(letter.savedAt));
    setError(false);
    setSaving(false);
    inFlight.current = false;
  }, [letter.id, letter.savedAt]);
  useEffect(() => {
    const sync = () => setSelection(readReportSelection());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const select = (s: ReportEvidence | null) => {
    setSelection(s);
    writeReportSelection(s);
  };
  const chart =
    selection?.person === "partner"
      ? (letter.charts.partner ?? letter.charts.user)
      : letter.charts.user;
  const placement =
    selection?.kind === "body"
      ? chart.placements.find((p) => p.body === selection.id)
      : null;
  const house =
    selection?.kind === "house"
      ? chart.houses.find((h) => String(h.house) === selection.id)
      : null;
  const cross =
    selection?.kind === "aspect" &&
    letter.kind === "synastry" &&
    !selection.person
      ? letter.synastry?.aspects.find((a) => crossAspectKey(a) === selection.id)
      : null;
  const aspect =
    selection?.kind === "aspect" &&
    (letter.kind === "natal" || selection.person)
      ? chart.aspects.find((a) => aspectKey(a) === selection.id)
      : null;
  const selectedTitle = placement
    ? `${chart.birthProfile.name} · ${placementLabel(placement, language)}`
    : house
      ? `${at(language, "house")} ${house.house} · ${house.sign ? signName(house.sign, language) : at(language, "unavailable")} · ${typeof house.degree === "number" ? degreeText(house.degree, language) : at(language, "unavailable")}`
      : cross
        ? `${letter.charts.user.birthProfile.name} · ${bodyName(cross.from, language)} → ${letter.charts.partner?.birthProfile.name} · ${bodyName(cross.to, language)} · ${aspectName(cross.type, language)}`
        : aspect
          ? `${bodyName(aspect.from, language)} · ${aspectName(aspect.type, language)} · ${bodyName(aspect.to, language)}`
          : at(language, "missingSelection");
  async function save() {
    if (inFlight.current || saved) return;
    inFlight.current = true;
    setSaving(true);
    setError(false);
    const id = letter.id;
    const result = await saveLetter(letter);
    if (current.current === id) {
      setSaving(false);
      setSaved(result.ok);
      setError(!result.ok);
      inFlight.current = false;
    }
  }
  const cover = letter.charts.user.sunSign;
  return (
    <article
      ref={dialogFocus.root}
      onClickCapture={dialogFocus.remember}
      onKeyDownCapture={dialogFocus.remember}
      className="astro-letter astro-guide-stack astro-page-enter"
      data-testid="celestial-report"
    >
      {onBack && (
        <button type="button" className="astro-guide-link" onClick={onBack}>
          <ArrowLeft size={16} />
          {rt(language, "reports")}
        </button>
      )}
      <header className="astro-letter-cover">
        {cover && (
          <img src={zodiacArt(cover)} alt="" width="800" height="800" />
        )}
        <div>
          <p className="astro-guide-eyebrow">
            {letter.kind === "synastry"
              ? rt(language, "togetherEyebrow")
              : at(language, "birthSky")}
          </p>
          <h2>{copy.title}</h2>
          <p className="astro-letter-recipient">
            {letter.charts.user.birthProfile.name}
            {letter.charts.partner
              ? ` & ${letter.charts.partner.birthProfile.name}`
              : ""}
          </p>
          <p className="astro-guide-note">
            {new Date(letter.createdAt).toLocaleDateString(language, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </header>
      <p>{rt(language, "snapshot")}</p>
      {letter.partial && (
        <aside className="astro-report-partial">
          <strong>{rt(language, "partial")}</strong>
          <p>{rt(language, "partialNote")}</p>
        </aside>
      )}
      <button
        type="button"
        className="astro-guide-button"
        disabled={saving || saved}
        onClick={() => void save()}
      >
        {saved ? <Check size={17} /> : <Bookmark size={17} />}{" "}
        {rt(language, saving ? "saving" : saved ? "saved" : "save")}
      </button>
      {error && (
        <div role="alert">
          <p>{rt(language, "saveError")}</p>
          <button
            type="button"
            className="astro-guide-link"
            onClick={() => void save()}
          >
            {rt(language, "retry")}
          </button>
        </div>
      )}
      <nav
        className="astro-letter-contents"
        aria-label={rt(language, "contents")}
      >
        <h3>{rt(language, "contents")}</h3>
        {copy.chapters.map((chapter, i) => (
          <a
            key={chapter.id}
            href={`#letter-${chapter.id}`}
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById(`letter-${chapter.id}`)
                ?.scrollIntoView({ block: "start" });
              document
                .getElementById(`letter-${chapter.id}`)
                ?.focus({ preventScroll: true });
            }}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            {chapter.title}
            <ArrowRight size={14} />
          </a>
        ))}
      </nav>
      {letter.charts.partner && letter.synastry ? (
        <ComparisonChart
          user={letter.charts.user}
          partner={letter.charts.partner}
          result={letter.synastry}
          onEvidence={select}
        />
      ) : (
        <>
          <NatalWheel
            chart={letter.charts.user}
            selection={selection}
            onSelect={select}
          />
          <ElementDistribution chart={letter.charts.user} />
        </>
      )}
      {copy.chapters.map((chapter, i) => (
        <section
          className="astro-letter-chapter"
          id={`letter-${chapter.id}`}
          tabIndex={-1}
          key={chapter.id}
        >
          <p className="astro-guide-eyebrow">
            {String(i + 1).padStart(2, "0")}
          </p>
          <h2>{chapter.title}</h2>
          {chapter.passages.length ? (
            chapter.passages.map((passage, index) => (
              <div className="astro-letter-passage" key={index}>
                <h3>{passage.title}</h3>
                {passage.paragraphs.map((text, j) => (
                  <p key={j}>{text}</p>
                ))}
                {passage.evidence.map((e, j) => (
                  <button
                    type="button"
                    key={j}
                    className="astro-guide-link"
                    onClick={() => select(e)}
                  >
                    {rt(language, "evidence")}
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            ))
          ) : (
            <p className="astro-guide-note">{rt(language, "unavailable")}</p>
          )}
        </section>
      ))}
      <details className="astro-library-details">
        <summary>{at(language, "birth")}</summary>
        {Object.values(letter.charts).map((c) => (
          <div key={c.id}>
            <h3>{c.birthProfile.name}</h3>
            <p>
              {c.birthProfile.birthDate} ·{" "}
              {c.birthProfile.birthTime ?? at(language, "unknownTime")} ·{" "}
              {c.birthProfile.birthPlace}
            </p>
            <p>
              {at(language, "calculated")} ·{" "}
              {new Date(c.calculatedAt).toLocaleString(language)}
            </p>
            <p>
              {at(language, "system")} ·{" "}
              {c.calculation?.zodiacSystem ?? at(language, "unavailable")} ·{" "}
              {c.calculation?.houseSystem ?? at(language, "unavailable")}
            </p>
          </div>
        ))}
        <p className="astro-guide-note">{letter.contentVersion}</p>
      </details>
      <Dialog
        open={Boolean(selection)}
        onOpenChange={(open) => {
          if (!open) select(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={dialogFocus.restore}
          className="astro-theme astro-detail-dialog astro-letter-detail"
        >
          <div className="astro-dialog-scroll">
            <DialogTitle>{selectedTitle}</DialogTitle>
            <DialogDescription className="astro-dialog-description">
              {rt(language, "evidence")}
            </DialogDescription>

            {cross && letter.charts.partner && letter.synastry ? (
              <SynastryWheel
                user={letter.charts.user}
                partner={letter.charts.partner}
                result={letter.synastry}
                selection={selection}
              />
            ) : (
              <NatalWheel chart={chart} selection={selection} />
            )}
            {placement
              ? [
                  ...placementReading(placement, language),
                  ...placementHouseReading(placement, language),
                ].map((p, i) => <p key={i}>{p}</p>)
              : null}
            {aspect || cross ? (
              <>
                <p className="astro-detail-evidence">
                  {rt(language, "orb")}:{" "}
                  {typeof (aspect ?? cross)?.orb === "number"
                    ? degreeText((aspect ?? cross)!.orb!, language)
                    : at(language, "unavailable")}
                </p>
                {cross && (
                  <p className="astro-detail-evidence">
                    {rt(language, "separation")}:{" "}
                    {typeof cross.separation === "number"
                      ? degreeText(cross.separation, language)
                      : at(language, "unavailable")}
                  </p>
                )}
                {aspectReading(
                  (aspect ?? cross)!.from,
                  (aspect ?? cross)!.to,
                  (aspect ?? cross)!.type,
                  language,
                  Boolean(cross),
                ).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </>
            ) : null}
            {house && <p>{houseDescription(house.house, language)}</p>}
            {house
              ? chart.placements
                  .filter((p) => p.house === house.house)
                  .map((p) => (
                    <div key={p.body}>
                      <h3>{placementLabel(p, language)}</h3>
                      {placementHouseReading(p, language).map((text, i) => (
                        <p key={i}>{text}</p>
                      ))}
                    </div>
                  ))
              : null}
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}
export function SavedLetters({
  owner = getAnonId(),
  onOpen,
}: {
  owner?: string;
  onOpen?: (letter: CelestialLetter) => void;
}) {
  const { language } = useLanguage();
  const { rows, loading, error, retry } = useLetters(owner);
  return (
    <section className="astro-saved-letters" data-testid="saved-letters">
      <h2>{rt(language, "archive")}</h2>
      {loading && <p role="status">{at(language, "loading")}</p>}
      {error && (
        <div role="alert">
          <p>{rt(language, "loadError")}</p>
          <button className="astro-guide-link" type="button" onClick={retry}>
            {rt(language, "retry")}
          </button>
        </div>
      )}
      {!loading && !error && !rows.length && <p>{rt(language, "empty")}</p>}
      <div className="astro-letter-list">
        {rows.map((letter) => {
          const content = (
            <>
              <BookOpen size={20} />
              <span>
                <strong>{letter.text[language].title}</strong>
                <small>
                  {letter.charts.user.birthProfile.name}
                  {letter.charts.partner
                    ? ` & ${letter.charts.partner.birthProfile.name}`
                    : ""}{" "}
                  · {new Date(letter.createdAt).toLocaleDateString(language)}
                </small>
              </span>
              <ArrowRight size={16} />
            </>
          );
          return onOpen ? (
            <button
              type="button"
              key={letter.id}
              onClick={() => onOpen(letter)}
            >
              {content}
            </button>
          ) : (
            <Link
              key={letter.id}
              href={`/app/astrology?tab=reports&report=${encodeURIComponent(letter.id)}`}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
export function ReportLibrary({
  owner,
  chart,
  onCreate,
  onTogether,
}: {
  owner: string;
  chart: NatalChart | null;
  onCreate: () => void;
  onTogether: () => void;
}) {
  const { language } = useLanguage();
  const archive = useLetters(owner);
  const [id, setId] = useState(() =>
    new URLSearchParams(window.location.search).get("report"),
  );
  useEffect(() => {
    const sync = () =>
      setId(new URLSearchParams(window.location.search).get("report"));
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const version = historyClearVersion(owner);
  const current = useMemo(
    () => (chart ? createLetter(owner, version, chart, language) : null),
    [chart, owner, version],
  );
  const selected =
    id === "current"
      ? current &&
        (archive.rows.find((row) => row.id === current.id) ?? current)
      : archive.rows.find((row) => row.id === id);
  const open = (next: string | null) => {
    const url = new URL(window.location.href);
    ["report", "body", "house", "aspect", "person"].forEach((k) =>
      url.searchParams.delete(k),
    );
    if (next) url.searchParams.set("report", next);
    window.history.pushState(
      window.history.state,
      "",
      url.pathname + url.search,
    );
    setId(next);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  if (selected)
    return (
      <CelestialReport
        key={selected.id}
        letter={selected}
        onBack={() => open(null)}
      />
    );
  return (
    <div className="astro-guide-stack">
      <header className="astro-report-intro">
        <BookOpen size={26} />
        <h2>{rt(language, "reports")}</h2>
        <p>{rt(language, "partialNote")}</p>
      </header>
      {id && (
        <div role="status">
          <p>
            {archive.loading
              ? at(language, "loading")
              : rt(language, "loadError")}
          </p>
          <button
            type="button"
            className="astro-guide-link"
            onClick={archive.retry}
          >
            {rt(language, "retry")}
          </button>
        </div>
      )}
      <button
        type="button"
        className="astro-secondary-entry"
        onClick={() => (current ? open("current") : onCreate())}
      >
        <BookOpen size={25} />
        <span>
          <strong>{rt(language, "natal")}</strong>
          <small>
            {current ? rt(language, "open") : at(language, "create")}
          </small>
        </span>
        <ArrowRight size={17} />
      </button>
      <button
        type="button"
        className="astro-secondary-entry"
        onClick={onTogether}
      >
        <span>
          <strong>{rt(language, "together")}</strong>
          <small>{at(language, "togetherIntro")}</small>
        </span>
        <ArrowRight size={17} />
      </button>
      <SavedLetters owner={owner} onOpen={(letter) => open(letter.id)} />
    </div>
  );
}

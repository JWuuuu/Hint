import { useChartDialogFocus } from "../useChartDialogFocus";
import { readReportSelection, writeReportSelection } from "../reportLocation";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import type { AstroSynastryResponse, NatalChart } from "@/types/astrology";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { NatalWheel, longitude, BODY_SYMBOLS, SIGN_PATHS } from "./NatalWheel";
import {
  bodyName,
  aspectName,
  houseDescription,
  signName,
} from "../astrologyLibrary";
import {
  aspectReading,
  placementReading,
  placementHouseReading,
} from "../interpretationLibrary";
import {
  crossAspectKey,
  aspectKey,
  degreeText,
  placementLabel,
  type ReportEvidence,
} from "../reportModel";
import { rt } from "../reportCopy";
import { at } from "../astrologyCopy";

export function SynastryWheel({
  user,
  partner,
  result,
  selection,
  onSelect,
}: {
  user: NatalChart;
  partner: NatalChart;
  result: AstroSynastryResponse;
  selection?: ReportEvidence | null;
  onSelect?: (s: ReportEvidence) => void;
}) {
  const { language } = useLanguage();
  const point = (angle: number, radius: number) => ({
    x: Math.cos(((180 - angle) * Math.PI) / 180) * radius,
    y: Math.sin(((180 - angle) * Math.PI) / 180) * radius,
  });
  const points = (["user", "partner"] as const).flatMap((person) =>
    (person === "user" ? user : partner).placements.flatMap((p) => {
      const angle = longitude(p.sign, p.degree);
      return angle === null
        ? []
        : [
            {
              ...p,
              person,
              longitude: angle,
              ...point(angle, person === "user" ? 111 : 88),
            },
          ];
    }),
  );
  const labels = [-1, 1].flatMap((side) => {
    const rows = points
      .filter((p) => (p.x < 0 ? -1 : 1) === side)
      .sort((a, b) => a.y - b.y);
    const ys = rows.map((p, i) => Math.max(p.y, -145 + i * 14));
    for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + 14);
    const shift = Math.max(0, (ys.at(-1) ?? 0) - 145);
    return rows.map((p, i) => ({ ...p, labelY: ys[i] - shift, side }));
  });
  return (
    <svg
      className="astro-comparison-wheel"
      viewBox="-210 -170 420 340"
      role="group"
      aria-label={rt(language, "both")}
      data-testid="synastry-wheel"
    >
      <circle r="143" fill="var(--astro-pearl)" stroke="var(--astro-border)" />
      {[111, 88].map((r, i) => (
        <circle
          key={r}
          r={r}
          fill="none"
          className={`astro-person-${i ? "partner" : "user"}`}
          stroke="currentColor"
          strokeOpacity=".3"
          strokeDasharray={i ? "3 4" : undefined}
        />
      ))}
      {Array.from({ length: 12 }, (_, i) => {
        const a = point(i * 30, 124),
          b = point(i * 30, 140),
          label = point(i * 30 + 15, 132);
        return (
          <g key={i}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--astro-border)"
            />
            <svg
              x={label.x - 7}
              y={label.y - 7}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--astro-muted)"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={SIGN_PATHS[i]} />
            </svg>
          </g>
        );
      })}
      {result.aspects.map((a) => {
        const from = points.find(
            (p) => p.person === "user" && p.body === a.from,
          ),
          to = points.find((p) => p.person === "partner" && p.body === a.to);
        if (!from || !to) return null;
        const selected =
          selection?.kind === "aspect"
            ? selection.id === crossAspectKey(a)
            : selection?.kind === "body"
              ? (selection.person === "partner" ? a.to : a.from) ===
                selection.id
              : false;
        return (
          <line
            key={crossAspectKey(a)}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={
              ["square", "opposition"].includes(a.type)
                ? "var(--astro-rose)"
                : "var(--astro-lavender)"
            }
            strokeWidth={selected ? 2 : 0.6}
            opacity={selected ? 0.9 : selection ? 0.06 : 0.2}
          />
        );
      })}
      {labels.map((p) => {
        const selected =
          selection?.kind === "body" &&
          selection.id === p.body &&
          (selection.person ?? "user") === p.person;
        const x = p.side * 169;
        return (
          <g
            key={`${p.person}:${p.body}`}
            className={`astro-person-${p.person}`}
          >
            <line
              x1={p.x}
              y1={p.y}
              x2={x - p.side * 9}
              y2={p.labelY}
              stroke="currentColor"
              strokeOpacity={selected ? 0.8 : 0.27}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={selected ? 5 : 3}
              fill="currentColor"
              data-longitude={p.longitude}
              data-person={p.person}
            />
            <g
              role={onSelect ? "button" : undefined}
              aria-pressed={onSelect ? selected : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={`${p.person === "user" ? user.birthProfile.name : partner.birthProfile.name} · ${placementLabel(p, language)}`}
              onClick={() =>
                onSelect?.({ kind: "body", id: p.body, person: p.person })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.({ kind: "body", id: p.body, person: p.person });
                }
              }}
            >
              <rect
                x={x - 16}
                y={p.labelY - 7}
                width="32"
                height="14"
                fill="var(--astro-pearl)"
                rx="6"
              />
              <text
                x={x}
                y={p.labelY}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="11"
                fill="currentColor"
              >
                {BODY_SYMBOLS[p.body]}
                {p.retrograde ? " ℞" : ""}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
export function ComparisonChart({
  user,
  partner,
  result,
  onEvidence,
}: {
  user: NatalChart;
  partner: NatalChart;
  result: AstroSynastryResponse;
  onEvidence?: (selection: ReportEvidence) => void;
}) {
  const { language } = useLanguage();
  const dialogFocus = useChartDialogFocus();
  const [zoom, setZoom] = useState(false);
  const [view, setView] = useState<"both" | "user" | "partner" | "list">(
    "both",
  );
  const [selection, setSelection] = useState<ReportEvidence | null>(() =>
      onEvidence ? null : readReportSelection(),
    ),
    [highlight, setHighlight] = useState<ReportEvidence | null>(null);
  const select = (s: ReportEvidence) => {
    setHighlight(s);
    if (onEvidence) {
      onEvidence(s);
      return;
    }
    setSelection(s);
    writeReportSelection(s);
  };
  useEffect(() => {
    if (onEvidence) return;
    const sync = () => setSelection(readReportSelection());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [onEvidence]);
  const aspect =
    selection?.kind === "aspect" && !selection.person
      ? result.aspects.find((a) => crossAspectKey(a) === selection.id)
      : null;
  const person = selection?.person === "partner" ? partner : user;
  const placement =
    selection?.kind === "body"
      ? person.placements.find((p) => p.body === selection.id)
      : null;
  const natalAspect =
    selection?.kind === "aspect" && selection.person
      ? person.aspects.find((a) => aspectKey(a) === selection.id)
      : null;
  const house =
    selection?.kind === "house"
      ? person.houses.find((h) => String(h.house) === selection.id)
      : null;
  const personLabel = (which: "user" | "partner") => (
    <span className={`astro-person-${which}`}>
      <i aria-hidden="true">{which === "user" ? "●" : "◇"}</i>{" "}
      {which === "user" ? user.birthProfile.name : partner.birthProfile.name}
    </span>
  );
  const connectionLabel = (a: AstroSynastryResponse["aspects"][number]) =>
    `${user.birthProfile.name} · ${bodyName(a.from, language)} → ${partner.birthProfile.name} · ${bodyName(a.to, language)}`;
  return (
    <section
      ref={dialogFocus.root}
      onClickCapture={dialogFocus.remember}
      onKeyDownCapture={dialogFocus.remember}
      className="astro-guide-stack astro-comparison"
      data-testid="comparison-chart"
    >
      <div
        className="astro-chart-modes"
        role="group"
        aria-label={rt(language, "layers")}
      >
        {(["both", "user", "partner", "list"] as const).map((key) => (
          <button
            type="button"
            key={key}
            aria-pressed={view === key}
            onClick={() => setView(key)}
          >
            {key === "user"
              ? personLabel("user")
              : key === "partner"
                ? personLabel("partner")
                : rt(language, key)}
          </button>
        ))}
      </div>
      {view === "both" ? (
        <SynastryWheel
          user={user}
          partner={partner}
          result={result}
          selection={selection ?? highlight}
          onSelect={select}
        />
      ) : view !== "list" ? (
        <NatalWheel
          chart={view === "user" ? user : partner}
          selection={selection ?? highlight}
          onSelect={(s) => select({ ...s, person: view })}
        />
      ) : null}
      {view !== "list" && (
        <button
          type="button"
          className="astro-guide-link"
          onClick={() => setZoom(true)}
        >
          {at(language, "zoom")}
        </button>
      )}
      <div className="astro-comparison-legend">
        {personLabel("user")}
        {personLabel("partner")}
      </div>
      {view === "user" || view === "partner" ? (
        <div className="astro-placement-list">
          {(view === "user" ? user : partner).placements.map((p) => (
            <button
              type="button"
              key={p.body}
              onClick={() => select({ kind: "body", id: p.body, person: view })}
            >
              {placementLabel(p, language)}
            </button>
          ))}
        </div>
      ) : null}
      <details open={view === "list"} className="astro-library-details">
        <summary>
          {rt(language, "list")} · {result.aspects.length}
        </summary>
        <div className="astro-placement-list">
          {result.aspects.map((a) => (
            <button
              type="button"
              key={crossAspectKey(a)}
              data-selected={highlight?.id === crossAspectKey(a)}
              onClick={() => select({ kind: "aspect", id: crossAspectKey(a) })}
            >
              <span>{connectionLabel(a)}</span>
              <span>
                {aspectName(a.type, language)}
                <small>
                  {rt(language, "orb")} ·{" "}
                  {typeof a.orb === "number"
                    ? degreeText(a.orb, language)
                    : at(language, "unavailable")}
                </small>
              </span>
            </button>
          ))}
        </div>
        {!result.aspects.length && <p>{rt(language, "unavailable")}</p>}
      </details>
      <details className="astro-library-details">
        <summary>{at(language, "system")}</summary>
        <p>{rt(language, "policy")}</p>
        <p className="astro-guide-note">
          {result.calculation?.method} · {result.calculation?.zodiacSystem} ·{" "}
          {new Date(result.fetchedAt).toLocaleString(language)}
        </p>
      </details>
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent
          onCloseAutoFocus={dialogFocus.restore}
          className="astro-theme astro-detail-dialog astro-letter-detail astro-zoom-dialog"
        >
          <div className="astro-dialog-scroll">
            <DialogTitle>
              {view === "both" ? rt(language, "both") : at(language, "wheel")}
            </DialogTitle>
            <DialogDescription className="astro-dialog-description">
              {at(language, "wheelHelp")}
            </DialogDescription>

            <div className="astro-zoom-canvas">
              {view === "both" ? (
                <SynastryWheel
                  user={user}
                  partner={partner}
                  result={result}
                  selection={selection ?? highlight}
                />
              ) : (
                <NatalWheel
                  chart={view === "partner" ? partner : user}
                  selection={selection ?? highlight}
                />
              )}
            </div>
            <div className="astro-placement-list">
              {(["user", "partner"] as const)
                .filter((person) => view === "both" || person === view)
                .flatMap((person) =>
                  (person === "user" ? user : partner).placements.map((p) => (
                    <button
                      type="button"
                      key={`${person}:${p.body}`}
                      onClick={() => {
                        setZoom(false);
                        select({ kind: "body", id: p.body, person });
                      }}
                    >
                      {personLabel(person)} · {placementLabel(p, language)}
                    </button>
                  )),
                )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(aspect || placement || natalAspect || house)}
        onOpenChange={(open) => {
          if (!open) {
            setSelection(null);
            writeReportSelection(null);
          }
        }}
      >
        <DialogContent
          onCloseAutoFocus={dialogFocus.restore}
          className="astro-theme astro-detail-dialog astro-letter-detail"
        >
          <div className="astro-dialog-scroll">
            <DialogTitle>
              {aspect
                ? connectionLabel(aspect)
                : placement
                  ? `${person.birthProfile.name} · ${placementLabel(placement, language)}`
                  : natalAspect
                    ? `${bodyName(natalAspect.from, language)} · ${aspectName(natalAspect.type, language)} · ${bodyName(natalAspect.to, language)}`
                    : house
                      ? `${person.birthProfile.name} · ${at(language, "house")} ${house.house}`
                      : ""}
            </DialogTitle>
            <DialogDescription className="astro-dialog-description">
              {rt(language, "evidence")}
            </DialogDescription>

            {aspect ? (
              <>
                <SynastryWheel
                  user={user}
                  partner={partner}
                  result={result}
                  selection={selection}
                />
                <h3>{aspectName(aspect.type, language)}</h3>
                <p className="astro-detail-evidence">
                  {rt(language, "orb")} ·{" "}
                  {typeof aspect.orb === "number"
                    ? degreeText(aspect.orb, language)
                    : at(language, "unavailable")}
                  <br />
                  {rt(language, "separation")} ·{" "}
                  {typeof aspect.separation === "number"
                    ? degreeText(aspect.separation, language)
                    : at(language, "unavailable")}
                </p>
                {aspectReading(
                  aspect.from,
                  aspect.to,
                  aspect.type,
                  language,
                  true,
                ).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </>
            ) : placement ? (
              <>
                <NatalWheel chart={person} selection={selection} />
                {[
                  ...placementReading(placement, language),
                  ...placementHouseReading(placement, language),
                ].map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </>
            ) : natalAspect ? (
              <>
                <NatalWheel chart={person} selection={selection} />
                <p>
                  {rt(language, "orb")} ·{" "}
                  {typeof natalAspect.orb === "number"
                    ? degreeText(natalAspect.orb, language)
                    : at(language, "unavailable")}
                </p>
                {aspectReading(
                  natalAspect.from,
                  natalAspect.to,
                  natalAspect.type,
                  language,
                ).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </>
            ) : house ? (
              <>
                <NatalWheel chart={person} selection={selection} />
                <p>
                  {house.sign
                    ? signName(house.sign, language)
                    : at(language, "unavailable")}{" "}
                  ·{" "}
                  {typeof house.degree === "number"
                    ? degreeText(house.degree, language)
                    : at(language, "unavailable")}
                </p>
                <p>{houseDescription(house.house, language)}</p>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

import { useId } from "react";
import { useLanguage } from "@/lib/i18n";
import type { NatalChart } from "@/types/astrology";
import { SIGN_ORDER, bodyName } from "../astrologyLibrary";
import { at } from "../astrologyCopy";
import type { ChartSelection } from "../chartState";

// Original line drawings, shared by the library and the calculated wheel.
export const SIGN_PATHS = [
  "M12 21V8C12-1 1 2 4 10M12 8C12-1 23 2 20 10",
  "M4 2C4 10 20 10 20 2M12 8a6 6 0 1 0 0 12a6 6 0 1 0 0-12",
  "M5 3Q12 6 19 3M5 21Q12 18 19 21M8 5V19M16 5V19",
  "M3 8C7 2 19 3 21 7M21 16C17 22 5 21 3 17M7 8a3 3 0 1 0 0 .1M17 16a3 3 0 1 0 0 .1",
  "M6 15a4 4 0 1 0 0 .1M8 12C1-2 23-1 17 11C11 20 21 23 22 17",
  "M3 20V5Q6 1 8 6V18M8 6Q12 0 13 6V18M13 6Q18 0 18 6V16Q18 23 22 20M15 12Q23 6 22 12Q21 19 15 20",
  "M3 20H21M3 15H8C-1 3 25 3 16 15H21",
  "M3 20V5Q6 1 8 6V18M8 6Q12 0 13 6V18M13 6Q18 0 18 6V16Q18 20 23 18M20 15L23 18L21 21",
  "M4 20L20 4M11 4H20V13M5 10L14 19",
  "M2 6L6 20L11 4C17 0 10 20 17 20a4 4 0 1 0-3-7M11 10L14 17",
  "M2 9L6 5L10 9L14 5L18 9L22 5M2 19L6 15L10 19L14 15L18 19L22 15",
  "M5 2Q16 12 5 22M19 2Q8 12 19 22M2 12H22",
];
export function ZodiacSymbol({
  index,
  className,
}: {
  index: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.15"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={SIGN_PATHS[index] ?? SIGN_PATHS[0]} />
    </svg>
  );
}
export const BODY_SYMBOLS: Record<string, string> = {
  sun: "☉",
  moon: "☽",
  rising: "↑",
  mercury: "☿",
  venus: "♀",
  mars: "♂",
  jupiter: "♃",
  saturn: "♄",
  uranus: "♅",
  neptune: "♆",
  pluto: "♇",
};
export const aspectId = (a: NatalChart["aspects"][number]) =>
  `${a.from}:${a.type}:${a.to}`;
export function longitude(sign?: string, degree?: number): number | null {
  const i = SIGN_ORDER.indexOf(sign as (typeof SIGN_ORDER)[number]);
  return i >= 0 &&
    typeof degree === "number" &&
    Number.isFinite(degree) &&
    degree >= 0 &&
    degree < 30
    ? i * 30 + degree
    : null;
}
const point = (degrees: number, radius: number, asc: number) => ({
  x: Math.cos(((180 - degrees + asc) * Math.PI) / 180) * radius,
  y: Math.sin(((180 - degrees + asc) * Math.PI) / 180) * radius,
});
/** Label leaders move; calculated points never do, including across the 359°/0° seam. */
export function wheelLayout(chart: NatalChart) {
  const rising = chart.placements.find((p) => p.body === "rising");
  const asc = longitude(rising?.sign, rising?.degree) ?? 0;
  const points = chart.placements.flatMap((p) => {
    const lon = longitude(p.sign, p.degree);
    return lon === null
      ? []
      : [{ ...p, longitude: lon, ...point(lon, 96, asc) }];
  });
  const labels = [-1, 1].flatMap((side) => {
    const sorted = points
      .filter((p) => (p.x < 0 ? -1 : 1) === side)
      .sort((a, b) => a.y - b.y || a.longitude - b.longitude);
    const ys = sorted.map((p, i) => Math.max(-113 + i * 20, p.y));
    for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + 20);
    if (ys.length && ys[ys.length - 1] > 113) {
      const offset = ys[ys.length - 1] - 113;
      ys.forEach((y, i) => {
        ys[i] = y - offset;
      });
    }
    return sorted.map((p, i) => ({ ...p, side, labelY: ys[i] }));
  });
  return { asc, points, labels };
}
export function NatalWheel({
  chart,
  selection,
  onSelect,
  layers = { planets: true, houses: true, aspects: true },
}: {
  chart: NatalChart;
  layers?: { planets: boolean; houses: boolean; aspects: boolean };
  selection?: ChartSelection | null;
  onSelect?: (selection: ChartSelection) => void;
}) {
  const { language } = useLanguage();
  const id = useId().replace(/:/g, "");
  const { asc, points, labels } = wheelLayout(chart);
  const selectedAspect = chart.aspects.find(
    (a) => selection?.kind === "aspect" && aspectId(a) === selection.id,
  );
  return (
    <svg
      className="astro-natal-wheel"
      viewBox="-190 -160 380 320"
      role="group"
      aria-label={at(language, "wheel")}
      data-testid="astro-wheel"
    >
      <defs>
        <radialGradient id={`${id}-pearl`}>
          <stop stopColor="var(--astro-pearl)" />
          <stop offset="1" stopColor="var(--astro-inner)" />
        </radialGradient>
      </defs>
      <circle
        r="143"
        fill={`url(#${id}-pearl)`}
        stroke="var(--astro-gold)"
        strokeOpacity=".35"
      />
      <circle
        className="astro-ring-draw"
        r="138"
        pathLength="1"
        fill="none"
        stroke="var(--astro-gold)"
        strokeWidth=".65"
      />
      <circle r="111" fill="none" stroke="var(--astro-border)" />
      <circle r="84" fill="var(--astro-pearl)" stroke="var(--astro-border)" />
      {Array.from({ length: 72 }, (_, i) => {
        const a = point(i * 5, 133, asc);
        const b = point(i * 5, i % 6 ? 136 : 138, asc);
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="var(--astro-gold)"
            strokeOpacity=".45"
          />
        );
      })}
      {SIGN_ORDER.map((sign, i) => {
        const a = point(i * 30, 111, asc);
        const b = point(i * 30, 138, asc);
        const p = point(i * 30 + 15, 123, asc);
        return (
          <g key={sign}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--astro-border)"
            />
            <svg
              x={p.x - 7.5}
              y={p.y - 7.5}
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--astro-text)"
              strokeWidth="1.25"
              strokeLinecap="round"
            >
              <path d={SIGN_PATHS[i]} />
            </svg>
          </g>
        );
      })}
      {layers.houses &&
        chart.houses.map((h) => {
          const lon = longitude(h.sign, h.degree);
          if (lon === null) return null;
          const a = point(lon, 26, asc);
          const b = point(lon, 110, asc);
          const p = point(lon + 3, 76, asc);
          return (
            <g
              key={h.house}
              opacity={
                selection?.kind === "house" && selection.id === String(h.house)
                  ? 1
                  : 0.55
              }
            >
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--astro-gold)"
                strokeDasharray="2 4"
              />
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="8"
                fill="var(--astro-muted)"
              >
                {h.house}
              </text>
            </g>
          );
        })}
      {layers.aspects &&
        chart.aspects.map((a, i) => {
          const from = points.find((p) => p.body === a.from);
          const to = points.find((p) => p.body === a.to);
          if (!from || !to) return null;
          const selected =
            selection?.kind === "aspect"
              ? selection.id === aspectId(a)
              : selection?.kind === "body"
                ? a.from === selection.id || a.to === selection.id
                : false;
          return (
            <line
              key={`${aspectId(a)}:${i}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className="astro-aspect-line"
              stroke={
                a.type === "square" || a.type === "opposition"
                  ? "var(--astro-rose)"
                  : "var(--astro-aqua)"
              }
              strokeWidth={selected ? 1.7 : 0.65}
              opacity={selected ? 0.9 : selection ? 0.12 : 0.32}
            />
          );
        })}
      <circle r="20" fill={`url(#${id}-pearl)`} stroke="var(--astro-border)" />
      <path
        d="M0-9L2-2L9 0L2 2L0 9L-2 2L-9 0L-2-2Z"
        fill="var(--astro-gold)"
        opacity=".6"
      />
      {layers.planets &&
        labels.map((p) => {
          const selected =
            (selection?.kind === "body" && selection.id === p.body) ||
            (selectedAspect &&
              [selectedAspect.from, selectedAspect.to].includes(p.body));
          return (
            <g
              key={p.body}
              data-body={p.body}
              data-selected={Boolean(selected)}
              className="astro-wheel-point"
            >
              <path
                d={`M${p.x} ${p.y}L${p.side * 147} ${p.labelY}L${p.side * 156} ${p.labelY}`}
                fill="none"
                stroke={selected ? "var(--astro-rose)" : "var(--astro-muted)"}
                strokeWidth={selected ? 1 : 0.5}
                opacity={selected ? 1 : 0.55}
              />
              <circle
                onClick={() => onSelect?.({ kind: "body", id: p.body })}
                cx={p.x}
                cy={p.y}
                r={selected ? 5 : 2.8}
                fill={selected ? "var(--astro-rose)" : "var(--astro-gold)"}
                stroke="var(--astro-pearl)"
                strokeWidth="1"
              />
              <g
              role={onSelect ? "button" : undefined}
              aria-pressed={onSelect ? Boolean(selected) : undefined}
                tabIndex={onSelect ? 0 : undefined}
                aria-label={bodyName(p.body, language)}
                onClick={() => onSelect?.({ kind: "body", id: p.body })}
                onKeyDown={(e) => {
                  if (onSelect && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onSelect({ kind: "body", id: p.body });
                  }
                }}
              >
                <circle
                  cx={p.side * 170}
                  cy={p.labelY}
                  r="11"
                  fill={
                    selected ? "var(--astro-selected)" : "var(--astro-pearl)"
                  }
                  stroke="var(--astro-border)"
                />
                <text
                  x={p.side * 170}
                  y={p.labelY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="14"
                  fill="var(--astro-text)"
                >
                  {BODY_SYMBOLS[p.body]}
                  {p.retrograde ? "ˎ" : ""}
                </text>
              </g>
            </g>
          );
        })}
    </svg>
  );
}

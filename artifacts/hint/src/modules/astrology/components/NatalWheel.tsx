import { useId } from "react";
import { useLanguage, type HintLanguage } from "@/lib/i18n";
import type { NatalChart } from "@/types/astrology";
import { SIGN_ORDER, bodyName } from "../astrologyLibrary";
import { astroText, at } from "../astrologyCopy";
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
export const CHART_POINT_SYMBOLS: Record<string, string> = {
  ...BODY_SYMBOLS,
  north_node: "☊",
  juno: "⚵",
};
export function chartPointName(body: string, language: HintLanguage) {
  if (body === "north_node") return astroText(language, ["North Node", "北交点", "Nodo norte", "ノースノード", "북쪽 노드"]);
  if (body === "juno") return astroText(language, ["Juno", "婚神星", "Juno", "ジュノー", "주노"]);
  return bodyName(body, language);
}
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
type NatalWheelProps = {
  chart: NatalChart;
  layers?: { planets: boolean; houses: boolean; aspects: boolean };
  selection?: ChartSelection | null;
  onSelect?: (selection: ChartSelection) => void;
};

const allLayers = { planets: true, houses: true, aspects: true };

export function NatalWheel({ variant, ...props }: NatalWheelProps & { variant?: "traditional" }) {
  return variant === "traditional" ? <TraditionalWheel {...props} /> : <GuidedWheel {...props} />;
}

function GuidedWheel({ chart, selection, onSelect, layers = allLayers }: NatalWheelProps) {
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

const quadrantHouseSystems = new Set([
  "placidus", "koch", "porphyry", "regiomontanus", "campanus", "alcabitius", "topocentric",
]);

export function usesQuadrantHouses(chart: NatalChart) {
  const system = chart.calculation?.houseSystem?.trim().toLowerCase().replace(/[\s_-]+houses?$/, "");
  return system !== undefined && quadrantHouseSystems.has(system);
}

function bodyKey(body: string) {
  const compact = body.toLowerCase().replace(/[\s_-]/g, "");
  if (compact === "asc" || compact === "ascendant") return "rising";
  return compact === "northnode" ? "north_node" : compact;
}

function TraditionalWheel({ chart, selection, onSelect, layers = allLayers }: NatalWheelProps) {
  const { language } = useLanguage();
  const placements = new Map([...chart.placements, ...(chart.additionalPlacements ?? [])].flatMap((placement) => {
    const lon = longitude(placement.sign, placement.degree);
    return lon === null ? [] : [[bodyKey(placement.body), { ...placement, lon }] as const];
  }));
  const cusps = new Map(chart.houses.flatMap((house) => {
    const lon = longitude(house.sign, house.degree);
    return lon === null || !Number.isInteger(house.house) || house.house < 1 || house.house > 12
      ? [] : [[house.house, lon] as const];
  }));
  const ascendant = placements.get("rising");
  const orientation = ascendant?.lon ?? cusps.get(1) ?? 0;
  const midheaven = placements.get("midheaven")?.lon ?? placements.get("mc")?.lon
    ?? (usesQuadrantHouses(chart) ? cusps.get(10) : undefined);
  const axes = [
    { start: "ASC", end: "DSC", lon: ascendant?.lon, body: ascendant?.body },
    { start: "MC", end: "IC", lon: midheaven },
  ];
  const aspectPoints = new Map(Array.from(placements, ([key, p]) => [key, point(p.lon, 89, orientation)]));
  const selectedAspect = chart.aspects.find((aspect) => selection?.kind === "aspect" && aspectId(aspect) === selection.id);
  const glyphAngles: number[] = [];

  return (
    <svg
      className="astro-natal-wheel astro-traditional-wheel"
      viewBox="-185 -185 370 370"
      role="group"
      aria-label={at(language, "wheel")}
      data-testid="astro-wheel"
    >
      <circle className="astro-traditional-face" r="165" />
      {SIGN_ORDER.map((sign, index) => {
        const first = point(index * 30, 165, orientation);
        const last = point((index + 1) * 30, 165, orientation);
        const innerFirst = point(index * 30, 140, orientation);
        const innerLast = point((index + 1) * 30, 140, orientation);
        const center = point(index * 30 + 15, 152.5, orientation);
        return (
          <g key={sign} className={`astro-traditional-sign astro-traditional-element-${index % 4}`}>
            <path d={`M${first.x} ${first.y}A165 165 0 0 0 ${last.x} ${last.y}L${innerLast.x} ${innerLast.y}A140 140 0 0 1 ${innerFirst.x} ${innerFirst.y}Z`} />
            <svg width="19" height="19" x={center.x - 9.5} y={center.y - 9.5} viewBox="0 0 24 24" aria-hidden="true">
              <path d={SIGN_PATHS[index]} />
            </svg>
          </g>
        );
      })}
      <circle className="astro-traditional-tick-ring" r="140" />
      <circle className="astro-traditional-tick-ring" r="134" />
      {Array.from({ length: 360 }, (_, degree) => {
        const a = point(degree, 140, orientation);
        const b = point(degree, degree % 30 === 0 ? 134 : degree % 5 === 0 ? 136 : 138, orientation);
        return <line key={degree} className={`astro-traditional-tick${degree % 5 === 0 ? " is-major" : ""}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}
      {layers.houses && Array.from(cusps, ([house, lon]) => {
        const a = point(lon, 134, orientation);
        const nextCusp = cusps.get((house % 12) + 1);
        const span = nextCusp === undefined ? 0 : (nextCusp - lon + 360) % 360;
        const b = point(lon + (span ? span / 2 : 4), 122, orientation);
        const selected = selection?.kind === "house" && selection.id === String(house);
        return (
          <g key={house} data-selected={selected} className="astro-traditional-house">
            <line x1="0" y1="0" x2={a.x} y2={a.y} />
            <text x={b.x} y={b.y} textAnchor="middle" dominantBaseline="central">{house}</text>
          </g>
        );
      })}
      {layers.houses && axes.map((axis) => {
        if (axis.lon === undefined) return null;
        const a = point(axis.lon, 136, orientation);
        const b = point(axis.lon, 171, orientation);
        const showSelection = axis.body && selection?.kind === "body" && selection.id === axis.body;
        const body = axis.body;
        const selectAscendant = onSelect && body ? () => onSelect({ kind: "body", id: body }) : undefined;
        return (
          <g key={axis.start} className="astro-traditional-axis">
            <line x1={a.x} y1={a.y} x2={-a.x} y2={-a.y} />
            <g
              className="astro-traditional-glyph"
              role={selectAscendant ? "button" : undefined}
              tabIndex={selectAscendant ? 0 : undefined}
              aria-label={body ? chartPointName(body, language) : undefined}
              aria-pressed={selectAscendant ? Boolean(showSelection) : undefined}
              onClick={selectAscendant}
              onKeyDown={(event) => {
                if (selectAscendant && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  selectAscendant();
                }
              }}
            >
              <circle cx={b.x} cy={b.y} r="13" />
              <text x={b.x} y={b.y} textAnchor="middle" dominantBaseline="central">{axis.start}</text>
            </g>
            <text x={-b.x} y={-b.y} textAnchor="middle" dominantBaseline="central">{axis.end}</text>
          </g>
        );
      })}
      {layers.aspects && chart.aspects.map((aspect, index) => {
        const from = bodyKey(aspect.from);
        const to = bodyKey(aspect.to);
        const a = aspectPoints.get(from);
        const b = aspectPoints.get(to);
        if (!a || !b || from === to) return null;
        const selected = selection?.kind === "aspect" ? selection.id === aspectId(aspect)
          : selection?.kind === "body" && [from, to].includes(bodyKey(selection.id));
        return (
          <line key={`${aspectId(aspect)}:${index}`} className="astro-aspect-line astro-traditional-aspect"
            data-aspect={aspect.type} data-selected={selected} data-dimmed={Boolean(selection && !selected)}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        );
      })}
      {layers.planets && Array.from(placements, ([key, p]) => {
        if ((p === ascendant && layers.houses) || key === "mc" || key === "midheaven") return null;
        const glyph = CHART_POINT_SYMBOLS[key];
        if (!glyph) return null;
        const anchor = aspectPoints.get(key)!;
        // Keep the aspect endpoint at its true longitude and move only a crowded glyph.
        let angle = p.lon;
        for (let step = 0; glyphAngles.some((existing) => Math.abs((angle - existing + 540) % 360 - 180) < 13 - 1e-6); step++) {
          const distance = Math.floor(step / 2 + 1) * 13;
          angle = p.lon + (step % 2 === 0 ? distance : -distance);
        }
        glyphAngles.push(angle);
        const position = point(angle, 106, orientation);
        const leader = point(angle, 98, orientation);
        const selected = (selection?.kind === "body" && selection.id === p.body)
          || Boolean(selectedAspect && [bodyKey(selectedAspect.from), bodyKey(selectedAspect.to)].includes(key));
        const select = () => onSelect?.({ kind: "body", id: p.body });
        return (
          <g key={key} data-body={p.body} data-selected={selected} className="astro-traditional-point">
            <line x1={anchor.x} y1={anchor.y} x2={leader.x} y2={leader.y} />
            <circle cx={anchor.x} cy={anchor.y} r="2.15" onClick={onSelect ? select : undefined} />
            <g className="astro-traditional-glyph" role={onSelect ? "button" : undefined}
              aria-label={chartPointName(p.body, language)} aria-pressed={onSelect ? selected : undefined}
              tabIndex={onSelect ? 0 : undefined} onClick={onSelect ? select : undefined}
              onKeyDown={(event) => {
                if (onSelect && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  select();
                }
              }}>
              <circle cx={position.x} cy={position.y} r="10.5" />
              <text x={position.x} y={position.y} textAnchor="middle" dominantBaseline="central">
                {glyph}{p.retrograde ? <tspan className="astro-traditional-retrograde" dx="1">ˎ</tspan> : null}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

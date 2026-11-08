import type { CSSProperties } from "react";
import type { ZodiacSign } from "../../../types/astrology";

/** A star at x, y in a 200 × 120 sky, with its drawn radius standing in for brightness. */
type Star = readonly [x: number, y: number, r: number];
type Figure = { stars: readonly Star[]; lines: readonly (readonly [number, number])[] };

/**
 * The twelve zodiac constellations as their familiar stick figures. Positions
 * are drawn by hand from the real star patterns and simplified to read at
 * phone size; the brightest star of each (Aldebaran, Regulus, Spica, Antares…)
 * is the largest point.
 */
export const ZODIAC_FIGURES: Record<ZodiacSign, Figure> = {
  aries: {
    stars: [[34, 44, 2], [104, 56, 3.2], [132, 72, 2.6], [150, 84, 1.8]],
    lines: [[0, 1], [1, 2], [2, 3]],
  },
  taurus: {
    stars: [[24, 20, 2.4], [70, 50, 2], [96, 62, 2], [88, 74, 3.2], [60, 84, 2], [28, 100, 2.4], [158, 34, 1.4], [165, 40, 1.4], [172, 33, 1.2], [166, 27, 1.2]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  },
  gemini: {
    stars: [[46, 18, 3], [72, 28, 3.2], [56, 58, 2], [84, 62, 2], [62, 100, 2], [98, 100, 2.2], [32, 64, 1.6], [116, 70, 1.6]],
    lines: [[0, 2], [2, 4], [1, 3], [3, 5], [2, 3], [2, 6], [3, 7]],
  },
  cancer: {
    stars: [[100, 58, 2], [70, 22, 2.2], [134, 26, 1.8], [90, 104, 2.4], [126, 96, 1.6]],
    lines: [[1, 0], [2, 0], [0, 3], [0, 4]],
  },
  leo: {
    stars: [[60, 94, 3.2], [58, 68, 2], [70, 46, 2.6], [86, 32, 2], [104, 36, 1.8], [108, 52, 2], [142, 64, 2.2], [180, 76, 2.6], [144, 94, 2.2]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 7], [7, 8], [8, 0]],
  },
  virgo: {
    stars: [[112, 102, 3.2], [100, 72, 2], [80, 52, 2.2], [58, 40, 2], [28, 30, 1.8], [122, 46, 2], [144, 28, 1.8], [152, 72, 2]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6], [1, 7]],
  },
  libra: {
    stars: [[72, 40, 2.4], [130, 30, 2.6], [150, 80, 2], [86, 90, 2], [62, 106, 1.6]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4]],
  },
  scorpio: {
    stars: [[40, 20, 2], [34, 36, 2], [42, 52, 2], [70, 52, 3.2], [90, 62, 2], [104, 78, 2], [110, 98, 2], [128, 108, 2], [150, 104, 2], [160, 90, 2.4], [152, 80, 1.8]],
    lines: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10]],
  },
  sagittarius: {
    stars: [[60, 60, 2.4], [86, 44, 2.2], [112, 50, 2.6], [126, 34, 2], [142, 56, 2.2], [132, 82, 2.6], [96, 86, 2.4], [62, 92, 2]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [2, 5]],
  },
  capricorn: {
    stars: [[30, 40, 2.6], [70, 72, 2], [110, 100, 2.2], [150, 80, 2.4], [176, 52, 2.4], [140, 50, 2], [96, 48, 1.8]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]],
  },
  aquarius: {
    stars: [[40, 30, 2.4], [70, 44, 2.6], [100, 40, 2], [120, 56, 2], [104, 76, 2], [130, 90, 2], [152, 80, 1.8], [172, 100, 1.8], [84, 96, 1.8]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [4, 8]],
  },
  pisces: {
    stars: [[100, 102, 2.4], [86, 78, 1.8], [72, 54, 1.8], [60, 34, 2], [44, 24, 1.8], [30, 32, 1.8], [38, 46, 1.8], [130, 92, 1.8], [158, 80, 2], [176, 64, 2.2], [186, 76, 1.6]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3], [0, 7], [7, 8], [8, 9], [9, 10]],
  },
};

/** Before a birthday is known: a few unconnected stars, waiting to be joined. */
const UNWRITTEN: Figure = {
  stars: [[40, 36, 1.6], [76, 70, 2], [104, 30, 1.4], [126, 84, 1.8], [158, 50, 1.6], [60, 98, 1.2], [180, 92, 1.2]],
  lines: [],
};

/** The first day of each sign, as month * 100 + day. */
const SIGN_STARTS = [120, 219, 321, 420, 521, 621, 723, 823, 923, 1023, 1122, 1222];

/**
 * The tropical Sun sign for a YYYY-MM-DD birth date. Returns null when the date
 * is incomplete, and on the two days around a sign change, where the Sun's move
 * depends on the year and the birth time: there the calculated chart decides,
 * so the page never shows a sign the chart might contradict.
 */
export function sunSignFromDate(birthDate?: string | null): ZodiacSign | null {
  const [year, month, day] = (birthDate ?? "").split("-").map(Number);
  if (!year || !month || !day) return null;
  const md = month * 100 + day;
  const dayBefore = (start: number) => {
    const date = new Date(Date.UTC(year, Math.floor(start / 100) - 1, (start % 100) - 1));
    return (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  };
  if (SIGN_STARTS.some(start => md === start || md === dayBefore(start))) return null;
  if (md >= 321 && md <= 419) return "aries";
  if (md >= 420 && md <= 520) return "taurus";
  if (md >= 521 && md <= 620) return "gemini";
  if (md >= 621 && md <= 722) return "cancer";
  if (md >= 723 && md <= 822) return "leo";
  if (md >= 823 && md <= 922) return "virgo";
  if (md >= 923 && md <= 1022) return "libra";
  if (md >= 1023 && md <= 1121) return "scorpio";
  if (md >= 1122 && md <= 1221) return "sagittarius";
  if (md >= 1222 || md <= 119) return "capricorn";
  if (md >= 120 && md <= 218) return "aquarius";
  return "pisces";
}

/**
 * The person's Sun constellation, drawn in gold on their letter. With `reveal`,
 * the lines draw themselves in and the stars arrive one by one, once.
 */
export function Constellation({ sign, label, reveal }: { sign: ZodiacSign | null; label: string; reveal: boolean }) {
  const figure = sign ? ZODIAC_FIGURES[sign] : UNWRITTEN;
  return <svg className="me-constellation" viewBox="0 0 200 120" role="img" aria-label={label} focusable="false"
    data-sign={sign ?? undefined} data-reveal={reveal || undefined}>
    {figure.lines.map(([from, to], index) => {
      const [x1, y1] = figure.stars[from]!;
      const [x2, y2] = figure.stars[to]!;
      return <line key={`${from}-${to}`} className="me-constellation-line" x1={x1} y1={y1} x2={x2} y2={y2}
        pathLength={1} style={{ "--i": index } as CSSProperties} />;
    })}
    {figure.stars.map(([x, y, r], index) => <g key={index} className="me-constellation-star" style={{ "--i": index } as CSSProperties}>
      <circle className="me-constellation-glow" cx={x} cy={y} r={r * 2.6} />
      <circle cx={x} cy={y} r={r} />
    </g>)}
  </svg>;
}

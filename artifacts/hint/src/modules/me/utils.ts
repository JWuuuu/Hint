/** Small helpers for the Me account hub. */

import type { HintLanguage } from "../../lib/i18n";

const ZODIAC_ZH: Record<string, string> = {
  Capricorn: "摩羯座",
  Aquarius: "水瓶座",
  Pisces: "双鱼座",
  Aries: "白羊座",
  Taurus: "金牛座",
  Gemini: "双子座",
  Cancer: "巨蟹座",
  Leo: "狮子座",
  Virgo: "处女座",
  Libra: "天秤座",
  Scorpio: "天蝎座",
  Sagittarius: "射手座",
};

const ZODIAC_LOCALIZED: Partial<Record<HintLanguage, Record<string, string>>> = {
  zh: ZODIAC_ZH,
  es: {
    Capricorn: "Capricornio",
    Aquarius: "Acuario",
    Pisces: "Piscis",
    Aries: "Aries",
    Taurus: "Tauro",
    Gemini: "Géminis",
    Cancer: "Cáncer",
    Leo: "Leo",
    Virgo: "Virgo",
    Libra: "Libra",
    Scorpio: "Escorpio",
    Sagittarius: "Sagitario",
  },
  ja: {
    Capricorn: "山羊座",
    Aquarius: "水瓶座",
    Pisces: "魚座",
    Aries: "牡羊座",
    Taurus: "牡牛座",
    Gemini: "双子座",
    Cancer: "蟹座",
    Leo: "獅子座",
    Virgo: "乙女座",
    Libra: "天秤座",
    Scorpio: "蠍座",
    Sagittarius: "射手座",
  },
  ko: {
    Capricorn: "염소자리",
    Aquarius: "물병자리",
    Pisces: "물고기자리",
    Aries: "양자리",
    Taurus: "황소자리",
    Gemini: "쌍둥이자리",
    Cancer: "게자리",
    Leo: "사자자리",
    Virgo: "처녀자리",
    Libra: "천칭자리",
    Scorpio: "전갈자리",
    Sagittarius: "사수자리",
  },
};

/** Western (tropical) zodiac sign from an ISO YYYY-MM-DD birth date. */
export function zodiacSign(birthDate?: string | null, language: HintLanguage = "en"): string | null {
  if (!birthDate) return null;
  const parts = birthDate.split("-");
  if (parts.length < 3) return null;
  const mm = Number(parts[1]);
  const dd = Number(parts[2]);
  if (!mm || !dd) return null;
  const md = mm * 100 + dd;
  let sign = "Sagittarius";
  if (md >= 1222 || md <= 119) sign = "Capricorn";
  else if (md <= 218) sign = "Aquarius";
  else if (md <= 320) sign = "Pisces";
  else if (md <= 419) sign = "Aries";
  else if (md <= 520) sign = "Taurus";
  else if (md <= 620) sign = "Gemini";
  else if (md <= 722) sign = "Cancer";
  else if (md <= 822) sign = "Leo";
  else if (md <= 922) sign = "Virgo";
  else if (md <= 1022) sign = "Libra";
  else if (md <= 1121) sign = "Scorpio";
  return ZODIAC_LOCALIZED[language]?.[sign] ?? sign;
}

/** 1–2 letter initials for the avatar fallback. */
export function initialsFrom(name?: string | null): string {
  const base = (name ?? "").normalize("NFC").trim();
  if (!base) return "ME";
  return (
    base
      .split(/\s+/)
      .map((word) => Array.from(word).find((character) => /[\p{L}\p{N}]/u.test(character)))
      .filter((character): character is string => Boolean(character))
      .slice(0, 2)
      .map((character) => Array.from(character.toUpperCase())[0] ?? "")
      .join("") || "ME"
  );
}

/** Something the person kept on this device: a tarot reading or a daily pull. */
export type PracticeEntry = { id: string; createdAt: string };

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Which of the last `days` local days (oldest first, ending today) hold at least one entry. */
export function practiceRhythm(entries: PracticeEntry[], today = new Date(), days = 14): { active: boolean[]; count: number } {
  const kept = new Set(entries
    .map(entry => new Date(entry.createdAt))
    .filter(date => Number.isFinite(date.getTime()))
    .map(localDayKey));
  const active = Array.from({ length: days }, (_, index) =>
    kept.has(localDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - index)))));
  return { active, count: active.filter(Boolean).length };
}

/** Stable 0..1 value for an id, so a star keeps its place between visits. */
function unitHash(value: string, seed = 2166136261): number {
  let hash = seed;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  // Final avalanche: ids that differ only in their last character (r1, r2…)
  // must still land far apart.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967295;
}

export type SkyStar = { id: string; x: number; y: number; latest: boolean };
export const PRACTICE_SKY = { width: 320, height: 112, max: 12, inset: 14 } as const;

/** The most recent entries as one constellation: oldest to newest, left to right. */
export function practiceSky(entries: PracticeEntry[], { width, height, max, inset } = PRACTICE_SKY): SkyStar[] {
  const recent = entries
    .filter(entry => Number.isFinite(Date.parse(entry.createdAt)))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .slice(-max);
  const span = width - inset * 2;
  const step = recent.length > 1 ? span / (recent.length - 1) : 0;
  let height01 = 0.5;
  return recent.map((entry, index) => {
    const along = recent.length === 1 ? 0.5 : index / (recent.length - 1);
    const last = index === recent.length - 1;
    // Inner stars drift a little sideways (never past a neighbour) so the
    // path reads as a constellation rather than a timeline.
    const drift = index === 0 || last ? 0 : (unitHash(entry.id, 374761393) - 0.5) * step * 0.5;
    // Each star eases toward its neighbour so the line reads as one gentle path.
    height01 = height01 * 0.3 + unitHash(entry.id) * 0.7;
    return {
      id: entry.id,
      x: inset + along * span + drift,
      y: inset + height01 * (height - inset * 2),
      latest: last,
    };
  });
}

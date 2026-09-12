import type { AstroNatalResponse } from "./astroClient";
import type { Aspect, BirthProfile, ElementBalance, ModalityBalance, NatalChart, PlanetBody, PlanetPlacement, ZodiacSign } from "../../types/astrology";

const SIGN_MEANINGS: Record<ZodiacSign, string> = {
  aries: "You move directly and need a clear yes or no.",
  taurus: "You seek stability, beauty, and something real.",
  gemini: "You understand life through language, pattern, and quick connection.",
  cancer: "You feel deeply and protect what matters.",
  leo: "You enter rooms with warmth, presence, and quiet magnetism.",
  virgo: "You trust what can be refined, practiced, and made useful.",
  libra: "You read balance quickly and notice what a room is not saying.",
  scorpio: "You prefer truth with depth over comfort without honesty.",
  sagittarius: "You need room to name the bigger meaning and keep moving.",
  capricorn: "You respect devotion that proves itself through time.",
  aquarius: "You notice the future before everyone agrees it is possible.",
  pisces: "You absorb the room and translate feeling into intuition.",
};

const BODIES: PlanetBody[] = ["sun", "moon", "rising", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const SIGNS: ZodiacSign[] = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"];
const ASPECTS = ["conjunction", "sextile", "square", "trine", "opposition"] as const;

function isSign(value: unknown): value is ZodiacSign {
  return typeof value === "string" && SIGNS.includes(value as ZodiacSign);
}

function isBody(value: unknown): value is PlanetBody {
  return typeof value === "string" && BODIES.includes(value as PlanetBody);
}

/** Count only returned planets, never an assumed default or a chart angle. */
function balances(placements: PlanetPlacement[]) {
  const element: ElementBalance = { fire:0, earth:0, air:0, water:0, meaning:"" };
  const modality: ModalityBalance = { cardinal:0, fixed:0, mutable:0, meaning:"" };
  const elements = ["fire","earth","air","water"] as const;
  const modes = ["cardinal","fixed","mutable"] as const;
  for (const p of placements) if (p.body !== "rising" && p.sign) {
    const i=SIGNS.indexOf(p.sign); element[elements[i % 4]]++; modality[modes[i % 3]]++;
  }
  const dominant = <T extends string>(keys: readonly T[], values: Record<T, number>) => {
    const max=Math.max(...keys.map(k=>values[k])); const winners=keys.filter(k=>values[k]===max);
    return max>0 && winners.length===1 ? winners[0] : undefined;
  };
  element.dominant=dominant(elements,element); modality.dominant=dominant(modes,modality);
  return {elementBalance:element,modalityBalance:modality};
}

export function normalizeClientNatal(profile: BirthProfile, response: AstroNatalResponse): NatalChart | null {
  if (response.source !== "astrologyapi" || response.mode !== "live" || !Array.isArray(response.chart?.placements)) return null;
  const placements: PlanetPlacement[] = response.chart.placements
    .filter((placement) => isBody(placement.body))
    .map((placement) => {
      const sign = isSign(placement.sign) ? placement.sign : undefined;
      return {
        body: placement.body as PlanetBody,
        sign,
        degree: typeof placement.degree === "number" && Number.isFinite(placement.degree) && placement.degree >= 0 && placement.degree < 30 ? placement.degree : undefined,
        house: Number.isInteger(placement.house) && placement.house! >= 1 && placement.house! <= 12 ? placement.house : undefined,
        retrograde: placement.retrograde,
        element: placement.element as PlanetPlacement["element"],
        modality: placement.modality as PlanetPlacement["modality"],
        meaning: sign ? SIGN_MEANINGS[sign] : "This point needs more birth data to read precisely.",
      };
    });
  const aspects: Aspect[] = (response.chart.aspects ?? [])
    .filter((aspect) => ASPECTS.includes(aspect.type as Aspect["type"]))
    .map((aspect) => ({
      from: aspect.from,
      to: aspect.to,
      type: aspect.type as Aspect["type"],
      orb: typeof aspect.orb === "number" && Number.isFinite(aspect.orb) && aspect.orb >= 0 && aspect.orb <= 180 ? aspect.orb : undefined,
      strength: aspect.strength,
      meaning: "This aspect describes how two chart points exchange pressure, ease, or focus.",
    }));
  const sunSign = placements.find((placement) => placement.body === "sun")?.sign;
  const moonSign = placements.find((placement) => placement.body === "moon")?.sign;
  const risingSign = placements.find((placement) => placement.body === "rising")?.sign;
  const venusSign = placements.find((placement) => placement.body === "venus")?.sign;
  const marsSign = placements.find((placement) => placement.body === "mars")?.sign;

  return {
    calculation: response.calculation,
    id: response.profileHash,
    provider: response.source === "astrologyapi" ? "astrologyapi" : "fallback",
    source: response.source === "astrologyapi" ? "astrologyapi" : "fallback",
    mode: response.mode,
    calculatedAt: response.fetchedAt,
    birthProfile: structuredClone(profile),
    placements,
    aspects,
    houses: (response.chart.houses ?? []).filter(house => Number.isInteger(house.house) && house.house >= 1 && house.house <= 12).map((house) => ({
      ...house,
      sign: isSign(house.sign) ? house.sign : undefined,
      degree: typeof house.degree === "number" && Number.isFinite(house.degree) && house.degree >= 0 && house.degree < 30 ? house.degree : undefined,
    })),
    sunSign,
    moonSign,
    risingSign,
    venusSign,
    marsSign,
    ...balances(placements),
    validation: response.validation,
    summary: {
      headline: response.chart.summary?.headline ?? "Personal chart",
      short: response.chart.summary?.summary ?? "Your personal chart is ready.",
      strengths: response.chart.summary?.strengths ?? [],
      watch: response.chart.summary?.watchOut ?? [],
    },
  };
}

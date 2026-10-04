import { birthDetailsError, type BirthDetails } from "../birthDetails";
import type { AstroCalculation, BirthProfile, NatalChart } from "../../types/astrology";
import type { BirthProfileInput, NormalizedBirthChart } from "../../modules/astrology/types";

export type ChartProfileDetails = (BirthDetails & { name: string; birthDate: string }) | null;
export function profileToBirthInput(owner: string, profile: ChartProfileDetails): BirthProfileInput | null {
  if (!profile || birthDetailsError(profile)) return null;
  return { userId: owner, name: profile.name, birthday: profile.birthDate, birthTime: profile.birthTime || undefined,
    birthCity: profile.birthPlace || undefined, latitude: profile.latitude ?? undefined, longitude: profile.longitude ?? undefined,
    timezone: profile.timezoneOffset ?? profile.timezone ?? undefined };
}

/** The same complete input needed by My Chart; never assign a time or offset. */
export function verifiedBirthProfile(owner: string, details: ChartProfileDetails): BirthProfile | null {
  if (!details || birthDetailsError(details) || !details.birthTime || details.latitude == null || details.longitude == null || details.timezoneOffset == null) return null;
  return { id: owner, name: details.name, birthDate: details.birthDate, birthTime: details.birthTime,
    birthPlace: details.birthPlace ?? "", latitude: details.latitude, longitude: details.longitude,
    timezone: details.timezone ?? undefined, timezoneOffset: details.timezoneOffset, createdAt: "", updatedAt: "" };
}

export type VerifiedLegacyBirthChart = NormalizedBirthChart & { calculation?: AstroCalculation };
/** Compatibility consumes a legacy shape, but every displayed coordinate is shared with My Chart. */
export function toLegacyCalculatedChart(chart: NatalChart, input: BirthProfileInput): VerifiedLegacyBirthChart | null {
  if (chart.source !== "astrologyapi" || chart.provider !== "astrologyapi" || chart.mode !== "live" || !chart.placements.length) return null;
  return { provider: "astrologyapi", source: "api", approximate: false, calculatedAt: chart.calculatedAt, calculation: chart.calculation,
    input, placements: chart.placements.map(({ meaning: _meaning, ...placement }) => placement),
    sunSign: chart.sunSign, moonSign: chart.moonSign, risingSign: chart.risingSign, venusSign: chart.venusSign, marsSign: chart.marsSign,
    houses: chart.houses.map(({ house, sign, degree }) => ({ house, sign, degree })),
    aspects: chart.aspects.map(({ meaning: _meaning, ...aspect }) => aspect),
    // This adapter makes no new interpretation or completeness claim.
    chartSummary: { headline: "", summary: "", strengths: [], watchOut: [] },
  };
}

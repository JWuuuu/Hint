import type { HintLanguage } from "@/lib/i18n";
import type {
  AstroSynastryResponse,
  NatalChart,
  PlanetPlacement,
} from "@/types/astrology";
import type { ChartSelection } from "./chartState";
import {
  INTERPRETATION_VERSION,
  placementReading,
  placementHouseReading,
  aspectReading,
} from "./interpretationLibrary";
import {
  bodyName,
  signName,
  aspectName,
  houseDescription,
} from "./astrologyLibrary";
import { at } from "./astrologyCopy";
import { rt, type ReportCopyKey } from "./reportCopy";

export type ReportEvidence = ChartSelection & { person?: "user" | "partner" };
export type ReportPassage = {
  title: string;
  paragraphs: string[];
  evidence: ReportEvidence[];
};
export type ReportChapter = {
  id: string;
  title: string;
  passages: ReportPassage[];
};
export type LetterText = { title: string; chapters: ReportChapter[] };
export type CelestialLetter = {
  id: string;
  schemaVersion: 1;
  contentVersion: string;
  owner: string;
  clearVersion: string;
  kind: "natal" | "synastry";
  createdAt: string;
  savedAt?: string;
  language: HintLanguage;
  partial: boolean;
  charts: { user: NatalChart; partner?: NatalChart };
  synastry?: AstroSynastryResponse;
  text: Record<HintLanguage, LetterText>;
};
export const REPORT_LANGUAGES: HintLanguage[] = ["en", "zh", "es", "ja", "ko"];
export const aspectKey = (a: { from: string; to: string; type: string }) =>
  `${a.from}:${a.type}:${a.to}`;
export const crossAspectKey = (a: AstroSynastryResponse["aspects"][number]) =>
  a.id ?? `user:${aspectKey(a)}:partner`;
export const degreeText = (n: number, language: HintLanguage) =>
  `${new Intl.NumberFormat(language, { maximumFractionDigits: 4 }).format(n)}°`;
export function placementLabel(p: PlanetPlacement, language: HintLanguage) {
  return [
    bodyName(p.body, language),
    p.sign ? signName(p.sign, language) : at(language, "unavailable"),
    typeof p.degree === "number"
      ? degreeText(p.degree, language)
      : at(language, "unavailable"),
    p.house ? `${at(language, "house")} ${p.house}` : null,
    p.retrograde ? at(language, "retrograde") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
function passage(
  p: PlanetPlacement,
  language: HintLanguage,
  person?: "user" | "partner",
): ReportPassage {
  return {
    title: placementLabel(p, language),
    paragraphs: [
      ...placementReading(p, language),
      ...placementHouseReading(p, language),
      ...(p.retrograde ? [at(language, "retroNote")] : []),
    ],
    evidence: [{ kind: "body", id: p.body, person }],
  };
}
const natalSections: [ReportCopyKey, string[]][] = [
  ["overview", ["sun", "rising"]],
  ["emotions", ["moon"]],
  ["communication", ["mercury"]],
  ["relationships", ["venus"]],
  ["action", ["mars"]],
  ["growth", ["jupiter", "saturn", "uranus", "neptune", "pluto"]],
];
function natalText(chart: NatalChart, language: HintLanguage): LetterText {
  const chapters: ReportChapter[] = natalSections.map(([key, bodies]) => ({
    id: key,
    title: rt(language, key),
    passages: chart.placements
      .filter((p) => bodies.includes(p.body))
      .map((p) => passage(p, language)),
  }));
  chapters.push({
    id: "houses",
    title: rt(language, "houses"),
    passages: chart.houses.map((h) => ({
      title: `${at(language, "house")} ${h.house} · ${h.sign ? signName(h.sign, language) : at(language, "unavailable")}${typeof h.degree === "number" ? ` · ${degreeText(h.degree, language)}` : ""}`,
      paragraphs: [houseDescription(h.house, language)],
      evidence: [{ kind: "house", id: String(h.house) }],
    })),
  });
  chapters.push({
    id: "aspects",
    title: rt(language, "aspects"),
    passages: chart.aspects.map((a) => ({
      title: `${bodyName(a.from, language)} · ${aspectName(a.type, language)} · ${bodyName(a.to, language)} · ${rt(language, "orb")}: ${typeof a.orb === "number" ? degreeText(a.orb, language) : at(language, "unavailable")}`,
      paragraphs: aspectReading(a.from, a.to, a.type, language),
      evidence: [{ kind: "aspect", id: aspectKey(a) }],
    })),
  });
  return { title: rt(language, "natal"), chapters };
}
function synastryText(
  charts: CelestialLetter["charts"],
  result: AstroSynastryResponse,
  language: HintLanguage,
): LetterText {
  const chapters: ReportChapter[] = [
    {
      id: "overview",
      title: rt(language, "overview"),
      passages: (["user", "partner"] as const).flatMap((person) => {
        const chart = charts[person];
        return chart
          ? chart.placements
              .filter((p) => ["sun", "moon", "rising"].includes(p.body))
              .map((p) => ({
                ...passage(p, language, person),
                title: `${chart.birthProfile.name} · ${placementLabel(p, language)}`,
              }))
          : [];
      }),
    },
  ];
  const groups: [
    ReportCopyKey,
    (a: AstroSynastryResponse["aspects"][number]) => boolean,
  ][] = [
    ["emotions", (a) => a.from === "moon" || a.to === "moon"],
    ["communication", (a) => a.from === "mercury" || a.to === "mercury"],
    [
      "relationships",
      (a) =>
        ["venus", "mars"].includes(a.from) || ["venus", "mars"].includes(a.to),
    ],
    ["friction", (a) => ["square", "opposition"].includes(a.type)],
    [
      "cooperation",
      (a) => ["trine", "sextile", "conjunction"].includes(a.type),
    ],
  ];
  for (const [key, filter] of groups)
    chapters.push({
      id: key,
      title: rt(language, key),
      passages: result.aspects.filter(filter).map((a) => ({
        title: `${charts.user.birthProfile.name} · ${bodyName(a.from, language)} → ${charts.partner?.birthProfile.name ?? rt(language, "partner")} · ${bodyName(a.to, language)} · ${aspectName(a.type, language)}`,
        paragraphs: [
          `${rt(language, "orb")}: ${typeof a.orb === "number" ? degreeText(a.orb, language) : at(language, "unavailable")} · ${rt(language, "separation")}: ${typeof a.separation === "number" ? degreeText(a.separation, language) : at(language, "unavailable")}`,
          ...aspectReading(a.from, a.to, a.type, language, true),
        ],
        evidence: [{ kind: "aspect", id: crossAspectKey(a) }],
      })),
    });
  return { title: rt(language, "together"), chapters };
}
export function createLetter(
  owner: string,
  clearVersion: string,
  chart: NatalChart,
  language: HintLanguage,
  comparison?: { partner: NatalChart; result: AstroSynastryResponse },
): CelestialLetter {
  if (
    chart.source !== "astrologyapi" ||
    chart.mode !== "live" ||
    !chart.placements.length
  )
    throw new Error("A calculated chart is required");
  if (
    comparison &&
    (comparison.partner.source !== "astrologyapi" ||
      comparison.partner.mode !== "live" ||
      comparison.result.mode !== "live" ||
      comparison.result.calculation?.aspectSource !== "hint-geometry")
  )
    throw new Error("Verified comparison is required");
  const charts = {
    user: structuredClone(chart),
    ...(comparison ? { partner: structuredClone(comparison.partner) } : {}),
  };
  const kind = comparison ? "synastry" : "natal";
  const text = Object.fromEntries(
    REPORT_LANGUAGES.map((lang) => [
      lang,
      comparison
        ? synastryText(charts, comparison.result, lang)
        : natalText(charts.user, lang),
    ]),
  ) as CelestialLetter["text"];
  return {
    id: `${kind}:${chart.id}:${chart.calculatedAt}${comparison ? `:${comparison.partner.id}:${comparison.result.fetchedAt}` : ""}:${INTERPRETATION_VERSION}`,
    schemaVersion: 1,
    contentVersion: INTERPRETATION_VERSION,
    owner,
    clearVersion,
    kind,
    createdAt: comparison?.result.fetchedAt ?? chart.calculatedAt,
    language,
    partial: Object.values(charts).some(
      (c) =>
        Boolean(c.validation?.partial) ||
        c.placements.length < 11 ||
        c.houses.length < 12 ||
        !c.aspects.length,
    ),
    charts,
    synastry: comparison ? structuredClone(comparison.result) : undefined,
    text,
  };
}

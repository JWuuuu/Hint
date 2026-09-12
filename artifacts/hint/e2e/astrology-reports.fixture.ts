import type { Page } from "./fixtures";
import {
  compareChartPositions,
  SYNASTRY_POLICY,
} from "../../api-server/src/modules/astrology/synastryGeometry";
export const letterOwner = "pearl-fictional-owner";
export const letterProfile = {
  id: letterOwner,
  name: "Alexandra",
  birthDate: "1995-05-15",
  birthTime: "10:20",
  birthPlace: "Chicago, Illinois",
  latitude: 41.87,
  longitude: -87.62,
  timezone: "America/Chicago",
  timezoneOffset: -5,
  createdAt: "2026-09-12T00:00:00Z",
  updatedAt: "2026-09-12T00:00:00Z",
};
export const bodyIds = [
  "sun",
  "moon",
  "rising",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
];
const signs = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
];
export const letterNatal = {
  source: "astrologyapi",
  mode: "live",
  cached: false,
  fetchedAt: "2026-09-12T12:00:00Z",
  profileHash: "fictional-pearl-chart",
  calculation: {
    zodiacSystem: "tropical",
    requestedHouseSystem: "placidus",
    houseSystem: null,
    returned: { placements: 11, houses: 12, aspects: 3 },
  },
  chart: {
    placements: bodyIds.map((body, i) => ({
      body,
      sign: i === 5 ? "libra" : signs[i],
      degree:
        i === 0 || i === 6
          ? 29.9999
          : i === 1
            ? 0.12345
            : i === 5
              ? 11.06
              : 4.56 + i,
      house: i === 5 ? 7 : i + 1,
      retrograde: body === "mercury",
    })),
    houses: signs.map((sign, i) => ({ house: i + 1, sign, degree: 0 })),
    aspects: [
      { from: "sun", to: "moon", type: "conjunction", orb: 0.12355 },
      { from: "venus", to: "mars", type: "sextile", orb: 2.5 },
      { from: "sun", to: "jupiter", type: "opposition" },
    ],
  },
};
export const letterPartner = {
  ...letterNatal,
  profileHash: "fictional-pearl-partner",
  chart: {
    ...letterNatal.chart,
    placements: bodyIds.map((body, i) => ({
      body,
      sign: signs[(i + 2) % 12],
      degree: i === 0 ? 1.234567 : 3 + i,
      house: i + 1,
      retrograde: body === "saturn",
    })),
  },
};
export const letterSynastry = {
  schemaVersion: 2,
  source: "astrologyapi",
  mode: "live",
  cached: false,
  fetchedAt: letterNatal.fetchedAt,
  calculation: {
    method: SYNASTRY_POLICY.version,
    aspectSource: "hint-geometry",
    zodiacSystem: "tropical",
    orbs: SYNASTRY_POLICY.orbs,
  },
  natal: { user: letterNatal, partner: letterPartner },
  aspects: compareChartPositions(
    letterNatal.chart.placements,
    letterPartner.chart.placements,
  ),
  summary: {},
  plainEnglish: { main: "Fixture", comfort: "", tension: "", advice: "" },
};
export async function installLetters(
  page: Page,
  language = "en",
  theme = "bright",
  appReduced = false,
  systemReduced = false,
) {
  await page.addInitScript(
    ({ owner, profile, language, theme, appReduced }) => {
      if (!localStorage.getItem("hint_anon_id")) {
        localStorage.setItem("hint_anon_id", owner);
        localStorage.setItem(
          `hint_birth_profile_v3:${owner}`,
          JSON.stringify(profile),
        );
        localStorage.setItem("hint-language", language);
        localStorage.setItem("hint-theme", theme);
        localStorage.setItem(
          "hint.preferences.v1",
          JSON.stringify({ reduceMotion: appReduced, soundAndHaptics: false }),
        );
      }
      localStorage.setItem("hint_onboarding_complete_v3", "1");
      localStorage.setItem("hint_launch_seen_v2", "1");
    },
    { owner: letterOwner, profile: letterProfile, language, theme, appReduced },
  );
  await page.emulateMedia({
    reducedMotion: systemReduced ? "reduce" : "no-preference",
  });
  await page.route("**/api/astro/natal", (route) =>
    route.fulfill({ json: letterNatal }),
  );
  await page.route("**/api/astro/synastry", (route) =>
    route.fulfill({ json: letterSynastry }),
  );
  await page.route("**/api/profile**", (route) =>
    route.fulfill({ json: { ...letterProfile, anonId: letterOwner } }),
  );
}

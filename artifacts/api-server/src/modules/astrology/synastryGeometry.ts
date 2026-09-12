/** Versioned comparison policy. These are reading conventions, not relationship scores. */
export const SYNASTRY_POLICY = {
  version: "hint-angular-v1",
  orbs: { conjunction: 8, opposition: 8, trine: 6, square: 6, sextile: 4 },
} as const;
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
const angles = {
  conjunction: 0,
  opposition: 180,
  trine: 120,
  square: 90,
  sextile: 60,
} as const;
type Placement = { body: string; sign?: string; degree?: number };
export function absoluteLongitude(p: Placement): number | null {
  const sign = signs.indexOf(p.sign ?? "");
  return sign >= 0 &&
    typeof p.degree === "number" &&
    Number.isFinite(p.degree) &&
    p.degree >= 0 &&
    p.degree < 30
    ? sign * 30 + p.degree
    : null;
}
export function compareChartPositions(user: Placement[], partner: Placement[]) {
  const unique = (rows: Placement[]) =>
    rows.filter((p, i) => rows.findIndex((q) => q.body === p.body) === i);
  const aspects = unique(user).flatMap((from) =>
    unique(partner).flatMap((to) => {
      const fromLongitude = absoluteLongitude(from),
        toLongitude = absoluteLongitude(to);
      if (fromLongitude === null || toLongitude === null) return [];
      const delta = Math.abs(fromLongitude - toLongitude);
      const separation = Math.min(delta, 360 - delta);
      return (Object.keys(angles) as Array<keyof typeof angles>).flatMap(
        (type) => {
          const orb = Math.abs(separation - angles[type]);
          if (orb > SYNASTRY_POLICY.orbs[type] + 1e-10) return [];
          return [
            {
              id: `user:${from.body}:${type}:partner:${to.body}`,
              from: from.body,
              to: to.body,
              fromOwner: "user" as const,
              toOwner: "partner" as const,
              fromLongitude,
              toLongitude,
              type,
              orb,
              separation,
              exactAngle: angles[type],
              allowedOrb: SYNASTRY_POLICY.orbs[type],
              source: "hint-geometry" as const,
              tier:
                type === "square" || type === "opposition"
                  ? "Challenging"
                  : type === "conjunction"
                    ? "Intense"
                    : "Soft",
              meaning: `${from.body} ${type} ${to.body}; orb ${Number(orb.toFixed(4))}°.`,
            },
          ];
        },
      );
    }),
  );
  return aspects.sort((a, b) => a.orb - b.orb || a.id.localeCompare(b.id));
}

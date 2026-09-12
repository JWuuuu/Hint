import { describe, expect, it } from "vitest";
import { absoluteLongitude, compareChartPositions } from "./synastryGeometry";
describe("actual two-person positions", () => {
  it("crosses zero without moving either point", () => {
    const [a] = compareChartPositions(
      [{ body: "moon", sign: "pisces", degree: 29 }],
      [{ body: "venus", sign: "aries", degree: 1 }],
    );
    expect(a).toMatchObject({
      fromOwner: "user",
      toOwner: "partner",
      fromLongitude: 359,
      toLongitude: 1,
      type: "conjunction",
      orb: 2,
      separation: 2,
    });
  });
  it.each([
    ["conjunction", 8, 1],
    ["conjunction", 8.01, 0],
    ["sextile", 64, 1],
    ["sextile", 64.01, 0],
    ["square", 96, 1],
    ["trine", 126, 1],
    ["opposition", 172, 1],
  ])("honors %s at %s degrees", (type, degree, count) => {
    const signs = [
      "aries",
      "taurus",
      "gemini",
      "cancer",
      "leo",
      "virgo",
      "libra",
    ];
    const result = compareChartPositions(
      [{ body: "sun", sign: "aries", degree: 0 }],
      [
        {
          body: "sun",
          sign: signs[Math.floor(Number(degree) / 30)],
          degree: Number(degree) % 30,
        },
      ],
    );
    expect(result.filter((a) => a.type === type)).toHaveLength(Number(count));
  });
  it("keeps all 121 real cross-person links and stable ownership", () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({
      body: `point-${i}`,
      sign: "aries",
      degree: i * 0.1,
    }));
    expect(compareChartPositions(rows, rows)).toHaveLength(121);
    expect(
      new Set(compareChartPositions(rows, rows).map((a) => a.id)).size,
    ).toBe(121);
  });
  it("never supplies missing or invalid degrees", () => {
    for (const degree of [undefined, NaN, -1, 30, Infinity])
      expect(
        absoluteLongitude({ body: "sun", sign: "aries", degree }),
      ).toBeNull();
    expect(
      compareChartPositions(
        [{ body: "sun", sign: "aries" }],
        [{ body: "moon", sign: "aries", degree: 0 }],
      ),
    ).toEqual([]);
  });
  it("retains exact geometry when people are exchanged", () => {
    const a = [{ body: "moon", sign: "aries", degree: 1.25 }],
      b = [{ body: "venus", sign: "leo", degree: 2.5 }];
    expect(compareChartPositions(a, b)[0].orb).toBe(1.25);
    expect(compareChartPositions(b, a)[0]).toMatchObject({
      from: "venus",
      to: "moon",
      orb: 1.25,
    });
  });
});

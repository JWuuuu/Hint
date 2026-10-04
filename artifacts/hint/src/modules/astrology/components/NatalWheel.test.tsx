// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NatalWheel, longitude, wheelLayout } from "./NatalWheel";
import type { NatalChart, PlanetBody } from "@/types/astrology";
vi.mock("@/lib/i18n", () => ({ useLanguage: () => ({ language: "en" }) }));
const fixture = (placements: NatalChart["placements"]): NatalChart => ({
  id: "fixture",
  source: "astrologyapi",
  provider: "astrologyapi",
  mode: "live",
  calculatedAt: "2026-09-10",
  birthProfile: {} as NatalChart["birthProfile"],
  placements,
  houses: [],
  aspects: [],
  elementBalance: {} as NatalChart["elementBalance"],
  modalityBalance: {} as NatalChart["modalityBalance"],
  summary: { headline: "", short: "", strengths: [], watch: [] },
});
describe("calculated wheel geometry", () => {
  it("preserves both sides of the zodiac seam and rejects invalid degrees", () => {
    expect(longitude("aries", 0)).toBe(0);
    expect(longitude("pisces", 29)).toBe(359);
    for (const n of [NaN, Infinity, -1, 30, 360])
      expect(longitude("aries", n)).toBeNull();
    expect(longitude("unknown", 0)).toBeNull();
    expect(longitude("moon", undefined)).toBeNull();
  });
  it("separates a cluster of all 11 labels without moving the calculated points", () => {
    const bodies: PlanetBody[] = [
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
    const chart = fixture(
      bodies.map((body, i) => ({
        body,
        sign: "aries",
        degree: i / 10,
        meaning: "",
      })),
    );
    const layout = wheelLayout(chart);
    expect(layout.labels).toHaveLength(11);
    for (const side of [-1, 1]) {
      const labels = layout.labels
        .filter((p) => p.side === side)
        .sort((a, b) => a.labelY - b.labelY);
      labels.forEach((p, i) => {
        expect(Math.abs(p.labelY)).toBeLessThanOrEqual(113 + 1e-9);
        if (i)
          expect(p.labelY - labels[i - 1].labelY).toBeGreaterThanOrEqual(
            20 - 1e-9,
          );
      });
    }
    expect(layout.points.map((p) => p.longitude)).toEqual(
      bodies.map((_, i) => i / 10),
    );
    expect(layout.points.find((p) => p.body === "rising")!.x).toBeCloseTo(-96);
  });
  it("does not create missing points, houses, or aspects", () => {
    const chart = fixture([
      { body: "sun", sign: "aries", degree: 0, meaning: "" },
      { body: "moon", sign: "cancer", meaning: "" },
    ]);
    expect(wheelLayout(chart).points.map((p) => p.body)).toEqual(["sun"]);
    const { container } = render(<NatalWheel chart={chart} />);
    expect(container.querySelectorAll("[data-body]")).toHaveLength(1);
    expect(container.querySelectorAll(".astro-aspect-line")).toHaveLength(0);
    expect(container.innerHTML).not.toContain("NaN");
  });
  it("offers a keyboard operation and highlights an exact selection", () => {
    const onSelect = vi.fn();
    const chart = fixture([
      {
        body: "sun",
        sign: "pisces",
        degree: 29,
        retrograde: true,
        meaning: "",
      },
    ]);
    render(
      <NatalWheel
        chart={chart}
        selection={{ kind: "body", id: "sun" }}
        onSelect={onSelect}
      />,
    );
    const point = screen.getByRole("button", { name: "Sun" });
    fireEvent.keyDown(point, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith({ kind: "body", id: "sun" });
    expect(point.getAttribute("aria-pressed")).toBe("true");
  });
});

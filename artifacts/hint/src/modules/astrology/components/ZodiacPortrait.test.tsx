// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NatalChart } from "@/types/astrology";
import { ZodiacPortrait } from "./ZodiacPortrait";

const chart: NatalChart = {
  id: "portrait-fixture",
  source: "astrologyapi",
  provider: "astrologyapi",
  mode: "live",
  calculatedAt: "2026-11-15",
  birthProfile: { id: "fixture", name: "Test", birthDate: "2000-02-05", birthPlace: "", createdAt: "", updatedAt: "" },
  placements: [
    { body: "sun", sign: "aquarius", meaning: "" },
    { body: "moon", sign: "gemini", meaning: "" },
  ],
  additionalPlacements: [{ body: "north_node", sign: "gemini", meaning: "" }],
  houses: [],
  aspects: [],
  elementBalance: { fire: 0, water: 0, earth: 0, air: 2, meaning: "" },
  modalityBalance: { cardinal: 0, fixed: 1, mutable: 1, meaning: "" },
  summary: { headline: "", short: "", strengths: [], watch: [] },
};

afterEach(cleanup);

describe("zodiac portrait", () => {
  it("shows eight slots, exposes only verified placements as actions, and separates the reading action", () => {
    const onSelectPlacement = vi.fn();
    const onOpenPortrait = vi.fn();
    const { container } = render(<ZodiacPortrait chart={chart} language="en" onOpenPortrait={onOpenPortrait} onSelectPlacement={onSelectPlacement} />);

    expect(container.querySelectorAll("[data-placement]")).toHaveLength(8);
    expect(container.querySelector('[data-placement="juno"]')?.textContent).toContain("Unavailable");
    expect(screen.queryByRole("button", { name: /juno/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /north node gemini/i }));
    fireEvent.click(screen.getByRole("button", { name: /read my portrait/i }));
    expect(onSelectPlacement).toHaveBeenCalledExactlyOnceWith("north_node");
    expect(onOpenPortrait).toHaveBeenCalledTimes(1);
  });

  it("limits the three-wave mark to Aquarius and localizes a different Sun sign", () => {
    const props = { language: "zh" as const, onOpenPortrait: vi.fn(), onSelectPlacement: vi.fn() };
    const { container, rerender } = render(<ZodiacPortrait chart={chart} {...props} />);
    expect(container.querySelector(".zodiac-portrait-waves")).not.toBeNull();
    expect(screen.getByRole("button", { name: /太阳 水瓶座/ })).toBeTruthy();

    const leo: NatalChart = { ...chart, placements: [{ body: "sun", sign: "leo", meaning: "" }] };
    rerender(<ZodiacPortrait chart={leo} {...props} />);
    expect(container.querySelector(".zodiac-portrait-waves")).toBeNull();
    expect(container.querySelector(".zodiac-portrait-sign-symbol")).not.toBeNull();
    expect(screen.getByRole("button", { name: /太阳 狮子座/ })).toBeTruthy();
  });
});

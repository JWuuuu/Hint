// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { DailyCheckInReward } from "./DailyCheckInReward";

const settings = vi.hoisted(() => ({
  language: "en" as "en" | "zh",
  reduced: false,
  pageVisible: true,
}));
vi.mock("../../../lib/i18n", () => ({
  useLanguage: () => ({ language: settings.language }),
}));
vi.mock("../../../lib/motionPolicy", () => ({
  useMotionPolicy: () => ({ reduced: settings.reduced, pageVisible: settings.pageVisible }),
}));

beforeEach(() => {
  settings.language = "en";
  settings.reduced = false;
  settings.pageVisible = true;
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("daily check-in reward feedback", () => {
  it("waits for the reveal and a fresh positive award", () => {
    const view = render(<DailyCheckInReward active={false} credits={2} />);
    expect(screen.queryByRole("status")).toBeNull();
    view.rerender(<DailyCheckInReward active credits={null} />);
    expect(screen.queryByRole("status")).toBeNull();
    view.rerender(<DailyCheckInReward active credits={0} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("announces the actual bonus and dismisses it after exactly two seconds", () => {
    render(<DailyCheckInReward active credits={2} />);
    expect(screen.getByRole("status", { name: "Checked in. 2 credits earned" })).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1999); });
    expect(screen.getByRole("status")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps the original deadline through rerenders and a language change", () => {
    const view = render(<DailyCheckInReward active credits={2} />);
    act(() => { vi.advanceTimersByTime(1000); });
    view.rerender(<DailyCheckInReward active credits={2} />);
    settings.language = "zh";
    view.rerender(<DailyCheckInReward active credits={2} />);
    expect(screen.getByRole("status", { name: "打卡成功. 获得 2 积分" })).toBeTruthy();
    act(() => { vi.advanceTimersByTime(999); });
    expect(screen.getByRole("status")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByRole("status")).toBeNull();
    settings.language = "en";
    view.rerender(<DailyCheckInReward active credits={2} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("cancels the pending dismissal when the reveal unmounts", () => {
    const view = render(<DailyCheckInReward active credits={1} />);
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("exposes reduced-motion feedback while still announcing the earned credit", () => {
    settings.reduced = true;
    render(<DailyCheckInReward active credits={1} />);
    const status = screen.getByRole("status", { name: "Checked in. 1 credit earned" });
    expect(status.getAttribute("data-reduced")).toBe("true");
  });
});

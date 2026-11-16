// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { DailyReceipt } from "../../../lib/dailyReceipts";
import { getHomeCheckInProgress } from "../data/homeCheckIn";
import { HomeCheckIn } from "./HomeCheckIn";

const identity = vi.hoisted(() => ({ owner: "", capture: vi.fn(), assertCurrent: vi.fn() }));
vi.mock("../../../lib/identity", () => ({
  getAnonId: () => identity.owner,
  captureIdentityContext: () => identity.capture(),
  getLocalDateString: (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
}));
vi.mock("../../../lib/i18n", () => ({ useLanguage: () => ({ language: "en" }) }));
vi.mock("../../../components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => open ? children : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

let sequence = 0;
const today = "2026-11-04";
const receipt = (patch: Partial<DailyReceipt> = {}): DailyReceipt => ({
  anonymousDeviceId: identity.owner, anonId: identity.owner, dailyKey: today,
  featureType: "daily-card", assignedAt: "2026-11-04T12:00:00Z",
  expiresAt: "2026-11-05T00:00:00Z", source: "server", ...patch,
});

beforeEach(() => {
  localStorage.clear();
  identity.owner = `home-check-in-component-${sequence++}`;
  identity.assertCurrent.mockReset();
  identity.capture.mockReset().mockImplementation(() => ({ owner: identity.owner, assertCurrent: identity.assertCurrent }));
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 4, 12));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("HomeCheckIn receipt integration", () => {
  it("uses the existing reveal action and awards only after the same day's card opens", () => {
    const onReveal = vi.fn();
    const view = render(<HomeCheckIn today={today} receipt={receipt()} ready revealing={false} onReveal={onReveal} />);
    expect(screen.getByTestId("home-check-in").getAttribute("data-completed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: /Flip today.*Reveal \+1/ }));
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(getHomeCheckInProgress(identity.owner, today).totalCredits).toBe(0);
    view.rerender(<HomeCheckIn today={today} receipt={receipt({ openedAt: "2026-11-04T12:00:00Z" })} ready revealing={false} onReveal={onReveal} />);
    expect(screen.getByTestId("home-check-in").getAttribute("data-completed")).toBe("true");
    expect(getHomeCheckInProgress(identity.owner, today).totalCredits).toBe(1);
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("does not credit an old day, another profile, or a different feature's receipt", () => {
    const props = { today, ready: true, revealing: false, onReveal: vi.fn() };
    const view = render(<HomeCheckIn {...props} receipt={receipt({ anonId: "another-profile", openedAt: "2026-11-04T12:00:00Z" })} />);
    view.rerender(<HomeCheckIn {...props} receipt={receipt({ dailyKey: "2026-11-03", openedAt: "2026-11-03T12:00:00Z" })} />);
    view.rerender(<HomeCheckIn {...props} receipt={receipt({ featureType: "daily-tarot", openedAt: "2026-11-04T12:00:00Z" })} />);
    expect(getHomeCheckInProgress(identity.owner, today).records).toHaveLength(0);
    expect(screen.getByTestId("home-check-in").getAttribute("data-completed")).toBe("false");
  });

  it("keeps credits unchanged on receipt refresh and opens its own calendar", () => {
    const onReveal = vi.fn();
    const props = { today, ready: true, revealing: false, onReveal };
    const view = render(<HomeCheckIn {...props} receipt={receipt({ openedAt: "2026-11-04T12:00:00Z" })} />);
    view.rerender(<HomeCheckIn {...props} receipt={receipt({ openedAt: "2026-11-04T12:00:01Z", syncStatus: "synced" })} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Your check-in calendar" })[0]);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Daily reward +1")).toBeTruthy();
    expect(getHomeCheckInProgress(identity.owner, today)).toMatchObject({ totalCredits: 1, currentStreak: 1 });
    expect(getHomeCheckInProgress(identity.owner, today).records).toHaveLength(1);
    expect(onReveal).not.toHaveBeenCalled();
  });

  it("keeps the homepage usable if storage access is denied during identity capture", () => {
    identity.capture.mockImplementation(() => { throw new DOMException("Storage denied", "SecurityError"); });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Storage denied", "SecurityError"); });
    render(<HomeCheckIn today={today} receipt={receipt({ openedAt: "2026-11-04T12:00:00Z" })} ready revealing={false} onReveal={vi.fn()} />);
    expect(screen.getByTestId("home-check-in").getAttribute("data-completed")).toBe("true");
    fireEvent.click(screen.getAllByRole("button", { name: "Your check-in calendar" })[0]);
    expect(screen.getByText(/Check-ins are available for this session/)).toBeTruthy();
    expect(getHomeCheckInProgress(identity.owner, today)).toMatchObject({ persistent: false, totalCredits: 1 });
  });
});

/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { HintLanguage } from "../../lib/i18n";

const state = vi.hoisted(() => ({ language: "en" as HintLanguage, failure: "invite" as string | null, saved: [] as string[], connects: 0 }));
vi.mock("@/lib/i18n", () => ({ useLanguage: () => ({ language: state.language }) }));
vi.mock("@/lib/deviceSession", () => ({
  getDeviceSessionFailure: () => state.failure,
  subscribeDeviceSession: () => () => undefined,
  readTesterInvite: () => null,
  saveTesterInvite: (code: string) => { state.saved.push(code); },
  getDeviceSessionToken: async () => { state.connects++; return "token"; },
}));
const { DeviceConnectionStatus } = await import("./DeviceConnectionStatus");

afterEach(() => { cleanup(); state.saved = []; state.connects = 0; });

it("asks for a tester invite and connects with the entered code", async () => {
  render(<DeviceConnectionStatus />);
  expect(screen.getByText(/needs a tester invite/)).toBeTruthy();
  const connect = screen.getByRole("button", { name: "Connect" });
  expect((connect as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Tester invite code"), { target: { value: "abcd-efgh" } });
  fireEvent.click(connect);
  expect(state.saved).toEqual(["abcd-efgh"]);
  await vi.waitFor(() => expect(state.connects).toBe(1));
});

it("explains a full invite in every language and keeps the code field", () => {
  state.failure = "inviteFull";
  for (const language of ["en", "zh", "es", "ja", "ko"] as const) {
    state.language = language;
    const { container, unmount } = render(<DeviceConnectionStatus />);
    expect(container.querySelector("p")?.textContent?.length).toBeGreaterThan(10);
    expect(container.querySelector("input")).toBeTruthy();
    unmount();
  }
  state.language = "en"; state.failure = "invite";
});

it("offers retry, not a code field, when the server is simply unavailable", () => {
  state.failure = "unavailable";
  render(<DeviceConnectionStatus />);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  state.failure = "invite";
});

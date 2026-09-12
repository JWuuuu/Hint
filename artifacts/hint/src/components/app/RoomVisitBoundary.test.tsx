// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Link, Router, useLocation } from "wouter";
import { useState } from "react";
import { LanguageProvider } from "../../lib/i18n";
import { RoomVisitBoundary, guardRoomNavigation, useRoomVisit } from "./RoomVisitBoundary";
import { canonicalRoom, markRoomVisitStarted, roomVisitWasClosed } from "./roomVisits";

vi.mock("../../lib/motionPolicy", () => ({ useMotionPolicy: () => ({ reduced: true, pageVisible: true }) }));
const left = vi.fn();
function Room({ room }: { room: string }) {
  const [value, setValue] = useState("");
  const [, navigate] = useLocation();
  useRoomVisit({ room, hasProgress: Boolean(value), onLeave: left });
  return <>
    <label>Question<input value={value} onChange={e => setValue(e.target.value)} /></label>
    <Link href="/app">Home</Link>
    <Link href="/app/astrology">Astrology</Link>
    <Link href={`/app/${room}?panel=details`}>Details</Link>
    <button onClick={() => navigate("/app/collection")}>Open collection</button>
    <button onClick={() => queueMicrotask(() => navigate("/app/collection"))}>Deferred collection</button>
  </>;
}
function Pages() {
  const [path] = useLocation();
  const room = canonicalRoom(path);
  return <main data-path={path}>{room ? <Room key={room} room={room} /> : <p>Today</p>}</main>;
}
function mount() {
  return render(<LanguageProvider><Router aroundNav={guardRoomNavigation}><RoomVisitBoundary><Pages /></RoomVisitBoundary></Router></LanguageProvider>);
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); left.mockClear();
  localStorage.setItem("hint-language", "en");
  history.replaceState(null, "", "/app/tarot");
  markRoomVisitStarted("tarot");
});
afterEach(cleanup);

describe("room departure", () => {
  it("keeps the clicked opener through the microtask checkpoint before navigation", async () => {
    mount();
    fireEvent.change(screen.getByLabelText("Question"), { target: { value: "Keep this question" } });
    const opener = screen.getByRole("button", { name: "Deferred collection" });
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(opener);
    fireEvent.click(await screen.findByRole("button", { name: "Stay here" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
  });
  it("returns focus to a pointer-activated link even when WebKit leaves body focused", async () => {
    mount();
    fireEvent.change(screen.getByLabelText("Question"), { target: { value: "Keep this question" } });
    const home = screen.getByRole("link", { name: "Home" });
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(home);
    fireEvent.click(await screen.findByRole("button", { name: "Stay here" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(home);
  });
  it("lets a person read the notice, cancel without losing input, and approve a fresh visit", async () => {
    localStorage.setItem("saved-reading-sentinel", "kept");
    mount();
    fireEvent.change(screen.getByLabelText("Question"), { target: { value: "A question to keep" } });
    const home = screen.getByRole("link", { name: "Home" }); home.focus(); fireEvent.click(home);
    const dialog = await screen.findByRole("dialog", { name: "Leave this space?" });
    expect(window.location.pathname).toBe("/app/tarot");
    expect(dialog.textContent).toContain("Saved readings, personal details and today’s cards are kept.");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Stay here" }));
    fireEvent.click(screen.getByRole("button", { name: "Stay here" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((screen.getByLabelText("Question") as HTMLInputElement).value).toBe("A question to keep");
    expect(document.activeElement).toBe(home);
    expect(left).not.toHaveBeenCalled();
    fireEvent.click(home);
    fireEvent.click(await screen.findByRole("button", { name: "Leave and start fresh" }));
    await screen.findByText("Today");
    expect(left).toHaveBeenCalledTimes(1);
    expect(roomVisitWasClosed("tarot")).toBe(true);
    expect(localStorage.getItem("saved-reading-sentinel")).toBe("kept");
  });

  it("does not close a visit for same-room details, and guards programmatic departures", async () => {
    mount();
    fireEvent.change(screen.getByLabelText("Question"), { target: { value: "Keep working" } });
    fireEvent.click(screen.getByRole("link", { name: "Details" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(left).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Open collection" }));
    await screen.findByRole("dialog", { name: "Leave this space?" });
    expect(window.location.pathname).toBe("/app/tarot");
    fireEvent.click(screen.getByRole("button", { name: "Leave and start fresh" }));
    expect(window.location.pathname).toBe("/app/collection");
  });

  it("keeps the original reviewed destination when a second navigation arrives", async () => {
    mount();
    fireEvent.change(screen.getByLabelText("Question"), { target: { value: "Pause" } });
    fireEvent.click(screen.getByRole("link", { name: "Astrology" }));
    await screen.findByRole("dialog");
    act(() => guardRoomNavigation((to: string) => history.pushState(null, "", to), "/app/collection"));
    fireEvent.click(screen.getByRole("button", { name: "Leave and start fresh" }));
    expect(window.location.pathname).toBe("/app/astrology");
    expect(left).toHaveBeenCalledTimes(1);
  });

  it("marks an empty visit closed without asking a needless question", async () => {
    mount();
    fireEvent.click(screen.getByRole("link", { name: "Home" }));
    await screen.findByText("Today");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(roomVisitWasClosed("tarot")).toBe(true);
  });

  it("handles committed Back without another history entry and gives a persistent explanation", async () => {
    history.replaceState(null, "", "/app");
    history.pushState(null, "", "/app/tarot");
    mount();
    fireEvent.change(screen.getByLabelText("Question"), { target: { value: "A live visit" } });
    const length = history.length;
    await act(async () => { history.back(); });
    await screen.findByRole("dialog", { name: "A fresh start next time" });
    expect(window.location.pathname).toBe("/app");
    expect(history.length).toBe(length);
    expect(roomVisitWasClosed("tarot")).toBe(true);
    expect(left).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

it("recognizes aliases and scoped routes without treating within-room transitions as exits", () => {
  expect(canonicalRoom("/preview/app/tarot?setup=1", "/preview/")).toBe("tarot");
  expect(canonicalRoom("/app/compatibility/invite/abc")).toBe(canonicalRoom("/app/compatibility/result/def"));
  expect(canonicalRoom("/app/settings")).toBe("profile");
  expect(canonicalRoom("/tarot?setup=1")).toBe(canonicalRoom("/app/tarot"));
  expect(canonicalRoom("/preview/ask", "/preview")).toBe("ask");
  expect(canonicalRoom("/privacy")).toBeNull();
  expect(canonicalRoom("/app")).toBeNull();
});

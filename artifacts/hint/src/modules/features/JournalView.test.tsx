// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { JournalView } from "./JournalView";
import { readJournalDraft, writeJournalDraft } from "./journalDraft";

const mocks = vi.hoisted(() => ({ owner: "journal-owner", closed: false, onLeave: undefined as (() => void) | undefined, create: vi.fn(), reset: vi.fn(), cancel: vi.fn(async () => {}), set: vi.fn(), invalidate: vi.fn(async () => {}), feedback: vi.fn(), nativeListeners: new Set<(active: boolean) => void>() }));
vi.mock("../../lib/feedback", () => ({ triggerFeedback: mocks.feedback }));
vi.mock("../../lib/mobile/appLifecycle", () => ({ addNativeAppStateListener: async (listener: (active: boolean) => void) => {
  mocks.nativeListeners.add(listener); return async () => { mocks.nativeListeners.delete(listener); };
} }));
vi.mock("../../components/app/roomVisits", () => ({ roomVisitWasClosed: () => mocks.closed, markRoomVisitStarted: () => { mocks.closed = false; } }));
vi.mock("../../components/app/RoomVisitBoundary", () => ({ useRoomVisit: (options: { onLeave?: () => void }) => { mocks.onLeave = options.onLeave; } }));
vi.mock("../../lib/identity", () => ({ getAnonId: () => mocks.owner }));
vi.mock("../../lib/i18n", () => ({ useLanguage: () => ({ language: "en", t: (key: string) => key }) }));
vi.mock("../../lib/clearHistory", () => ({ historyClearVersion: (owner: string) => localStorage.getItem(`clear:${owner}`) ?? "" }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ cancelQueries: mocks.cancel, setQueryData: mocks.set, invalidateQueries: mocks.invalidate }) }));
vi.mock("@workspace/api-client-react", () => ({
  getListJournalEntriesQueryKey: ({ anonId }: { anonId: string }) => ["journal", anonId],
  useListJournalEntries: () => ({ data: [], isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }),
  useCreateJournalEntry: (options: { mutation: { onSuccess?: (entry: object) => Promise<void> } }) => ({
    isPending: false, isError: false, reset: mocks.reset,
    mutateAsync: async (input: unknown) => { const entry = await mocks.create(input); await options.mutation.onSuccess?.(entry); return entry; },
  }),
}));
vi.mock("../../components/app/AppChrome", () => ({ AppScreen: ({ children }: { children: ReactNode }) => <main>{children}</main>, GlassPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>, ScreenHeader: () => <h1>Journal</h1>, SectionLabel: ({ children }: { children: ReactNode }) => <h2>{children}</h2> }));
beforeEach(() => { localStorage.clear(); writeJournalDraft("journal-owner", { title: "", body: "", mood: null }); vi.clearAllMocks(); mocks.feedback.mockReset(); mocks.nativeListeners.clear(); mocks.owner = "journal-owner"; mocks.closed = false; mocks.onLeave = undefined; vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible"); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function startPending() {
  let finish!: (entry: object) => void;
  mocks.create.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<JournalView />);
  fireEvent.change(screen.getByTestId("input-journal-body"), { target: { value: "Pending private entry" } });
  fireEvent.click(screen.getByTestId("button-save-journal"));
  return { view, finish: () => finish({ id: "late-entry", body: "Pending private entry" }) };
}
it("does not put a late saved entry back into history after clear", async () => {
  const pending = startPending();
  localStorage.setItem("clear:journal-owner", "new-clear");
  localStorage.removeItem("hint_journal_draft_v1:journal-owner");
  fireEvent(window, new Event("storage"));
  await act(async () => pending.finish());
  expect(mocks.set).not.toHaveBeenCalled();
  expect(screen.queryByText("journal.saved")).toBeNull();
  expect(mocks.feedback).not.toHaveBeenCalled();
  expect((screen.getByTestId("input-journal-body") as HTMLTextAreaElement).value).toBe("");
});
it("does not clear a newer draft or populate cache after leaving the page", async () => {
  const pending = startPending();
  pending.view.unmount();
  const newer = { title: "New page", body: "Keep this newer writing", mood: null };
  writeJournalDraft("journal-owner", newer);
  await act(async () => pending.finish());
  expect(mocks.set).not.toHaveBeenCalled();
  expect(readJournalDraft("journal-owner")).toEqual(newer);
  expect(mocks.feedback).not.toHaveBeenCalled();
});
it("clears only the matching persisted draft when a save succeeds after navigation", async () => {
  const pending = startPending();
  pending.view.unmount();
  await act(async () => pending.finish());
  expect(mocks.set).not.toHaveBeenCalled();
  expect(readJournalDraft("journal-owner").body).toBe("");
  expect(mocks.feedback).not.toHaveBeenCalled();
});
it("does not use the old identity's save to replace the next identity's draft", async () => {
  const pending = startPending();
  mocks.owner = "next-owner";
  writeJournalDraft("next-owner", { title: "", body: "Next owner's writing", mood: null });
  pending.view.rerender(<JournalView />);
  await act(async () => pending.finish());
  expect(mocks.set).not.toHaveBeenCalled();
  expect((screen.getByTestId("input-journal-body") as HTMLTextAreaElement).value).toBe("Next owner's writing");
  expect(mocks.feedback).not.toHaveBeenCalled();
});
it("saves current writing with its submission timestamp and confirms it once", async () => {
  const pending = startPending();
  expect(mocks.create.mock.calls[0][0].data.editedAt).toEqual(expect.any(String));
  await act(async () => pending.finish());
  expect(mocks.set).toHaveBeenCalledTimes(1);
  expect(screen.getByText("journal.saved")).toBeTruthy();
  expect(mocks.feedback.mock.calls).toEqual([["success"]]);
  expect(readJournalDraft("journal-owner").body).toBe("");
});
it("offers manual recovery after departure without saving blank writing over the draft", () => {
  const draft = { title: "An unfinished page", body: "Keep this writing", mood: "still" };
  writeJournalDraft("journal-owner", draft); mocks.closed = true;
  const first = render(<JournalView />);
  expect((screen.getByTestId("input-journal-body") as HTMLTextAreaElement).value).toBe("");
  expect(readJournalDraft("journal-owner")).toEqual(draft);
  fireEvent.click(screen.getByRole("button", { name: "Restore draft" }));
  expect((screen.getByTestId("input-journal-body") as HTMLTextAreaElement).value).toBe(draft.body);
  expect(mocks.feedback).not.toHaveBeenCalled();
  expect(mocks.closed).toBe(false); first.unmount();
  render(<JournalView />);
  expect((screen.getByTestId("input-journal-body") as HTMLTextAreaElement).value).toBe(draft.body);
});
it("preserves a same-text new visit draft when a departed visit's save completes", async () => {
  const pending = startPending();
  act(() => mocks.onLeave?.()); pending.view.unmount(); mocks.closed = true;
  render(<JournalView />);
  fireEvent.change(screen.getByTestId("input-journal-body"), { target: { value: "Pending private entry" } });
  await act(async () => pending.finish());
  expect(readJournalDraft("journal-owner").body).toBe("Pending private entry");
  expect(mocks.set).not.toHaveBeenCalled();
});

async function submit() {
  await act(async () => { fireEvent.click(screen.getByTestId("button-save-journal")); });
  return mocks.create.mock.calls.at(-1)![0].data;
}

it("persists retry identity before sending and retains it through uncertain response, remount and manual recovery", async () => {
  const persistedAtSend: unknown[] = [];
  mocks.create.mockImplementation(async () => {
    const stored = JSON.parse(localStorage.getItem("hint_journal_draft_v1:journal-owner")!);
    persistedAtSend.push(stored?.submission);
    throw new DOMException("Response was lost", "TimeoutError");
  });
  const first = render(<JournalView />);
  fireEvent.change(screen.getByTestId("input-journal-body"), { target: { value: "Keep one page" } });
  const initial = await submit();
  expect(initial.clientRequestId).toMatch(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i);
  expect(await submit()).toEqual(initial);
  first.unmount(); mocks.closed = true;
  const second = render(<JournalView />);
  fireEvent.click(screen.getByRole("button", { name: "Restore draft" }));
  expect(await submit()).toEqual(initial);
  second.unmount(); render(<JournalView />);
  expect(await submit()).toEqual(initial);
  expect(persistedAtSend).toEqual(Array(4).fill({ clientRequestId: initial.clientRequestId, editedAt: initial.editedAt }));
  expect(screen.queryByText("journal.saved")).toBeNull();
  expect(readJournalDraft("journal-owner").body).toBe("Keep one page");
  expect(mocks.feedback).not.toHaveBeenCalled();
});

it("allocates a new retry identity for edited text and a deliberate identical new entry", async () => {
  mocks.create.mockRejectedValue(new Error("Uncertain save"));
  render(<JournalView />);
  const field = screen.getByTestId("input-journal-body");
  fireEvent.change(field, { target: { value: "Identical text" } });
  const initial = await submit();
  fireEvent.change(field, { target: { value: "Edited text" } });
  const edited = await submit();
  expect(edited.clientRequestId).not.toBe(initial.clientRequestId);
  mocks.create.mockResolvedValue({ id: "confirmed", body: "Edited text" });
  expect(await submit()).toEqual(edited);
  fireEvent.change(field, { target: { value: "Edited text" } });
  const deliberate = await submit();
  expect(deliberate.clientRequestId).not.toBe(edited.clientRequestId);
});

it("keeps a failed-storage retry in memory across navigation without claiming durable storage", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota exceeded"); });
  mocks.create.mockRejectedValue(new Error("Uncertain save"));
  const first = render(<JournalView />);
  fireEvent.change(screen.getByTestId("input-journal-body"), { target: { value: "Memory-only attempt" } });
  const initial = await submit();
  expect(initial.clientRequestId).toEqual(expect.any(String));
  expect(await submit()).toEqual(initial);
  first.unmount(); render(<JournalView />);
  expect((screen.getByTestId("input-journal-body") as HTMLTextAreaElement).value).toBe("Memory-only attempt");
  expect(await submit()).toEqual(initial);
  expect(screen.getByText("journal.draftUnavailable")).toBeTruthy();
});

it("upgrades a legacy recovered draft once and keeps its key after a conflict response", async () => {
  localStorage.setItem("hint_journal_draft_v1:journal-owner", JSON.stringify({ title: "Legacy", body: "Existing writing", mood: null }));
  mocks.create.mockRejectedValue(Object.assign(new Error("Conflict"), { status: 409 }));
  const first = render(<JournalView />);
  const initial = await submit();
  expect(initial.clientRequestId).toEqual(expect.any(String));
  first.unmount(); render(<JournalView />);
  expect(await submit()).toEqual(initial);
  expect(readJournalDraft("journal-owner").body).toBe("Existing writing");
  expect(screen.queryByText("journal.saved")).toBeNull();
});

it("ignores double submit and gives one cue only after the confirmed response", async () => {
  const pending = startPending();
  fireEvent.click(screen.getByTestId("button-save-journal"));
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(mocks.feedback).not.toHaveBeenCalled();
  await act(async () => pending.finish());
  expect(mocks.feedback.mock.calls).toEqual([["success"]]);
  pending.view.rerender(<JournalView />);
  expect(mocks.feedback).toHaveBeenCalledTimes(1);
});

it("gives no cue on rejection and only one for the deliberate confirmed retry", async () => {
  mocks.create.mockRejectedValueOnce(new Error("Not confirmed"));
  render(<JournalView />);
  fireEvent.change(screen.getByTestId("input-journal-body"), { target: { value: "Keep this after retry" } });
  const failed = await submit();
  expect(mocks.feedback).not.toHaveBeenCalled();
  expect(readJournalDraft("journal-owner").body).toBe("Keep this after retry");
  mocks.create.mockResolvedValue({ id: "retry-confirmed" });
  expect(await submit()).toEqual(failed);
  expect(mocks.feedback.mock.calls).toEqual([["success"]]);
});

it("keeps newer edits and suppresses the earlier save cue", async () => {
  const pending = startPending();
  fireEvent.change(screen.getByTestId("input-journal-body"), { target: { value: "A newer draft" } });
  await act(async () => pending.finish());
  expect(readJournalDraft("journal-owner").body).toBe("A newer draft");
  expect(screen.queryByText("journal.saved")).toBeNull();
  expect(mocks.feedback).not.toHaveBeenCalled();
});

it("rechecks clear-history after asynchronous cache cancellation before the cue", async () => {
  let resume!: () => void;
  mocks.cancel.mockImplementationOnce(() => new Promise<void>(resolve => { resume = resolve; }));
  const pending = startPending();
  await act(async () => pending.finish());
  expect(mocks.cancel).toHaveBeenCalledOnce();
  expect(mocks.feedback).not.toHaveBeenCalled();
  localStorage.setItem("clear:journal-owner", "after-response-clear");
  fireEvent(window, new Event("storage"));
  await act(async () => resume());
  expect(mocks.set).not.toHaveBeenCalled();
  expect(mocks.feedback).not.toHaveBeenCalled();
});

it.each(["browser-return", "pagehide-return", "native-return", "native-inactive"])("keeps a confirmed save silent after %s", async source => {
  const pending = startPending();
  act(() => {
    if (source === "browser-return") {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden"); document.dispatchEvent(new Event("visibilitychange"));
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible"); document.dispatchEvent(new Event("visibilitychange"));
    } else if (source === "pagehide-return") {
      window.dispatchEvent(new Event("pagehide")); window.dispatchEvent(new Event("pageshow"));
    } else {
      mocks.nativeListeners.forEach(listener => listener(false));
      if (source === "native-return") mocks.nativeListeners.forEach(listener => listener(true));
    }
  });
  await act(async () => pending.finish());
  expect(screen.getByText("journal.saved")).toBeTruthy();
  expect(readJournalDraft("journal-owner").body).toBe("");
  expect(mocks.feedback).not.toHaveBeenCalled();
  act(() => mocks.nativeListeners.forEach(listener => listener(true)));
  pending.view.rerender(<JournalView />);
  expect(mocks.feedback).not.toHaveBeenCalled();
});

it.each([false, true])("uses real preference gating with reduced motion and haptics=%s, without replay", async enabled => {
  const bridge = await vi.importActual<typeof import("../../lib/feedback")>("../../lib/feedback");
  const vibrate = vi.fn(() => true);
  vi.stubGlobal("navigator", { vibrate });
  localStorage.setItem("hint.preferences.v1", JSON.stringify({ soundAndHaptics: enabled, reduceMotion: true }));
  mocks.feedback.mockImplementation(bridge.triggerFeedback);
  const pending = startPending();
  expect(vibrate).not.toHaveBeenCalled();
  await act(async () => pending.finish());
  expect(mocks.feedback.mock.calls).toEqual([["success"]]);
  expect(vibrate.mock.calls).toEqual(enabled ? [[[12, 28, 30]]] : []);
  localStorage.setItem("hint.preferences.v1", JSON.stringify({ soundAndHaptics: true, reduceMotion: false }));
  window.dispatchEvent(new Event("hint:preferences-updated"));
  pending.view.rerender(<JournalView />);
  expect(mocks.feedback).toHaveBeenCalledTimes(1);
  expect(vibrate.mock.calls).toEqual(enabled ? [[[12, 28, 30]]] : []);
});

it("keeps confirmed server success eligible when clearing its local draft fails", async () => {
  const pending = startPending();
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("Storage denied"); });
  await act(async () => pending.finish());
  expect(screen.getByText("journal.saved")).toBeTruthy();
  expect(screen.getByText("journal.draftUnavailable")).toBeTruthy();
  expect(mocks.feedback.mock.calls).toEqual([["success"]]);
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { JournalView } from "./JournalView";
import { readJournalDraft, writeJournalDraft } from "./journalDraft";

const mocks = vi.hoisted(() => ({ owner: "journal-owner", closed: false, onLeave: undefined as (() => void) | undefined, create: vi.fn(), reset: vi.fn(), cancel: vi.fn(async () => {}), set: vi.fn(), invalidate: vi.fn(async () => {}) }));
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
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); mocks.owner = "journal-owner"; mocks.closed = false; mocks.onLeave = undefined; });
afterEach(cleanup);

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
});
it("clears only the matching persisted draft when a save succeeds after navigation", async () => {
  const pending = startPending();
  pending.view.unmount();
  await act(async () => pending.finish());
  expect(mocks.set).not.toHaveBeenCalled();
  expect(readJournalDraft("journal-owner").body).toBe("");
});
it("does not use the old identity's save to replace the next identity's draft", async () => {
  const pending = startPending();
  mocks.owner = "next-owner";
  writeJournalDraft("next-owner", { title: "", body: "Next owner's writing", mood: null });
  pending.view.rerender(<JournalView />);
  await act(async () => pending.finish());
  expect(mocks.set).not.toHaveBeenCalled();
  expect((screen.getByTestId("input-journal-body") as HTMLTextAreaElement).value).toBe("Next owner's writing");
});
it("saves current writing with its submission timestamp and confirms it once", async () => {
  const pending = startPending();
  expect(mocks.create.mock.calls[0][0].data.editedAt).toEqual(expect.any(String));
  await act(async () => pending.finish());
  expect(mocks.set).toHaveBeenCalledTimes(1);
  expect(screen.getByText("journal.saved")).toBeTruthy();
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

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DailyPull } from "@workspace/api-client-react";
import { DailyPullView } from "./DailyPullView";
import { readTextDraft, textDraftKey } from "../../lib/textDraft";

const state = vi.hoisted(() => ({ draws: [] as Array<(pull: DailyPull) => void>, update: vi.fn(), days: [] as string[] }));
vi.mock("@workspace/api-client-react", () => ({
  useGetOrCreateDailyPull: () => ({ mutate: (_: unknown, callbacks: { onSuccess: (pull: DailyPull) => void }) => state.draws.push(callbacks.onSuccess) }),
  useUpdateDailyPull: () => ({ mutateAsync: state.update, isPending: false }),
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: state.days }) }));
vi.mock("../../lib/useProfile", () => ({ useProfile: () => ({ profile: null }) }));
vi.mock("../../lib/useLocalDay", () => ({ useLocalDay: () => "2026-09-10" }));
vi.mock("../../lib/dailyReceipts", () => ({
  getCachedDailyReceipt: () => null,
  getOrCreateDailyReceipt: () => new Promise(() => {}),
  openDailyReceipt: vi.fn(),
  subscribeToDailyReceiptFallbacks: () => () => {},
}));
vi.mock("../home/components/DailyReportCard", () => ({ DailyReportCard: () => <div>Daily card</div> }));
vi.mock("../../lib/i18n", async importOriginal => {
  const original = await importOriginal<typeof import("../../lib/i18n")>();
  return { ...original, useLanguage: () => ({ language: "en", t: (key: string) => original.TRANSLATIONS.en[key] ?? key }) };
});

const pull = (note: string, date = "2026-09-10") => ({
  anonId: "note-recovery-fixture", pullDate: date, cardId: "0-fool", cardName: "The Fool", whisper: "A beginning", note,
  isFlipped: true, createdAt: "2026-09-10T12:00:00Z",
}) as DailyPull;
const draftKey = textDraftKey("daily", "note-recovery-fixture", "2026-09-10");

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); localStorage.setItem("hint_anon_id", "note-recovery-fixture");
  state.draws.length = 0; state.update.mockReset();
});
afterEach(cleanup);

it("a late initial Daily response cannot replace a newer successfully saved note", async () => {
  state.update.mockResolvedValue(pull("My newly saved note"));
  render(<DailyPullView />);
  const note = screen.getByTestId("input-pull-note") as HTMLTextAreaElement;
  fireEvent.change(note, { target: { value: "My newly saved note" } });
  fireEvent.blur(note);
  await waitFor(() => expect(readTextDraft(draftKey)).toBeNull());
  await act(async () => state.draws[0]!(pull("Old server note")));
  expect(note.value).toBe("My newly saved note");
  fireEvent.blur(note);
  expect(state.update).toHaveBeenCalledTimes(1);
});

it("a late initial response and save acknowledgment preserve text edited while saving", async () => {
  let finish!: (value: DailyPull) => void;
  state.update.mockImplementation(() => new Promise<DailyPull>(resolve => { finish = resolve; }));
  render(<DailyPullView />);
  const note = screen.getByTestId("input-pull-note") as HTMLTextAreaElement;
  fireEvent.change(note, { target: { value: "First version" } }); fireEvent.blur(note);
  fireEvent.change(note, { target: { value: "Second version" } });
  await act(async () => finish(pull("First version")));
  await act(async () => state.draws[0]!(pull("Old server note")));
  expect(note.value).toBe("Second version");
  expect(readTextDraft(draftKey)?.text).toBe("Second version");
});

it("the initial server note still hydrates an untouched note field", async () => {
  render(<DailyPullView />);
  await act(async () => state.draws[0]!(pull("Previously saved note")));
  expect((screen.getByTestId("input-pull-note") as HTMLTextAreaElement).value).toBe("Previously saved note");
  fireEvent.blur(screen.getByTestId("input-pull-note"));
  expect(state.update).not.toHaveBeenCalled();
});

it("an earlier date's save and initial response never replace the selected date's note", async () => {
  let finish!: (value: DailyPull) => void;
  state.update.mockImplementation(() => new Promise<DailyPull>(resolve => { finish = resolve; }));
  render(<DailyPullView />);
  const note = screen.getByTestId("input-pull-note") as HTMLTextAreaElement;
  fireEvent.change(note, { target: { value: "September tenth note" } }); fireEvent.blur(note);
  fireEvent.click(screen.getByRole("button", { name: /^Next / }));
  await act(async () => state.draws[1]!(pull("September eleventh note", "2026-09-11")));
  await act(async () => finish(pull("September tenth note")));
  await act(async () => state.draws[0]!(pull("Old September tenth note")));
  expect(note.value).toBe("September eleventh note");
  expect(readTextDraft(draftKey)).toBeNull();
});

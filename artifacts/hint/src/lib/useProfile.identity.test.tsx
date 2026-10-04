// @vitest-environment jsdom
import { createElement, type PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const remote = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock("@workspace/api-client-react", () => ({
  getProfile: remote.get,
  useSaveProfile: () => ({ mutateAsync: remote.save, isPending: false }),
  getGetProfileQueryKey: ({ anonId }: { anonId: string }) => ["profile", anonId],
}));
import { useProfile } from "./useProfile";
import { getAnonId } from "./identity";
const fixture = { anonId: "old-owner", name: "Old reader", birthDate: "2000-01-01", birthPlace: "Taipei", createdAt: "2020-01-01T00:00:00Z" };
beforeEach(() => {
  localStorage.clear(); localStorage.setItem("hint_anon_id", getAnonId());
  remote.get.mockReset(); remote.save.mockReset();
});
afterEach(cleanup);
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: PropsWithChildren) => createElement(QueryClientProvider, { client }, children);
  return { ...renderHook(() => useProfile(), { wrapper }), client };
}
it("does not import a late remote profile into a newly selected local owner", async () => {
  let resolve!: (profile: typeof fixture) => void;
  remote.get.mockImplementation(() => new Promise(done => { resolve = done; }));
  const hook = setup();
  await waitFor(() => expect(remote.get).toHaveBeenCalledOnce());
  localStorage.setItem("hint_anon_id", "new-owner");
  await act(async () => { resolve(fixture); });
  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(localStorage.getItem("hint_birth_profile_v3:new-owner")).toBeNull();
  expect(localStorage.getItem(`hint_birth_profile_v3:${getAnonId()}`)).toBeNull();
  hook.unmount(); hook.client.clear();
});
it("rejects a late profile save instead of publishing a synced result after owner change", async () => {
  remote.get.mockResolvedValue(null);
  let resolve!: (profile: typeof fixture) => void;
  remote.save.mockImplementation(() => new Promise(done => { resolve = done; }));
  const hook = setup();
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  let saved!: Promise<unknown>;
  act(() => { saved = hook.result.current.saveProfile(fixture); });
  const rejected = expect(saved).rejects.toMatchObject({ name: "AbortError" });
  localStorage.setItem("hint_anon_id", "new-owner");
  await act(async () => { resolve(fixture); await rejected; });
  expect(hook.result.current.storageStatus).toBe("local");
  expect(localStorage.getItem("hint_birth_profile_v3:new-owner")).toBeNull();
  hook.unmount(); hook.client.clear();
});

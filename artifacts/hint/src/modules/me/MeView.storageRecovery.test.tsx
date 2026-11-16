// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getGetProfileQueryKey, setAuthFailureHandler, setAuthTokenGetter, setBaseUrl, setRequestIdentityGetter,
} from "@workspace/api-client-react";
import { afterEach, expect, it, vi } from "vitest";
import { MeView } from "./MeView";
import { LanguageProvider } from "../../lib/i18n";
import { captureIdentityContext, getAnonId } from "../../lib/identity";
import { readBirthProfile } from "../../lib/astro/userBirthProfile";

// The actual Me page, ProfileForm, useProfile, generated API client and browser
// storage participate. Only API responses/authentication are synthetic fixtures.
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients) client.clear();
  clients.length = 0;
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  setBaseUrl(null); setAuthTokenGetter(null); setAuthFailureHandler(null); setRequestIdentityGetter(null);
});

function mountPage() {
  const client = new QueryClient({ defaultOptions: {
    queries: { retry: false, gcTime: 0 }, mutations: { retry: false },
  } });
  clients.push(client);
  return {
    client,
    ...render(<QueryClientProvider client={client}><LanguageProvider><MeView /></LanguageProvider></QueryClientProvider>),
  };
}

it("keeps real denied profile writes in the editor, then explicitly saves and restores from device storage", async () => {
  localStorage.clear(); sessionStorage.clear();
  const owner = getAnonId();
  localStorage.setItem("hint_anon_id", owner);
  sessionStorage.setItem("hint.me.letterRevealed", "1");
  const canonicalKey = "hint_birth_profile_v3:" + owner;
  const mirrorKey = "hint_profile_v2_" + owner;
  setBaseUrl("https://profile.invalid");
  setAuthTokenGetter(() => "synthetic-profile-session");
  setRequestIdentityGetter(captureIdentityContext);
  const writes: Array<Record<string, unknown>> = [];
  let getRequests = 0;
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const url = new URL(String(input));
    expect(url.origin).toBe("https://profile.invalid");
    expect(url.pathname).toBe("/api/profile");
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      writes.push(body);
      // Inspect durable state at the transport boundary, before acknowledging.
      expect(readBirthProfile()).toMatchObject({ name: "Storage Recovery Reader", birthDate: "2000-02-29" });
      expect(JSON.parse(localStorage.getItem(mirrorKey)!)).toMatchObject(body);
      return new Response(JSON.stringify({
        ...body, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-11-10T00:00:00.000Z",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    getRequests++;
    return new Response(JSON.stringify({ error: "No remote profile" }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetch);
  const page = mountPage();
  await waitFor(() => expect(page.client.getQueryState(getGetProfileQueryKey({ anonId: owner }))?.status).toBe("success"));
  expect(getRequests).toBe(1);
  expect(document.querySelector('[data-status="unsaved"]')).not.toBeNull();
  fireEvent.click(screen.getByTestId("button-edit-profile"));
  fireEvent.change(screen.getByTestId("input-name"), { target: { value: "Storage Recovery Reader" } });
  fireEvent.change(screen.getByTestId("input-birthdate"), { target: { value: "2000-02-29" } });

  const originalSetItem = Storage.prototype.setItem;
  let denyCanonical = true, deniedWrites = 0;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
    if (this === localStorage && key === canonicalKey && denyCanonical) {
      deniedWrites++;
      throw new DOMException("Synthetic storage denial", "QuotaExceededError");
    }
    originalSetItem.call(this, key, value);
  });
  fireEvent.click(screen.getByTestId("button-save-profile"));
  expect((await screen.findByRole("alert")).textContent).toContain("Could not save your birth details");
  expect(deniedWrites).toBe(1);
  expect(writes).toHaveLength(0);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(canonicalKey)).toBeNull();
  expect(localStorage.getItem(mirrorKey)).toBeNull();
  expect(page.client.getQueryData(getGetProfileQueryKey({ anonId: owner }))).toBeNull();
  expect(document.querySelector('[data-status="synced"]')).toBeNull();
  expect(screen.queryByTestId("button-edit-profile")).toBeNull();
  expect((screen.getByTestId("input-name") as HTMLInputElement).value).toBe("Storage Recovery Reader");
  expect((screen.getByTestId("input-birthdate") as HTMLInputElement).value).toBe("2000-02-29");

  denyCanonical = false;
  fireEvent.click(screen.getByTestId("button-save-profile"));
  await screen.findByTestId("button-edit-profile");
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ anonId: owner, name: "Storage Recovery Reader", birthDate: "2000-02-29" });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(document.querySelector('[data-status="synced"]')).not.toBeNull();
  expect(readBirthProfile()).toMatchObject({ id: owner, name: "Storage Recovery Reader", birthDate: "2000-02-29" });

  fireEvent.click(screen.getByTestId("button-edit-profile"));
  expect((screen.getByTestId("input-name") as HTMLInputElement).value).toBe("Storage Recovery Reader");
  expect((screen.getByTestId("input-birthdate") as HTMLInputElement).value).toBe("2000-02-29");
  page.unmount(); page.client.clear();
  const callsBeforeReload = fetch.mock.calls.length;
  // Fresh React/query state models reload recovery; persistent storage survives.
  // A physical browser navigation is outside this integrated component check.
  const reloaded = mountPage();
  await waitFor(() => expect(reloaded.client.getQueryState(getGetProfileQueryKey({ anonId: owner }))?.status).toBe("success"));
  expect(fetch).toHaveBeenCalledTimes(callsBeforeReload);
  expect(document.querySelector('[data-status="local"]')).not.toBeNull();
  fireEvent.click(screen.getByTestId("button-edit-profile"));
  expect((screen.getByTestId("input-name") as HTMLInputElement).value).toBe("Storage Recovery Reader");
  expect((screen.getByTestId("input-birthdate") as HTMLInputElement).value).toBe("2000-02-29");
  expect(writes).toHaveLength(1);
});

// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.resetModules();
  localStorage.setItem("hint_anon_id", "fixture-owner");
  let queue = Promise.resolve();
  vi.stubGlobal("navigator", { locks: { request: (_name: string, _options: unknown, work: () => unknown) => {
    const result = queue.then(work); queue = result.then(() => undefined, () => undefined); return result;
  } } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("separate app realms share the same durable enrollment through Web Locks", async () => {
  const enroll = vi.fn(async () => new Response(JSON.stringify({ token: "x".repeat(64), ownerId: "remote-fixture", expiresAt: "2030-01-01" }), { headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", enroll);
  const first = await import("./deviceSession");
  vi.resetModules();
  const second = await import("./deviceSession");
  const tokens = await Promise.all([first.getDeviceSessionToken(), second.getDeviceSessionToken()]);
  expect(tokens).toEqual(["x".repeat(64), "x".repeat(64)]);
  expect(enroll).toHaveBeenCalledTimes(1);
  vi.resetModules();
  expect(await (await import("./deviceSession")).getDeviceSessionToken()).toBe(tokens[0]);
  expect(enroll).toHaveBeenCalledTimes(1);
});
it("does not use a cached manager after the stored local profile switches", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ token: "x".repeat(64), ownerId: "remote-fixture", expiresAt: "2030-01-01" }))));
  const session = await import("./deviceSession");
  await session.getDeviceSessionToken();
  localStorage.setItem("hint_anon_id", "new-owner");
  await expect(session.getDeviceSessionToken()).rejects.toMatchObject({ name: "AbortError" });
});
it("reports unavailable browser coordination without enrolling or erasing a saved credential", async () => {
  vi.stubGlobal("navigator", {});
  const enroll = vi.fn(); vi.stubGlobal("fetch", enroll);
  const credentialKey = "hint_device_session_v1::fixture-owner";
  const value = JSON.stringify({ token: "x".repeat(64), ownerId: "remote-fixture", expiresAt: "2030-01-01" });
  localStorage.setItem(credentialKey, value);
  const session = await import("./deviceSession");
  await expect(session.getDeviceSessionToken()).rejects.toMatchObject({ reason: "storage" });
  expect(session.getDeviceSessionFailure()).toBe("storage");
  expect(enroll).not.toHaveBeenCalled();
  expect(localStorage.getItem(credentialKey)).toBe(value);
});

it("finishes durable enrollment before a queued profile switch can copy its namespace", async () => {
  let complete!: (response: Response) => void;
  const enroll = vi.fn(() => new Promise<Response>(resolve => { complete = resolve; }));
  vi.stubGlobal("fetch", enroll);
  const session = await import("./deviceSession");
  const identity = await import("./identity");
  const token = session.getDeviceSessionToken();
  // Install the rejection observer before a queued switch can invalidate it.
  const observed = token.then(value => ({ value }), error => ({ error }));
  await vi.waitFor(() => expect(enroll).toHaveBeenCalledOnce());
  let switched = false;
  const switching = identity.switchLocalProfile().then(owner => { switched = true; return owner; });
  await Promise.resolve(); expect(switched).toBe(false);
  complete(new Response(JSON.stringify({ token: "x".repeat(64), ownerId: "remote-fixture", expiresAt: "2030-01-01" })));
  const next = await switching; await observed;
  expect(next).not.toBe("fixture-owner");
  expect(JSON.parse(localStorage.getItem("hint_device_session_v1::fixture-owner")!)).toMatchObject({ ownerId: "remote-fixture", token: "x".repeat(64) });
  expect(localStorage.getItem(`hint_device_session_v1::${next}`)).toBeNull();
  expect(enroll).toHaveBeenCalledOnce();
});

it("sends a saved tester invite, reports invite failures and connects after a new code", async () => {
  const bodies: unknown[] = [];
  const responses = [
    new Response(JSON.stringify({ error: "needs invite", code: "INVITE_REQUIRED" }), { status: 403 }),
    new Response(JSON.stringify({ error: "full", code: "INVITE_EXHAUSTED" }), { status: 403 }),
    new Response(JSON.stringify({ token: "x".repeat(64), ownerId: "remote-fixture", expiresAt: "2030-01-01" }), { status: 201 }),
  ];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => { bodies.push(JSON.parse(String(init.body))); return responses.shift()!; }));
  const session = await import("./deviceSession");
  await expect(session.getDeviceSessionToken()).rejects.toMatchObject({ reason: "invite" });
  expect(session.getDeviceSessionFailure()).toBe("invite");
  session.saveTesterInvite("  ABCD-EFGH ");
  await expect(session.getDeviceSessionToken()).rejects.toMatchObject({ reason: "inviteFull" });
  session.saveTesterInvite("WXYZ-2345");
  expect(await session.getDeviceSessionToken()).toBe("x".repeat(64));
  expect(session.getDeviceSessionFailure()).toBeNull();
  expect(bodies).toEqual([{}, { inviteCode: "ABCD-EFGH" }, { inviteCode: "WXYZ-2345" }]);
});

it("saves a tester link's invite and removes it from the address bar", async () => {
  window.history.replaceState(null, "", "/app/today?tester=ABCD-EFGH&lang=es#top");
  const session = await import("./deviceSession");
  session.captureTesterInviteFromUrl();
  expect(session.readTesterInvite()).toBe("ABCD-EFGH");
  expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe("/app/today?lang=es#top");
  window.history.replaceState(null, "", "/app");
  session.captureTesterInviteFromUrl();
  expect(session.readTesterInvite()).toBe("ABCD-EFGH");
});

it("does not ask the server again with a code it already refused", async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ code: "INVITE_REQUIRED" }), { status: 403 }));
  vi.stubGlobal("fetch", fetch);
  const session = await import("./deviceSession");
  await expect(session.getDeviceSessionToken()).rejects.toMatchObject({ reason: "invite" });
  await expect(session.getDeviceSessionToken()).rejects.toMatchObject({ reason: "invite" });
  await expect(session.getDeviceSessionToken()).rejects.toMatchObject({ reason: "invite" });
  expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockImplementation(async () => new Response(JSON.stringify({ token: "x".repeat(64), ownerId: "remote-fixture", expiresAt: "2030-01-01" }), { status: 201 }));
  session.saveTesterInvite("ABCD-EFGH");
  expect(await session.getDeviceSessionToken()).toBe("x".repeat(64));
  expect(fetch).toHaveBeenCalledTimes(2);
});

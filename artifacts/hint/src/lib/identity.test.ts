// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.resetModules();
  let queue = Promise.resolve();
  vi.stubGlobal("navigator", { locks: { request: (_name: string, _options: unknown, work: () => unknown) => {
    const result = queue.then(work); queue = result.then(() => undefined, () => undefined); return result;
  } } });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("chooses one initial owner when two fresh app realms initialize together", async () => {
  const first = await import("./identity");
  vi.resetModules();
  const second = await import("./identity");
  const [firstOwner, secondOwner] = await Promise.all([first.initializeLocalIdentity(), second.initializeLocalIdentity()]);
  expect(firstOwner).toBe(secondOwner);
  expect(localStorage.getItem("hint_anon_id")).toBe(firstOwner);
});
it("switches before new profile entry and restores only that local namespace", async () => {
  localStorage.setItem("hint_anon_id", "first-owner");
  localStorage.setItem("hint_local_auth_v1", JSON.stringify({ name: "First reader" }));
  localStorage.setItem("hint_onboarding_complete_v3", "1");
  localStorage.setItem("hint_profile_v2_first-owner", JSON.stringify({ name: "First reader", birthDate: "2000-01-01" }));
  localStorage.setItem("hint-theme", "dark");
  localStorage.setItem("hint_active_tarot_reading_v1", "first local Tarot session");
  sessionStorage.setItem("hint_active_tarot_reading_v1", "first tab Tarot session");
  const identity = await import("./identity");
  const next = await identity.switchLocalProfile();
  expect(next).not.toBe("first-owner"); expect(identity.getAnonId()).toBe(next);
  expect(localStorage.getItem("hint_local_auth_v1")).toBeNull();
  expect(localStorage.getItem("hint_onboarding_complete_v3")).toBeNull();
  expect(localStorage.getItem("hint_active_tarot_reading_v1")).toBeNull();
  expect(sessionStorage.getItem("hint_active_tarot_reading_v1")).toBeNull();
  expect(localStorage.getItem(`hint_profile_v2_${next}`)).toBeNull();
  expect(localStorage.getItem("hint_profile_v2_first-owner")).toContain("2000-01-01");
  localStorage.setItem("hint_local_auth_v1", JSON.stringify({ name: "Second reader" }));
  await identity.switchLocalProfile("first-owner");
  expect(identity.getAnonId()).toBe("first-owner");
  expect(localStorage.getItem("hint_local_auth_v1")).toContain("First reader");
  expect(localStorage.getItem("hint_onboarding_complete_v3")).toBe("1");
  expect(localStorage.getItem("hint-theme")).toBe("dark");
  expect(localStorage.getItem("hint_active_tarot_reading_v1")).toBe("first local Tarot session");
  expect(sessionStorage.getItem("hint_active_tarot_reading_v1")).toBe("first tab Tarot session");
  expect(identity.listLocalProfiles().find(row => row.id === next)?.label).toBe("Second reader");
});
it("does not select an arbitrary unknown namespace", async () => {
  localStorage.setItem("hint_anon_id", "first-owner");
  const identity = await import("./identity");
  await expect(identity.switchLocalProfile("guessed-server-owner")).rejects.toThrow("Unknown local profile");
  expect(identity.getAnonId()).toBe("first-owner");
});
it("a failed namespace write keeps the current profile and its data", async () => {
  localStorage.setItem("hint_anon_id", "first-owner");
  localStorage.setItem("hint_local_auth_v1", '{"name":"First reader"}');
  const identity = await import("./identity");
  const write = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === "hint_anon_id" && value !== "first-owner") throw new Error("Storage failed");
    return write.call(this, key, value);
  });
  await expect(identity.switchLocalProfile()).rejects.toThrow("Storage failed");
  expect(identity.getAnonId()).toBe("first-owner");
  expect(localStorage.getItem("hint_local_auth_v1")).toContain("First reader");
});
it("serializes snapshot requests and rejects a queued request from the previous owner", async () => {
  localStorage.setItem("hint_anon_id", "first-owner");
  const identity = await import("./identity");
  const [first, second] = await Promise.allSettled([identity.switchLocalProfile(), identity.switchLocalProfile()]);
  expect(first.status).toBe("fulfilled");
  expect(second).toMatchObject({ status: "rejected", reason: { name: "AbortError" } });
  expect(JSON.parse(localStorage.getItem("hint_local_profile_index_v1")!)).toHaveLength(2);
});
it("aborts captured work and reloads once when another tab changes the persisted owner", async () => {
  localStorage.setItem("hint_anon_id", "first-owner");
  const identity = await import("./identity");
  const context = identity.captureIdentityContext();
  const changed = vi.fn();
  const close = vi.fn();
  const channel = { onmessage: null as null | (() => void), close };
  vi.stubGlobal("BroadcastChannel", vi.fn(function () { return channel; }));
  const stop = identity.startIdentityCoordination(changed);
  sessionStorage.setItem("hint_active_tarot_reading_v1", "old private recovery");
  localStorage.setItem("hint_anon_id", "second-owner");
  channel.onmessage?.();
  window.dispatchEvent(new StorageEvent("storage", { key: "hint_anon_id" }));
  expect(changed).toHaveBeenCalledTimes(1);
  expect(context.signal.aborted).toBe(true);
  expect(() => context.assertCurrent()).toThrow();
  expect(sessionStorage.getItem("hint_active_tarot_reading_v1")).toBeNull();
  stop(); expect(close).toHaveBeenCalledOnce();
});
it("keeps all stored profiles when browser coordination is unavailable", async () => {
  vi.stubGlobal("navigator", {});
  localStorage.setItem("hint_anon_id", "first-owner");
  localStorage.setItem("hint_local_auth_v1", '{"name":"First reader"}');
  const identity = await import("./identity");
  await expect(identity.switchLocalProfile()).rejects.toThrow("coordination");
  expect(localStorage.getItem("hint_anon_id")).toBe("first-owner");
  expect(localStorage.getItem("hint_local_profile_index_v1")).toBeNull();
  expect(localStorage.getItem("hint_local_auth_v1")).toContain("First reader");
});
it("rejects a stale tab before snapshotting another profile's global account", async () => {
  localStorage.setItem("hint_anon_id", "first-owner");
  const identity = await import("./identity");
  identity.getAnonId();
  localStorage.setItem("hint_anon_id", "second-owner");
  localStorage.setItem("hint_local_auth_v1", '{"name":"Second reader"}');
  const before = localStorage.getItem("hint_local_profile_index_v1");
  await expect(Promise.resolve().then(() => identity.switchLocalProfile())).rejects.toMatchObject({ name: "AbortError" });
  expect(localStorage.getItem("hint_local_profile_index_v1")).toBe(before);
  expect(localStorage.getItem("hint_anon_id")).toBe("second-owner");
});

it("blocks old-owner readers and writers while another tab copies shared profile slots", async () => {
  localStorage.setItem("hint_anon_id", "first-owner");
  localStorage.setItem("hint_local_auth_v1", '{"name":"First reader"}');
  localStorage.setItem("hint_local_profile_index_v1", JSON.stringify([{ id: "second-owner", label: "Second", values: { hint_local_auth_v1: '{"name":"Second reader"}' }, activeTarot: null }]));
  const first = await import("./identity");
  const firstAccount = await import("./auth");
  const context = first.captureIdentityContext();
  vi.resetModules();
  const second = await import("./identity");
  const checks: Array<() => void> = [];
  const write = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    write.call(this, key, value);
    if (key === "hint_local_auth_v1" && value.includes("Second reader")) {
      let contextError: unknown;
      try { context.assertCurrent(); } catch (error) { contextError = error; }
      checks.push(() => expect(contextError).toMatchObject({ name: "AbortError" }));
      const account = firstAccount.getLocalAccount();
      let writerError: unknown;
      try { firstAccount.clearLocalAccount(); } catch (error) { writerError = error; }
      checks.push(() => expect(account).toBeNull());
      checks.push(() => expect(writerError).toMatchObject({ name: "AbortError" }));
    }
  });
  await second.switchLocalProfile("second-owner");
  expect(checks).toHaveLength(3); checks.forEach(check => check());
  expect(localStorage.getItem("hint_local_auth_v1")).toContain("Second reader");
});

it("fences old work after another tab switches away and back before notification delivery", async () => {
  localStorage.setItem("hint_anon_id", "first-owner");
  const first = await import("./identity");
  const context = first.captureIdentityContext();
  vi.resetModules();
  const second = await import("./identity");
  await second.switchLocalProfile();
  await second.switchLocalProfile("first-owner");
  expect(localStorage.getItem("hint_anon_id")).toBe("first-owner");
  expect(() => context.assertCurrent()).toThrow();
  await expect(first.switchLocalProfile()).rejects.toMatchObject({ name: "AbortError" });
});

it("retains its recovery journal if rollback fails, and restores the previous complete profile on a fresh boot", async () => {
  localStorage.setItem("hint_anon_id", "first-owner");
  localStorage.setItem("hint_local_auth_v1", '{"name":"First reader"}');
  localStorage.setItem("hint_active_tarot_reading_v1", "First durable recovery");
  localStorage.setItem("hint_local_profile_index_v1", JSON.stringify([{ id: "second-owner", label: "Second", values: { hint_local_auth_v1: '{"name":"Second reader"}' }, activeTarot: null }]));
  const before = localStorage.getItem("hint_local_profile_index_v1");
  const identity = await import("./identity");
  const oldContext = identity.captureIdentityContext();
  const write = Storage.prototype.setItem;
  let failWrites = false;
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === "hint_anon_id" && value === "second-owner") failWrites = true;
    if (failWrites) throw new Error("Unavailable storage");
    write.call(this, key, value);
  });
  await expect(identity.switchLocalProfile("second-owner")).rejects.toThrow("Unavailable storage");
  expect(localStorage.getItem("hint_identity_transition_v1")).not.toBeNull();
  expect(() => oldContext.assertCurrent()).toThrow();
  expect(() => identity.captureIdentityContext()).toThrow();
  spy.mockRestore(); vi.resetModules();
  const fresh = await import("./identity");
  expect(await fresh.initializeLocalIdentity()).toBe("first-owner");
  expect(localStorage.getItem("hint_local_auth_v1")).toContain("First reader");
  expect(localStorage.getItem("hint_active_tarot_reading_v1")).toBe("First durable recovery");
  expect(localStorage.getItem("hint_local_profile_index_v1")).toBe(before);
  expect(localStorage.getItem("hint_identity_transition_v1")).toBeNull();
  expect(() => fresh.captureIdentityContext()).not.toThrow();
});

it("keeps an unrecognized transition blocked and intact instead of guessing account ownership", async () => {
  localStorage.setItem("hint_anon_id", "first-owner");
  localStorage.setItem("hint_identity_transition_v1", '{"version":99}');
  const identity = await import("./identity");
  await expect(identity.initializeLocalIdentity()).rejects.toThrow();
  expect(localStorage.getItem("hint_identity_transition_v1")).toBe('{"version":99}');
  expect(() => identity.captureIdentityContext()).toThrow();
});

it("aborts other-tab work on the transition fence before the owner ID changes", async () => {
  localStorage.setItem("hint_anon_id", "first-owner");
  const identity = await import("./identity");
  const context = identity.captureIdentityContext();
  const changed = vi.fn(); const stop = identity.startIdentityCoordination(changed);
  localStorage.setItem("hint_identity_transition_v1", "pending");
  window.dispatchEvent(new StorageEvent("storage", { key: "hint_identity_transition_v1" }));
  expect(context.signal.aborted).toBe(true);
  expect(changed).toHaveBeenCalledOnce();
  stop();
});

it("snapshots the owner-scoped account instead of an obsolete shared mirror", async () => {
  localStorage.setItem("hint_anon_id", "first-owner");
  localStorage.setItem("hint_local_auth_v1", '{"name":"Obsolete shared label"}');
  localStorage.setItem("hint_local_auth_v2:first-owner", '{"name":"Current owner label"}');
  const identity = await import("./identity");
  const other = await identity.switchLocalProfile();
  localStorage.setItem(`hint_local_auth_v2:${other}`, '{"name":"Other owner label"}');
  await identity.switchLocalProfile("first-owner");
  expect(identity.listLocalProfiles()).toEqual(expect.arrayContaining([
    { id: "first-owner", label: "Current owner label", current: true },
    { id: other, label: "Other owner label", current: false },
  ]));
  expect(localStorage.getItem(`hint_local_auth_v2:${other}`)).toContain("Other owner label");
});

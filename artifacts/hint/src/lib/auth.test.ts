// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearLocalAccount, getLocalAccount, saveLocalAccount } from "./auth";
import { getAnonId } from "./identity";
beforeEach(() => { localStorage.clear(); localStorage.setItem("hint_anon_id", getAnonId()); });
afterEach(() => vi.restoreAllMocks());
it("never announces a saved account when the storage write fails", () => {
  const updated = vi.fn(); window.addEventListener("hint:local-auth-updated", updated);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
  expect(() => saveLocalAccount({ provider: "email", identifier: "fixture@hint.test" })).toThrow();
  expect(getLocalAccount()).toBeNull(); expect(updated).not.toHaveBeenCalled();
  window.removeEventListener("hint:local-auth-updated", updated);
});
it("does not inherit a previous label's name or verification time", () => {
  saveLocalAccount({ provider: "email", identifier: "one@hint.test", name: "First", verifiedAt: "2000-01-01" });
  const next = saveLocalAccount({ provider: "email", identifier: "two@hint.test" });
  expect(next.name).toBeUndefined(); expect(next.verifiedAt).not.toBe("2000-01-01");
});
it("reports failed sign out and retains the stored account", () => {
  saveLocalAccount({ provider: "email", identifier: "fixture@hint.test" });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Denied"); });
  expect(clearLocalAccount).toThrow("Denied"); expect(getLocalAccount()?.identifier).toBe("fixture@hint.test");
});
it("never reads or overwrites another tab's newly selected account", () => {
  localStorage.setItem("hint_anon_id", "another-owner");
  localStorage.setItem("hint_local_auth_v1", '{"name":"Another reader"}');
  expect(getLocalAccount()).toBeNull();
  expect(() => saveLocalAccount({ provider: "email", identifier: "old@hint.test" })).toThrow();
  expect(clearLocalAccount).toThrow();
  expect(localStorage.getItem("hint_local_auth_v1")).toContain("Another reader");
});

it("cannot overwrite the next owner's account when selection changes between checking and writing", () => {
  const owner = getAnonId();
  const write = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key.startsWith("hint_local_auth_")) {
      write.call(this, "hint_anon_id", "next-owner");
      write.call(this, "hint_local_auth_v2:next-owner", '{"identifier":"next@hint.test"}');
      write.call(this, "hint_local_auth_v1", '{"identifier":"next@hint.test"}');
    }
    write.call(this, key, value);
  });
  expect(() => saveLocalAccount({ provider: "email", identifier: "old@hint.test" })).toThrow();
  expect(localStorage.getItem("hint_local_auth_v2:next-owner")).toContain("next@hint.test");
  expect(localStorage.getItem("hint_local_auth_v1")).toContain("next@hint.test");
  expect(localStorage.getItem(`hint_local_auth_v2:${owner}`)).not.toContain("next@hint.test");
});

it("does not adopt legacy account bytes read across an owner change", () => {
  const owner = getAnonId();
  const read = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) {
    if (key === "hint_local_auth_v1") {
      localStorage.setItem("hint_anon_id", "next-owner");
      return '{"identifier":"next@hint.test"}';
    }
    return read.call(this, key);
  });
  expect(getLocalAccount()).toBeNull();
  expect(localStorage.getItem(`hint_local_auth_v2:${owner}`)).toBeNull();
});

it("imports stable legacy account data without deleting it and keeps sign-out durable", () => {
  const owner = getAnonId();
  const raw = '{"provider":"email","identifier":"legacy@hint.test","name":"Legacy"}';
  localStorage.setItem("hint_local_auth_v1", raw);
  expect(getLocalAccount()?.name).toBe("Legacy");
  expect(localStorage.getItem(`hint_local_auth_v2:${owner}`)).toBe(raw);
  clearLocalAccount();
  expect(getLocalAccount()).toBeNull();
  expect(localStorage.getItem(`hint_local_auth_v2:${owner}`)).toBe("null");
  expect(localStorage.getItem("hint_local_auth_v1")).toBe(raw);
});

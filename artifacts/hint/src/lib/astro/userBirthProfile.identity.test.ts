// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const fixture = { name: "First", birthDate: "2000-01-01", birthPlace: "Taipei" };
beforeEach(() => { localStorage.clear(); vi.resetModules(); localStorage.setItem("hint_anon_id", "first-owner"); });
afterEach(() => vi.restoreAllMocks());

it("blocks birth migration and saves while a different tab is copying a profile", async () => {
  const birth = await import("./userBirthProfile");
  birth.saveBirthProfile(fixture);
  localStorage.setItem("hint_identity_transition_v1", "pending");
  expect(birth.readBirthProfile()).toBeNull();
  expect(() => birth.saveBirthProfile({ ...fixture, name: "Changed" })).toThrow();
  expect(() => birth.clearBirthProfile()).toThrow();
  expect(localStorage.getItem("hint_birth_profile_v3:first-owner")).toContain('"name":"First"');
});

it("never redirects birth writes to the next profile during a storage interleaving", async () => {
  const birth = await import("./userBirthProfile");
  birth.saveBirthProfile(fixture);
  const write = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === "hint_birth_profile_v3:first-owner") {
      write.call(this, "hint_anon_id", "next-owner");
      write.call(this, "hint_birth_profile_v3:next-owner", "Retained next profile");
    }
    write.call(this, key, value);
  });
  expect(() => birth.saveBirthProfile({ ...fixture, name: "Changed" })).toThrow();
  expect(localStorage.getItem("hint_birth_profile_v3:next-owner")).toBe("Retained next profile");
  expect(localStorage.getItem("hint_profile_v2_next-owner")).toBeNull();
});

it("keeps legacy birth backups while a scoped tombstone prevents cleared data from being adopted again", async () => {
  const birth = await import("./userBirthProfile");
  localStorage.setItem("hint.birthProfile", JSON.stringify(fixture));
  expect(birth.readBirthProfile()?.name).toBe("First");
  birth.clearBirthProfile();
  expect(birth.readBirthProfile()).toBeNull();
  expect(localStorage.getItem("hint.birthProfile")).toBe(JSON.stringify(fixture));
  birth.saveBirthProfile({ ...fixture, name: "Reviewed again" });
  expect(birth.readBirthProfile()?.name).toBe("Reviewed again");
});

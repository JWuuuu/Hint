// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { validBirthDate, optionalBirthNumber, birthDetailsError } from "./birthDetails";
vi.mock("./identity", () => ({ getAnonId: () => "fixture", captureIdentityContext: () => ({ owner: "fixture", assertCurrent: () => {} }) }));
import { readBirthProfile, saveBirthProfile, getBirthProfileConflict, migrateBirthProfile, clearBirthProfile } from "./astro/userBirthProfile";
beforeEach(() => localStorage.clear());
it("validates calendar, leap years, future dates, time and coordinate limits", () => {
  for (const day of ["2026-99-99", "2025-02-29", "1900-02-29", "2024-04-31", "2999-01-01", "0000-01-01"]) expect(validBirthDate(day)).toBe(false);
  for (const day of ["2000-02-29", "2024-02-29", "2001-12-31"]) expect(validBirthDate(day)).toBe(true);
  expect(birthDetailsError({ birthDate: "2000-02-29", birthTime: "24:00" })).toBe("birthTime");
  expect(birthDetailsError({ birthDate: "2000-02-29", latitude: 91 })).toBe("latitude");
  expect(birthDetailsError({ birthDate: "2000-02-29", timezone: "Not/AZone" })).toBe("timezone");
  expect(optionalBirthNumber("")).toBeUndefined(); expect(optionalBirthNumber(" ")).toBeUndefined();
  expect(optionalBirthNumber("0")).toBe(0);
});
it("migrates compatible fields without assigning an unknown time or device timezone", () => {
  localStorage.setItem("hint_profile_v2_fixture", JSON.stringify({ name: "A", birthDate: "2000-01-01" }));
  localStorage.setItem("hint.birthProfile", JSON.stringify({ name: "A", birthDate: "2000-01-01", birthPlace: "Tokyo", latitude: 35.67, longitude: 139.65, timezone: "Asia/Tokyo", timezoneOffset: 9 }));
  const profile = readBirthProfile();
  expect(profile?.latitude).toBe(35.67); expect(profile?.birthTime).toBeUndefined();
  expect(readBirthProfile()).toEqual(profile);
});
it("backs up migration conflicts, withholding personal charts until an explicit reviewed save", () => {
  const account = { name: "A", birthDate: "2000-01-01" };
  const legacy = { name: "A", birthDate: "2001-01-01", birthPlace: "Tokyo" };
  localStorage.setItem("hint_profile_v2_fixture", JSON.stringify(account));
  localStorage.setItem("hint.birthProfile", JSON.stringify(legacy));
  expect(readBirthProfile()).toBeNull();
  expect(getBirthProfileConflict()).toEqual({ account, legacy });
  expect(readBirthProfile()).toBeNull();
  saveBirthProfile({ ...account, birthPlace: "" });
  expect(readBirthProfile()?.birthDate).toBe("2000-01-01");
  expect(readBirthProfile()?.timezone).toBeUndefined();
  expect(localStorage.getItem("hint_birth_conflict_v3:fixture:backup")).toBeTruthy();
  expect(localStorage.getItem("hint.birthProfile")).toBe(JSON.stringify(legacy));
});
it("does not claim another owner's legacy birth data or resurrect explicitly removed data", () => {
  localStorage.setItem("hint.birthProfile", JSON.stringify({ name: "A", birthDate: "2000-01-01" }));
  expect(readBirthProfile()?.name).toBe("A");
  expect(migrateBirthProfile("another-owner")).toBeNull();
  clearBirthProfile();
  expect(readBirthProfile()).toBeNull();
});

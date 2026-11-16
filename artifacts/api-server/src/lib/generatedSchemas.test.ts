import { expect, it } from "vitest";
import {
  CreatePersistedCompatibilityInviteResponse, CreateTranscriptionQueryParams,
  GetPersistedCompatibilityResultParams, GetProfileQueryParams, HealthCheckResponse,
  SyncOfflineDailyReceiptBody,
} from "@workspace/api-zod";

it("loads generated v4 schemas and validates UUID path strings", () => {
  const id = "3a314bef-e98e-4c72-8af6-211c14666eb4";
  expect(GetPersistedCompatibilityResultParams.parse({ id })).toEqual({ id });
  for (const value of ["invalid", "", undefined, null, 42]) {
    expect(GetPersistedCompatibilityResultParams.safeParse({ id: value }).success).toBe(false);
  }
  expect(HealthCheckResponse.parse({ status: "ok" })).toEqual({ status: "ok" });
});

it("preserves generated query defaults, string coercion, records, and date coercion", () => {
  expect(CreateTranscriptionQueryParams.parse({})).toEqual({ language: "en" });
  expect(GetProfileQueryParams.parse({ anonId: 42 })).toEqual({ anonId: "42" });
  const record = { nested: { cards: [] }, absent: null, count: 2 };
  expect(CreatePersistedCompatibilityInviteResponse.parse(record)).toEqual(record);
  const value = SyncOfflineDailyReceiptBody.parse({
    featureType: "daily-tarot", dailyKey: "2026-11-10", assignedCardId: null,
    openedAt: "2026-11-10T10:00:00.000Z",
  });
  expect(value.dailyKey).toEqual(new Date("2026-11-10"));
  expect(value.openedAt).toEqual(new Date("2026-11-10T10:00:00.000Z"));
});

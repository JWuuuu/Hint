import { describe, expect, it } from "vitest";
import { formatInviteCode, generateInviteCode, INVITE_ALPHABET, inviteCodeHash, invitesRequired, normalizeInviteCode } from "./testerInvites";
// The admin script must create codes the server accepts.
import * as script from "../../../../lib/db/scripts/invites.mjs";

describe("tester invites", () => {
  it("are required in production unless explicitly switched", () => {
    expect(invitesRequired({ NODE_ENV: "production" })).toBe(true);
    expect(invitesRequired({ NODE_ENV: "production", HINT_TESTER_INVITES_REQUIRED: "0" })).toBe(false);
    expect(invitesRequired({ NODE_ENV: "development" })).toBe(false);
    expect(invitesRequired({ NODE_ENV: "test", HINT_TESTER_INVITES_REQUIRED: "1" })).toBe(true);
    expect(invitesRequired({})).toBe(false);
  });

  it("accept codes typed with spaces, dashes or lower case, and nothing ambiguous", () => {
    expect(normalizeInviteCode("abcd-efgh")).toBe("ABCDEFGH");
    expect(normalizeInviteCode(" WXYZ 2345 ")).toBe("WXYZ2345");
    for (const bad of ["ABCD-EFG1", "OOOO-OOOO", "IIII-IIII", "ABCDEFG", "ABCDEFGHJ", "", "ABCD-EFGH; DROP", 12345678, null, "A".repeat(41)]) {
      expect(normalizeInviteCode(bad)).toBeNull();
    }
  });

  it("generates uniform 8-symbol codes that round-trip through their printed form", () => {
    const counts = new Map<string, number>();
    for (let index = 0; index < 4000; index++) {
      const code = generateInviteCode();
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
      expect(normalizeInviteCode(formatInviteCode(code))).toBe(code);
      for (const symbol of code) counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
    }
    expect(counts.size).toBe(32);
    // 32,000 symbols: each of 32 should appear about 1,000 times.
    for (const count of counts.values()) expect(count).toBeGreaterThan(800);
  });

  it("match the admin script's alphabet, format and hash", () => {
    expect(script.INVITE_ALPHABET).toBe(INVITE_ALPHABET);
    const code = script.generateInviteCode();
    expect(normalizeInviteCode(script.formatInviteCode(code))).toBe(code);
    expect(script.inviteCodeHash(code)).toBe(inviteCodeHash(code));
    expect(inviteCodeHash("ABCDEFGH")).toHaveLength(64);
    expect(inviteCodeHash("ABCDEFGH")).not.toContain("ABCDEFGH");
  });
});

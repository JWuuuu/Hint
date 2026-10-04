import { describe, expect, it } from "vitest";
import { safeRequestPath } from "./requestContext";
describe("privacy-safe request paths", () => {
  it("masks case variants, encoded invite paths and all query values", () => {
    expect(safeRequestPath("/api/Compatibility/Invite/secret-token/complete?name=Private")).toBe("/api/compatibility/invite/[token]/complete");
    expect(safeRequestPath("/api/%63ompatibility/invite/%73ecret-token")).toBe("/api/compatibility/invite/[token]");
    expect(safeRequestPath("/api/profile?anonId=private-owner")).toBe("/api/profile");
    expect(safeRequestPath("/api/%E0%A4%A")).toBe("[invalid-path]");
  });
});

import { expect, it } from "vitest";
import { localProfileDestination } from "./localProfileDestination";
it("preserves a pending invitation and its state under the configured hosting base", () => {
  expect(localProfileDestination("/hint/", { pathname: "/hint/app/compatibility/invite/token_123", search: "?from=link", hash: "#details" })).toBe("/hint/app/compatibility/invite/token_123?from=link#details");
});
it("returns unrelated and unsafe destinations to the local profile page", () => {
  expect(localProfileDestination("/hint/", { pathname: "/hint/app/ask", search: "?conversation=private", hash: "" })).toBe("/hint/app/profile");
  expect(localProfileDestination("/", { pathname: "/app/compatibility/invite/%2f%2felsewhere", search: "", hash: "" })).toBe("/app/profile");
  expect(localProfileDestination("./", { pathname: "/app/profile", search: "", hash: "" })).toBe("/app/profile");
});

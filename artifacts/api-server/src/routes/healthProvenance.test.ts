import express from "express";
import type { Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ query: vi.fn(), expected: vi.fn() }));
vi.mock("@workspace/db", () => ({ pool: { query: fixture.query } }));
vi.mock("../lib/schemaReadiness", () => ({ expectedMigrations: fixture.expected }));
import router from "./health";
import { requireDeviceSession } from "../lib/deviceSession";

const migration = { name: "001_fixture.sql", sha256: "a".repeat(64) };
let server: Server, origin: string;
beforeAll(async () => {
  const app = express();
  app.use("/api", router);
  app.get("/api/protected", requireDeviceSession, (_req, res) => res.json({ private: true }));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});
beforeEach(() => {
  fixture.query.mockReset().mockResolvedValue({ rows: [migration] });
  fixture.expected.mockReset().mockReturnValue([migration]);
  vi.stubEnv("HINT_DRAINING", "0");
});
afterEach(() => vi.unstubAllEnvs());

it("preserves public health JSON and reports unbuilt source honestly", async () => {
  const response = await fetch(origin + "/api/healthz");
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('{"status":"ok"}');
  expect(response.headers.get("x-hint-build")).toBe("unknown");
  expect(response.headers.get("x-hint-schema")).toBe("unknown");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(fixture.query).not.toHaveBeenCalled();
});

it.each([
  ["matching ledger", [migration], 200, "ready"],
  ["missing migration", [], 503, "unavailable"],
  ["wrong migration digest", [{ ...migration, sha256: "b".repeat(64) }], 503, "unavailable"],
] as const)("preserves readiness for %s", async (_name, rows, status, body) => {
  fixture.query.mockResolvedValue({ rows });
  const response = await fetch(origin + "/api/readyz");
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ status: body });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(fixture.query).toHaveBeenCalledExactlyOnceWith(
    "SELECT name,sha256 FROM hint_schema_migrations WHERE name = ANY($1::text[])", [[migration.name]],
  );
});

it.each(["database", "expected metadata"])("preserves unavailable readiness on %s failure", async failure => {
  if (failure === "database") fixture.query.mockRejectedValue(new Error("synthetic private detail"));
  else fixture.expected.mockImplementation(() => { throw new Error("synthetic private path"); });
  const response = await fetch(origin + "/api/readyz");
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ status: "unavailable" });
});

it("keeps health alive while draining and skips the readiness database call", async () => {
  vi.stubEnv("HINT_DRAINING", "1");
  const ready = await fetch(origin + "/api/readyz");
  expect(ready.status).toBe(503);
  expect(await ready.json()).toEqual({ status: "unavailable" });
  const health = await fetch(origin + "/api/healthz");
  expect(health.status).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });
  expect(fixture.query).not.toHaveBeenCalled();
});

it("does not bypass authentication for other routes", async () => {
  const response = await fetch(origin + "/api/protected");
  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({ code: "DEVICE_SESSION_REQUIRED" });
  expect(response.headers.has("x-hint-build")).toBe(false);
  expect(fixture.query).not.toHaveBeenCalled();
});

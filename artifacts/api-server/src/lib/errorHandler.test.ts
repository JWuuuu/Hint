import express from "express";
import type { Server } from "node:http";
import { DrizzleQueryError } from "drizzle-orm";
import { APIError } from "openai";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

const log = vi.hoisted(() => vi.fn());
vi.mock("./logger", () => ({ logger: { error: log } }));
vi.mock("@workspace/db", () => ({ pool: {} }));
import { errorHandler } from "./errorHandler";
import { BudgetExceeded } from "./durableBudget";
import { requestContext } from "./requestContext";

let server: Server;
let origin: string;
let failure: unknown;
beforeAll(async () => {
  const app = express();
  app.use(requestContext);
  app.get("/failure", () => { throw failure; });
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});
beforeEach(() => log.mockClear());

it.each([
  ["database", new DrizzleQueryError("insert into profiles(name) values ($1)", ["synthetic-private-birth-profile"], new Error("synthetic-private-db-detail"))],
  ["generic upstream", new Error("synthetic-private-provider-response")],
  ["provider SDK", new APIError(500, { message: "synthetic-private-provider-detail" }, "synthetic-private-provider-detail", new Headers())],
])("keeps %s details out of logs and responses while retaining correlation", async (_kind, error) => {
  failure = error;
  const response = await fetch(`${origin}/failure`);
  const body = await response.json() as { requestId: string };
  expect(response.status).toBe(error instanceof APIError ? 502 : 500);
  expect(body.requestId).toBe(response.headers.get("x-request-id"));
  expect(log).toHaveBeenCalledOnce();
  expect(log.mock.calls[0][0]).toMatchObject({ requestId: body.requestId, errorType: error.name });
  expect(JSON.stringify(log.mock.calls)).not.toContain("synthetic-private");
  expect(JSON.stringify(log.mock.calls)).not.toContain("insert into profiles");
  expect(JSON.stringify(body)).not.toContain("synthetic-private");
});

it.each([400, 401, 403, 413])("preserves the safe %s response and request ID", async status => {
  failure = Object.assign(new Error("synthetic-private-input"), { status });
  const response = await fetch(`${origin}/failure`);
  const body = await response.json() as { requestId: string };
  expect(response.status).toBe(status);
  expect(body.requestId).toBe(response.headers.get("x-request-id"));
  expect(JSON.stringify(body)).not.toContain("synthetic-private");
  expect(JSON.stringify(log.mock.calls)).not.toContain("synthetic-private");
});

it("preserves budget Retry-After and its stable error code", async () => {
  failure = new BudgetExceeded(17);
  const response = await fetch(`${origin}/failure`);
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("17");
  expect(await response.json()).toMatchObject({ code: "REQUEST_BUDGET_EXHAUSTED", requestId: response.headers.get("x-request-id") });
});

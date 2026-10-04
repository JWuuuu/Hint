import type { ErrorRequestHandler } from "express";
import { APIError } from "openai";
import { logger } from "./logger";
import crypto from "node:crypto";
import { BudgetExceeded } from "./durableBudget";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (res.headersSent) return;
  const requestId = _req.requestId ?? crypto.randomUUID();
  res.set("X-Request-Id", requestId);
  logger.error({ requestId, errorType: err instanceof Error ? err.name : "UnknownError", status: Number(err?.status) || 500 }, "API request failed");
  if (err instanceof BudgetExceeded) {
    res.status(429).set("Retry-After", String(err.retryAfter)).json({ error: err.message, code: "REQUEST_BUDGET_EXHAUSTED", requestId }); return;
  }

  if (err instanceof APIError) {
    res.status(err.status === 429 ? 429 : 502).json({
      error: "The reading service is temporarily unavailable. Please retry.",
      code: "PROVIDER_UNAVAILABLE", requestId,
    });
    return;
  }

  const status = [400, 401, 403, 413].includes(Number(err?.status)) ? Number(err.status) : 500;
  res.status(status).json({ error: status === 413 ? "Request is too large." : status === 403 ? "This request is not allowed." : "The service is temporarily unavailable. Please retry.", code: "REQUEST_FAILED", requestId });
};

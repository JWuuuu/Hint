import type { ErrorRequestHandler } from "express";
import { APIError } from "openai";
import { logger } from "./logger";
import crypto from "node:crypto";
import { BudgetExceeded } from "./durableBudget";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (res.headersSent) return;
  const requestId = _req.requestId ?? crypto.randomUUID();
  res.set("X-Request-Id", requestId);
  // Error messages are not safe diagnostics: database wrappers include SQL and
  // bound user data, and non-SDK provider errors can contain upstream content.
  // Keep correlation and classification without recording messages or causes.
  logger.error({
    requestId,
    errorType: err instanceof Error ? err.name : "UnknownError",
    status: Number(err?.status) || 500,
  }, "API request failed");
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
  const message =
    status === 413 ? "Request is too large."
    : status === 403 ? "This request is not allowed."
    : status === 400 ? "The request could not be read."
    : "The service is temporarily unavailable. Please retry.";
  res.status(status).json({ error: message, code: status === 400 ? "BAD_REQUEST" : "REQUEST_FAILED", requestId });
};

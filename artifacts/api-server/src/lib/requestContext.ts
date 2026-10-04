import crypto from "node:crypto";
import type { RequestHandler } from "express";
declare global { namespace Express { interface Request { requestId?: string } } }
export function safeRequestPath(value: string | undefined) {
  let path = value?.split("?")[0] ?? "/";
  try { path = decodeURIComponent(path); } catch { return "[invalid-path]"; }
  return path.replace(/\/compatibility\/invite\/[^/]+/gi, "/compatibility/invite/[token]");
}
export const requestContext: RequestHandler = (req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.set("X-Request-Id", req.requestId);
  const json = res.json.bind(res);
  res.json = ((payload: unknown) => {
    if (res.statusCode >= 400) {
      const data = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
      return json({ ...data, error: typeof data.error === "string" ? data.error : "The request could not be completed.",
        code: typeof data.code === "string" ? data.code : `HTTP_${res.statusCode}`, requestId: req.requestId });
    }
    return json(payload);
  }) as typeof res.json;
  next();
};

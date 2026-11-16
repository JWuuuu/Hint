import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { errorHandler } from "./lib/errorHandler";
import { logger } from "./lib/logger";
import { allowedOrigin } from "./lib/accessPolicy";
import { requestContext, safeRequestPath } from "./lib/requestContext";

const app: Express = express();
app.disable("x-powered-by");
const trustedProxies = process.env.HINT_TRUSTED_PROXIES?.split(",").map(value => value.trim()).filter(Boolean);
if (trustedProxies?.length) app.set("trust proxy", trustedProxies);
app.use(requestContext);

// Baseline response hardening for a JSON API behind a TLS-terminating proxy.
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "no-referrer");
  res.set("X-Frame-Options", "DENY");
  res.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (req.secure || req.get("x-forwarded-proto") === "https") {
    res.set("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  // Private, per-device responses must never be stored by a shared cache.
  if (req.path !== "/api/healthz" && req.path !== "/api/readyz") res.set("Cache-Control", "no-store");
  next();
});

app.use(
  pinoHttp({
    logger,
    genReqId(req) { return (req as typeof req & { requestId?: string }).requestId ?? "unavailable"; },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: safeRequestPath(req.url),
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin(origin, callback) { callback(allowedOrigin(origin) ? null : Object.assign(new Error("Origin not allowed"), { status: 403 }), allowedOrigin(origin)); }, methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization"], maxAge: 600 }));
app.use(express.json({ limit: "100kb" }));

app.use("/api", router);
app.use((_req, res) => { res.status(404).json({ error: "API route not found.", code: "ROUTE_NOT_FOUND" }); });
app.use(errorHandler);

export default app;

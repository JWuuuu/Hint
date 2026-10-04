import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  serializers: {
    err(error) { return { type: error?.name ?? "Error", status: Number(error?.status) || undefined, code: typeof error?.code === "string" && /^[A-Z0-9_]{1,60}$/.test(error.code) ? error.code : undefined }; },
  },
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
    "token", "tokenHash", "enrollmentCode", "creatorInput", "friendInput", "inputSnapshot",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});

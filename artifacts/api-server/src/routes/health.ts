import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { expectedMigrations } from "../lib/schemaReadiness";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});
router.get("/readyz", async (_req, res) => {
  res.set("Cache-Control", "no-store");
  if (process.env.HINT_DRAINING === "1") { res.status(503).json({ status: "unavailable" }); return; }
  try {
    const expected = expectedMigrations();
    const result = await pool.query("SELECT name,sha256 FROM hint_schema_migrations WHERE name = ANY($1::text[])", [expected.map(row => row.name)]);
    const ready = expected.every(row => result.rows.some(applied => applied.name === row.name && applied.sha256 === row.sha256));
    res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "unavailable" });
  } catch { res.status(503).json({ status: "unavailable" }); }
});

export default router;

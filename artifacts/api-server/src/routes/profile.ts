import { authenticatedOwner } from "../lib/deviceSession";
/**
 * Profile API routes — anonymous per-user identity (name + birth details).
 */

import { Router } from "express";
import * as z from "zod";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";

import { birthDetailsError } from "@workspace/api-zod";

const router = Router();

function serialize(row: typeof profilesTable.$inferSelect) {
  return {
    anonId: row.anonId,
    name: row.name,
    birthDate: row.birthDate,
    birthTime: row.birthTime,
    birthPlace: row.birthPlace,
    latitude: row.latitude, longitude: row.longitude, timezone: row.timezone, timezoneOffset: row.timezoneOffset,
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

/* ─── GET /profile?anonId= ─────────────────────────────────────── */

router.get("/profile", async (req, res) => {
  const anonId = authenticatedOwner(req);
  if (!anonId) {
    res.status(400).json({ error: "anonId is required" });
    return;
  }

  const [row] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.anonId, anonId))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "No profile yet" });
    return;
  }

  res.json(serialize(row));
});

/* ─── POST /profile (upsert) ───────────────────────────────────── */

const profileInputSchema = z.object({
  anonId: z.string().min(1).max(200),
  name: z.string().min(1).max(120),
  birthDate: z.string().min(1).max(40),
  birthTime: z.string().max(40).optional(),
  birthPlace: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  timezone: z.string().max(100).nullable().optional(),
  timezoneOffset: z.number().min(-12).max(14).nullable().optional(),
});

router.post("/profile", async (req, res) => {
  const parsed = profileInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const validation = birthDetailsError(parsed.data);
  if (validation) { res.status(400).json({ error: `Invalid ${validation}` }); return; }
  const { anonId, name, birthDate, birthTime, birthPlace } = parsed.data;
  const [previous] = await db.select().from(profilesTable).where(eq(profilesTable.anonId, anonId)).limit(1);
  const samePlace = previous?.birthPlace === (birthPlace ?? null);
  const sameDate = previous?.birthDate === birthDate;
  const geo = {
    latitude: parsed.data.latitude !== undefined ? parsed.data.latitude : samePlace ? previous?.latitude : null,
    longitude: parsed.data.longitude !== undefined ? parsed.data.longitude : samePlace ? previous?.longitude : null,
    timezone: parsed.data.timezone !== undefined ? parsed.data.timezone : samePlace ? previous?.timezone : null,
    timezoneOffset: parsed.data.timezoneOffset !== undefined ? parsed.data.timezoneOffset : samePlace && sameDate ? previous?.timezoneOffset : null,
  };

  const [row] = await db
    .insert(profilesTable)
    .values({
      ...geo,
      anonId,
      name,
      birthDate,
      birthTime: birthTime ?? null,
      birthPlace: birthPlace ?? null,
    })
    .onConflictDoUpdate({
      target: profilesTable.anonId,
      set: {
        ...geo,
        name,
        birthDate,
        birthTime: birthTime ?? null,
        birthPlace: birthPlace ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(serialize(row!));
});

export default router;

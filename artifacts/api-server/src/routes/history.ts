import { authenticatedOwner } from "../lib/deviceSession";
/**
 * History API routes — daily pulls, journal entries, saved readings, and the
 * aggregate Vault stats. All scoped to an anonymous per-user id.
 */

import { Router } from "express";
import * as z from "zod";
import { and, count, desc, eq, sql } from "drizzle-orm";
import {
  db,
  dailyPullsTable,
  journalEntriesTable,
  readingsTable,
  profilesTable,
  dailyReceiptsTable,
  compatibilityInvitesTable,
  historyClearsTable,
} from "@workspace/db";
import {
  dailyPullCardById,
  getOrCreateDailyReceipt,
  openDailyReceipt,
} from "../modules/hint/dailyReceipts.js";

const router = Router();

function serializeDailyPull(row: typeof dailyPullsTable.$inferSelect) {
  return {
    anonId: row.anonId,
    pullDate: row.pullDate,
    cardId: row.cardId,
    cardName: row.cardName,
    whisper: row.whisper,
    isFlipped: row.isFlipped,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

async function getOrCreateServerDailyPull(
  anonId: string,
  dailyKey?: string,
  now = new Date(),
) {
  return db.transaction(async tx => {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${anonId}, 0))`);
  const receipt = await getOrCreateDailyReceipt({
    anonymousDeviceId: anonId,
    featureType: "daily-card",
    dailyKey,
    now,
  });
  const [existing] = await tx
    .select()
    .from(dailyPullsTable)
    .where(and(eq(dailyPullsTable.anonId, anonId), eq(dailyPullsTable.pullDate, receipt.dailyKey)))
    .limit(1);

  const card = dailyPullCardById(receipt.assignedCardId);
  if (existing) {
    const shouldSyncCard =
      existing.cardId !== card.id ||
      existing.cardName !== card.name ||
      existing.whisper !== card.whisper;
    const shouldSyncReveal = Boolean(receipt.openedAt) && !existing.isFlipped;

    if (!shouldSyncCard && !shouldSyncReveal) return existing;

    const [synced] = await tx
      .update(dailyPullsTable)
      .set({
        ...(shouldSyncCard
          ? { cardId: card.id, cardName: card.name, whisper: card.whisper }
          : {}),
        ...(shouldSyncReveal ? { isFlipped: true } : {}),
      })
      .where(and(eq(dailyPullsTable.anonId, anonId), eq(dailyPullsTable.pullDate, receipt.dailyKey)))
      .returning();

    return synced ?? existing;
  }

  const [cleared] = await tx.select().from(historyClearsTable).where(eq(historyClearsTable.ownerId, anonId));
  if (receipt.historyExcluded || (cleared && receipt.dailyKey <= cleared.throughDay)) return {
    id: receipt.id, anonId, pullDate: receipt.dailyKey, cardId: card.id, cardName: card.name,
    whisper: card.whisper, isFlipped: Boolean(receipt.openedAt), note: null, createdAt: receipt.assignedAt,
  };

  const [created] = await tx
    .insert(dailyPullsTable)
    .values({
      anonId,
      pullDate: receipt.dailyKey,
      cardId: card.id,
      cardName: card.name,
      whisper: card.whisper,
      isFlipped: Boolean(receipt.openedAt),
    })
    .onConflictDoNothing({
      target: [dailyPullsTable.anonId, dailyPullsTable.pullDate],
    })
    .returning();

  if (created) return created;

  const [row] = await tx
    .select()
    .from(dailyPullsTable)
    .where(and(eq(dailyPullsTable.anonId, anonId), eq(dailyPullsTable.pullDate, receipt.dailyKey)))
    .limit(1);

  return row ?? null;
  });
}

function serializeJournal(row: typeof journalEntriesTable.$inferSelect) {
  return {
    id: row.id,
    anonId: row.anonId,
    title: row.title,
    body: row.body,
    mood: row.mood,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeReading(row: typeof readingsTable.$inferSelect) {
  return {
    id: row.id,
    cardName: row.cardName,
    whisper: row.whisper,
    spreadType: row.spreadType,
    question: row.question,
    territory: row.territory,
    createdAt: row.createdAt.toISOString(),
  };
}

/* ─── POST /daily-pull (get-or-create) ─────────────────────────── */

const dailyPullRequestSchema = z.object({
  anonId: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

router.post("/daily-pull", async (req, res) => {
  const parsed = dailyPullRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { anonId, date } = parsed.data;
  const row = await getOrCreateServerDailyPull(anonId, date);

  if (!row) {
    res.status(500).json({ error: "Could not draw a card tonight" });
    return;
  }

  res.json(serializeDailyPull(row));
});

/* ─── PATCH /daily-pull (flip / note) ──────────────────────────── */

const dailyPullUpdateSchema = z.object({
  anonId: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isFlipped: z.boolean().optional(),
  note: z.string().max(2000).optional(),
  editedAt: z.string().datetime().optional(),
});

router.patch("/daily-pull", async (req, res) => {
  const parsed = dailyPullUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { anonId, date, isFlipped, note, editedAt } = parsed.data;
  const dailyPull = await getOrCreateServerDailyPull(anonId, date);

  if (!dailyPull) {
    res.status(500).json({ error: "Could not draw a card tonight" });
    return;
  }

  if (isFlipped === true) {
    await openDailyReceipt({
      anonymousDeviceId: anonId,
      featureType: "daily-card",
      dailyKey: dailyPull.pullDate,
    });
  }

  const set: Partial<typeof dailyPullsTable.$inferInsert> = {};
  if (isFlipped !== undefined) set.isFlipped = isFlipped;
  if (note !== undefined) set.note = note;

  if (Object.keys(set).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  const row = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${anonId}, 0))`);
    const [cleared] = await tx.select().from(historyClearsTable).where(eq(historyClearsTable.ownerId, anonId));
    if (cleared && dailyPull.pullDate <= cleared.throughDay) {
      if (note === undefined || !editedAt || new Date(editedAt) <= cleared.clearedAt) return null;
      // Only a deliberate edit made after deletion may start a new note. Reveal sync
      // keeps its exclusion flag and therefore cannot recreate the old history.
      await tx.insert(dailyPullsTable).values({ anonId, pullDate: dailyPull.pullDate, cardId: dailyPull.cardId,
        cardName: dailyPull.cardName, whisper: dailyPull.whisper, isFlipped: dailyPull.isFlipped, note })
        .onConflictDoNothing({ target: [dailyPullsTable.anonId, dailyPullsTable.pullDate] });
    }
    const [saved] = await tx
    .update(dailyPullsTable)
    .set(set)
    .where(and(eq(dailyPullsTable.anonId, anonId), eq(dailyPullsTable.pullDate, dailyPull.pullDate)))
    .returning();
    return saved ?? null;
  });

  if (!row) {
    res.status(404).json({ error: "No daily pull found" });
    return;
  }

  res.json(serializeDailyPull(row));
});

/* ─── GET /journal?anonId= ─────────────────────────────────────── */

router.get("/journal", async (req, res) => {
  const anonId = authenticatedOwner(req);
  if (!anonId) {
    res.status(400).json({ error: "anonId is required" });
    return;
  }

  const rows = await db
    .select()
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.anonId, anonId))
    .orderBy(desc(journalEntriesTable.createdAt))
    .limit(200);

  res.json(rows.map(serializeJournal));
});

/* ─── POST /journal ────────────────────────────────────────────── */

const journalInputSchema = z.object({
  anonId: z.string().min(1).max(200),
  title: z.string().max(200).optional(),
  body: z.string().min(1).max(8000),
  mood: z.string().max(60).optional(),
  editedAt: z.string().datetime().optional(),
});

router.post("/journal", async (req, res) => {
  const requestStartedAt = new Date();
  const parsed = journalInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { title, body, mood, editedAt } = parsed.data;
  const anonId = authenticatedOwner(req);
  const row = await db.transaction(async tx => {
    // Serialize creation with Clear History. An insert still in progress must
    // finish before deletion, or observe the deletion fence before it writes.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${anonId}, 0))`);
    const [cleared] = await tx.select().from(historyClearsTable).where(eq(historyClearsTable.ownerId, anonId));
    if (cleared && (requestStartedAt <= cleared.clearedAt || (editedAt && new Date(editedAt) <= cleared.clearedAt))) return null;
    const [created] = await tx.insert(journalEntriesTable).values({ anonId, title: title ?? null, body, mood: mood ?? null }).returning();
    return created;
  });

  if (!row) {
    res.status(409).json({ error: "History was cleared while this entry was being saved.", code: "HISTORY_CLEARED" });
    return;
  }

  res.json(serializeJournal(row));
});

/* ─── GET /readings?anonId= ────────────────────────────────────── */

router.get("/readings", async (req, res) => {
  const anonId = authenticatedOwner(req);
  if (!anonId) {
    res.status(400).json({ error: "anonId is required" });
    return;
  }

  const rows = await db
    .select()
    .from(readingsTable)
    .where(eq(readingsTable.anonId, anonId))
    .orderBy(desc(readingsTable.createdAt))
    .limit(100);

  res.json(rows.map(serializeReading));
});

/* ─── GET /stats?anonId= ───────────────────────────────────────── */

router.get("/reading-days", async (req, res) => {
  const anonId = authenticatedOwner(req);
  if (!anonId) { res.status(400).json({ error: "anonId is required" }); return; }
  const [pulls, readings] = await Promise.all([
    db.select({ day: dailyPullsTable.pullDate }).from(dailyPullsTable).where(and(eq(dailyPullsTable.anonId, anonId), eq(dailyPullsTable.isFlipped, true))),
    db.select({ date: readingsTable.createdAt }).from(readingsTable).where(eq(readingsTable.anonId, anonId)),
  ]);
  res.json([...pulls.map(row => row.day), ...readings.map(row => row.date.toISOString())]);
});

router.get("/stats", async (req, res) => {
  const anonId = authenticatedOwner(req);
  if (!anonId) {
    res.status(400).json({ error: "anonId is required" });
    return;
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.anonId, anonId))
    .limit(1);

  const [readingsCount] = await db
    .select({ value: count() })
    .from(readingsTable)
    .where(eq(readingsTable.anonId, anonId));
  const [journalsCount] = await db
    .select({ value: count() })
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.anonId, anonId));
  const [pullsCount] = await db
    .select({ value: count() })
    .from(dailyPullsTable)
    .where(eq(dailyPullsTable.anonId, anonId));

  let nights = 0;
  if (profile) {
    const ms = Date.now() - profile.createdAt.getTime();
    nights = Math.max(1, Math.floor(ms / 86_400_000) + 1);
  }

  res.json({
    nights,
    readings: readingsCount?.value ?? 0,
    journals: journalsCount?.value ?? 0,
    pulls: pullsCount?.value ?? 0,
  });
});

/* --- DELETE /history?anonId= ------------------------------------------------ */

router.delete("/history", async (req, res) => {
  const anonId = authenticatedOwner(req);
  if (!anonId) {
    res.status(400).json({ error: "anonId is required" });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${anonId}, 0))`);
    const requestedDay = typeof req.query.throughDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.throughDay) ? req.query.throughDay : new Date().toISOString().slice(0, 10);
    await tx.insert(historyClearsTable).values({ ownerId: anonId, clearedAt: new Date(), throughDay: requestedDay })
      .onConflictDoUpdate({ target: historyClearsTable.ownerId, set: { clearedAt: new Date(), throughDay: requestedDay } });
    await tx.update(dailyReceiptsTable).set({ historyExcluded: true }).where(eq(dailyReceiptsTable.anonymousDeviceId, anonId));
    await tx.delete(compatibilityInvitesTable).where(eq(compatibilityInvitesTable.ownerId, anonId));
    await tx.delete(readingsTable).where(eq(readingsTable.anonId, anonId));
    await tx.delete(journalEntriesTable).where(eq(journalEntriesTable.anonId, anonId));
    await tx.delete(dailyPullsTable).where(eq(dailyPullsTable.anonId, anonId));
  });

  res.status(204).send();
});

export default router;

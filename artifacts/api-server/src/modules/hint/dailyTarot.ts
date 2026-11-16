import { randomInt } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, dailyReceiptsTable, dailyPullsTable, historyClearsTable } from "@workspace/db";
import { dailyPullDeck } from "./dailyPullDeck.js";

export type DailyTarotFeature = "daily-card" | "daily-tarot";
export function isDailyTarotFeature(feature: string): feature is DailyTarotFeature {
  return feature === "daily-card" || feature === "daily-tarot";
}

export class DailyTarotError extends Error {
  constructor(public status: 400 | 404 | 409, public code: string, message: string) { super(message); }
}

export function dailyTarotWindow(now: Date, requestedDay?: string) {
  const today = now.toISOString().slice(0, 10);
  const day = requestedDay ?? today;
  const start = new Date(`${day}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== day) {
    throw new DailyTarotError(400, "INVALID_DAILY_DATE", "Invalid calendar date");
  }
  if (day > today) throw new DailyTarotError(409, "DAILY_READING_NOT_AVAILABLE", "Future daily readings are not available");
  return { today, day, expiresAt: new Date(start.getTime() + 86_400_000) };
}

/** The receipt is the immutable assignment; daily_pulls is its history/note projection.
 * Use the same owner lock as history deletion, and one transaction for both rows.
 * Only server time can create an assignment. Historical requests never draw.
 */
export async function dailyTarot(input: {
  owner: string;
  feature: DailyTarotFeature;
  dailyKey?: string;
  open?: boolean;
  sync?: { assignedCardId: string | null; orientation?: string | null };
  note?: string;
  editedAt?: string;
  clock?: () => Date;
}) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.owner}, 0))`);
    // Read time after waiting for the lock, including requests queued across midnight.
    const now = input.clock?.() ?? new Date();
    const { day, today, expiresAt } = dailyTarotWindow(now, input.dailyKey);
    const where = and(eq(dailyReceiptsTable.anonymousDeviceId, input.owner),
      eq(dailyReceiptsTable.dailyKey, day), eq(dailyReceiptsTable.featureType, input.feature));
    let [receipt] = await tx.select().from(dailyReceiptsTable).where(where).limit(1);
    const [cleared] = await tx.select().from(historyClearsTable).where(eq(historyClearsTable.ownerId, input.owner));
    if (!receipt) {
      if (day !== today || input.sync) throw new DailyTarotError(404, "DAILY_READING_NOT_FOUND", "No saved daily reading for this date");
      const card = dailyPullDeck[randomInt(dailyPullDeck.length)]!;
      await tx.insert(dailyReceiptsTable).values({
        anonymousDeviceId: input.owner, userId: input.owner, dailyKey: day, featureType: input.feature,
        assignedCardId: card.id, orientation: input.feature === "daily-tarot" && randomInt(2) === 1 ? "reversed" : "upright",
        assignedAt: now, expiresAt, lastSeenAt: now,
        historyExcluded: Boolean(cleared && day <= cleared.throughDay),
      }).onConflictDoNothing({ target: [dailyReceiptsTable.anonymousDeviceId, dailyReceiptsTable.dailyKey, dailyReceiptsTable.featureType] });
      [receipt] = await tx.select().from(dailyReceiptsTable).where(where).limit(1);
    }
    if (!receipt) throw new Error("Daily assignment unavailable");
    if (day !== today && !receipt.openedAt) throw new DailyTarotError(409, "DAILY_READING_EXPIRED", "This reading was not opened before its day ended");
    if (input.sync && (input.sync.assignedCardId !== receipt.assignedCardId ||
      (input.sync.orientation != null && input.sync.orientation !== receipt.orientation))) {
      throw new DailyTarotError(409, "DAILY_READING_CONFLICT", "Restore the server's saved daily reading");
    }
    const card = dailyPullDeck.find(candidate => candidate.id === receipt.assignedCardId);
    if (!card) throw new Error("Stored daily card is invalid"); // Never reroll a corrupt record.
    const openedAt = receipt.openedAt ?? (input.open || input.sync ? now : null);
    [receipt] = await tx.update(dailyReceiptsTable).set({ openedAt, lastSeenAt: now })
      .where(eq(dailyReceiptsTable.id, receipt.id)).returning();
    if (!receipt) throw new Error("Daily assignment unavailable");

    let pull: typeof dailyPullsTable.$inferSelect | null = null;
    if (input.feature === "daily-card") {
      const [savedPull] = await tx.select().from(dailyPullsTable)
        .where(and(eq(dailyPullsTable.anonId, input.owner), eq(dailyPullsTable.pullDate, day))).limit(1);
      const excluded = receipt.historyExcluded || Boolean(cleared && day <= cleared.throughDay);
      const edited = input.editedAt ? new Date(input.editedAt) : null;
      const deliberateNote = input.note !== undefined && edited && cleared && edited > cleared.clearedAt && edited <= now;
      if (input.note !== undefined && excluded && !deliberateNote) {
        throw new DailyTarotError(404, "DAILY_HISTORY_CLEARED", "This daily history was cleared");
      }
      if (!excluded || deliberateNote || savedPull) {
        [pull] = await tx.insert(dailyPullsTable).values({
          anonId: input.owner, pullDate: day, cardId: card.id, cardName: card.name, whisper: card.whisper,
          isFlipped: Boolean(openedAt), note: input.note ?? null,
        }).onConflictDoUpdate({ target: [dailyPullsTable.anonId, dailyPullsTable.pullDate], set: {
          cardId: card.id, cardName: card.name, whisper: card.whisper, isFlipped: Boolean(openedAt),
          ...(input.note !== undefined ? { note: input.note } : {}),
        } }).returning();
      }
      pull ??= { id: receipt.id, anonId: input.owner, pullDate: day, cardId: card.id, cardName: card.name,
        whisper: card.whisper, isFlipped: Boolean(openedAt), note: null, createdAt: receipt.assignedAt };
    }
    return { receipt, pull, serverTime: now };
  });
}

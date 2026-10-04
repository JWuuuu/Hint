import { and, eq, sql } from "drizzle-orm";
import { db, dailyReceiptsTable, dailyPullsTable, historyClearsTable } from "@workspace/db";
import { dailyPullDeck, drawDailyPull, type DailyPullCard } from "./dailyPullDeck.js";

export const DAILY_RECEIPT_FEATURES = [
  "daily-card",
  "daily-tarot",
  "sky-deck",
  "energy-score",
  "collection-rare-reward",
  "animal-tarot",
] as const;

export type DailyReceiptFeature = (typeof DAILY_RECEIPT_FEATURES)[number];
export type DailyOrientation = "upright" | "reversed";

const MAJOR_CARD_IDS = new Set([
  "0-fool",
  "1-magician",
  "2-high-priestess",
  "3-empress",
  "4-emperor",
  "5-hierophant",
  "6-lovers",
  "7-chariot",
  "8-strength",
  "9-hermit",
  "10-wheel",
  "11-justice",
  "12-hanged-man",
  "13-death",
  "14-temperance",
  "15-devil",
  "16-tower",
  "17-star",
  "18-moon",
  "19-sun",
  "20-judgement",
  "21-world",
]);

const RARE_COLLECTION_CARDS = dailyPullDeck.filter((card) => MAJOR_CARD_IDS.has(card.id));
const ANIMAL_TAROT_IDS = [
  "moon-moth",
  "black-cat",
  "white-stag",
  "night-swan",
  "amber-fox",
  "silver-rabbit",
  "golden-lion",
] as const;

export function getServerDailyWindow(now = new Date()) {
  const dailyKey = now.toISOString().slice(0, 10);
  const expiresAt = new Date(`${dailyKey}T00:00:00.000Z`);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 1);
  return { dailyKey, expiresAt };
}

function pickRandomCard(cards: readonly DailyPullCard[] = dailyPullDeck): DailyPullCard {
  return cards[Math.floor(Math.random() * cards.length)] ?? dailyPullDeck[0]!;
}

function pickOrientation(featureType: DailyReceiptFeature): DailyOrientation | null {
  if (featureType !== "daily-tarot") return featureType === "daily-card" || featureType === "sky-deck" ? "upright" : null;
  return Math.random() > 0.5 ? "upright" : "reversed";
}

function assignCard(featureType: DailyReceiptFeature): string | null {
  if (featureType === "energy-score") return null;
  if (featureType === "animal-tarot") {
    return ANIMAL_TAROT_IDS[Math.floor(Math.random() * ANIMAL_TAROT_IDS.length)] ?? ANIMAL_TAROT_IDS[0];
  }
  if (featureType === "collection-rare-reward") return pickRandomCard(RARE_COLLECTION_CARDS).id;
  return drawDailyPull().id;
}

export function serializeDailyReceipt(
  row: typeof dailyReceiptsTable.$inferSelect,
  serverTime = new Date(),
) {
  return {
    id: row.id,
    userId: row.userId,
    anonymousDeviceId: row.anonymousDeviceId,
    anonId: row.anonymousDeviceId,
    dailyKey: row.dailyKey,
    featureType: row.featureType,
    assignedCardId: row.assignedCardId,
    orientation: row.orientation,
    assignedAt: row.assignedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    openedAt: row.openedAt?.toISOString() ?? null,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    historyExcluded: row.historyExcluded,
    serverTime: serverTime.toISOString(),
  };
}

export async function getOrCreateDailyReceipt({
  anonymousDeviceId,
  featureType,
  userId = null,
  now = new Date(),
  dailyKey,
}: {
  anonymousDeviceId: string;
  featureType: DailyReceiptFeature;
  userId?: string | null;
  now?: Date;
  dailyKey?: string;
}) {
  const dailyWindow = getServerDailyWindow(
    dailyKey ? new Date(`${dailyKey}T12:00:00.000Z`) : now,
  );
  const activeDailyKey = dailyWindow.dailyKey;
  const { expiresAt } = dailyWindow;
  const [existing] = await db
    .select()
    .from(dailyReceiptsTable)
    .where(
      and(
        eq(dailyReceiptsTable.anonymousDeviceId, anonymousDeviceId),
        eq(dailyReceiptsTable.dailyKey, activeDailyKey),
        eq(dailyReceiptsTable.featureType, featureType),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(dailyReceiptsTable)
      .set({ lastSeenAt: now })
      .where(eq(dailyReceiptsTable.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [created] = await db
    .insert(dailyReceiptsTable)
    .values({
      anonymousDeviceId,
      userId,
      dailyKey: activeDailyKey,
      featureType,
      assignedCardId: assignCard(featureType),
      orientation: pickOrientation(featureType),
      assignedAt: now,
      expiresAt,
      lastSeenAt: now,
    })
    .onConflictDoNothing({
      target: [
        dailyReceiptsTable.anonymousDeviceId,
        dailyReceiptsTable.dailyKey,
        dailyReceiptsTable.featureType,
      ],
    })
    .returning();

  if (created) return created;

  const [row] = await db
    .select()
    .from(dailyReceiptsTable)
    .where(
      and(
        eq(dailyReceiptsTable.anonymousDeviceId, anonymousDeviceId),
        eq(dailyReceiptsTable.dailyKey, activeDailyKey),
        eq(dailyReceiptsTable.featureType, featureType),
      ),
    )
    .limit(1);

  if (!row) {
    throw new Error("Could not issue daily receipt");
  }

  return row;
}

export async function openDailyReceipt({
  anonymousDeviceId,
  featureType,
  userId = null,
  now = new Date(),
  dailyKey,
}: {
  anonymousDeviceId: string;
  featureType: DailyReceiptFeature;
  userId?: string | null;
  now?: Date;
  dailyKey?: string;
}) {
  const receipt = await getOrCreateDailyReceipt({
    anonymousDeviceId,
    featureType,
    userId,
    now,
    dailyKey,
  });
  const [updated] = await db
    .update(dailyReceiptsTable)
    .set({
      openedAt: receipt.openedAt ?? now,
      lastSeenAt: now,
    })
    .where(eq(dailyReceiptsTable.id, receipt.id))
    .returning();

  return updated ?? receipt;
}

export function dailyPullCardById(cardId: string | null | undefined): DailyPullCard {
  return dailyPullDeck.find((card) => card.id === cardId) ?? dailyPullDeck[0]!;
}

export class DailyReceiptConflict extends Error {}
export class DailyReceiptInputError extends Error {}
export async function syncRevealedDailyReceipt(input: {
  anonymousDeviceId: string; featureType: DailyReceiptFeature; dailyKey: string;
  assignedCardId: string | null; orientation?: string | null; openedAt: string;
}) {
  const validCard = input.featureType === "energy-score" ? input.assignedCardId === null
    : input.featureType === "animal-tarot" ? ANIMAL_TAROT_IDS.some(id => id === input.assignedCardId)
    : dailyPullDeck.some(card => card.id === input.assignedCardId);
  if (!validCard) throw new DailyReceiptInputError("Invalid card identity");
  const assigned = await getOrCreateDailyReceipt(input);
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.anonymousDeviceId}, 0))`);
    const [cleared] = await tx.select().from(historyClearsTable).where(eq(historyClearsTable.ownerId, input.anonymousDeviceId));
    const [receipt] = await tx.select().from(dailyReceiptsTable).where(eq(dailyReceiptsTable.id, assigned.id)).for("update");
    if (!receipt) throw new Error("Receipt unavailable");
    if (receipt.openedAt && (receipt.assignedCardId !== input.assignedCardId || (input.orientation && receipt.orientation && input.orientation !== receipt.orientation))) {
      throw new DailyReceiptConflict("An already revealed card differs from this device");
    }
    const historyExcluded = receipt.historyExcluded || Boolean(cleared && (input.dailyKey <= cleared.throughDay || new Date(input.openedAt) <= cleared.clearedAt));
    const [updated] = await tx.update(dailyReceiptsTable).set({
      historyExcluded, assignedCardId: input.assignedCardId, orientation: receipt.openedAt ? receipt.orientation : input.orientation ?? receipt.orientation,
      openedAt: receipt.openedAt ?? new Date(input.openedAt), lastSeenAt: new Date(),
    }).where(eq(dailyReceiptsTable.id, receipt.id)).returning();
    if (input.featureType === "daily-card" && !historyExcluded) {
      const card = dailyPullCardById(input.assignedCardId);
      await tx.insert(dailyPullsTable).values({ anonId: input.anonymousDeviceId, pullDate: input.dailyKey,
        cardId: card.id, cardName: card.name, whisper: card.whisper, isFlipped: true })
        .onConflictDoUpdate({ target: [dailyPullsTable.anonId, dailyPullsTable.pullDate], set: {
          cardId: card.id, cardName: card.name, whisper: card.whisper, isFlipped: true,
        } });
    }
    return updated!;
  });
}

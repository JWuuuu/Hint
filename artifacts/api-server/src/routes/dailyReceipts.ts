import { Router } from "express";
import * as z from "zod";
import {
  DAILY_RECEIPT_FEATURES,
  syncRevealedDailyReceipt, DailyReceiptConflict, DailyReceiptInputError,
  getOrCreateDailyReceipt,
  openDailyReceipt,
  serializeDailyReceipt,
} from "../modules/hint/dailyReceipts.js";

const router = Router();

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const date = new Date(`${value}T12:00:00.000Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; }, "Invalid calendar date");

const featureSchema = z.enum(DAILY_RECEIPT_FEATURES);

const dailyReceiptRequestSchema = z.object({
  anonId: z.string().min(1).max(200).optional(),
  anonymousDeviceId: z.string().min(1).max(200).optional(),
  userId: z.string().min(1).max(200).optional(),
  featureType: featureSchema,
  dailyKey: dateSchema.optional(),
});

function getDeviceId(data: z.infer<typeof dailyReceiptRequestSchema>): string | null {
  return data.anonymousDeviceId ?? data.anonId ?? null;
}

router.post("/daily-receipts/get-or-create", async (req, res) => {
  const parsed = dailyReceiptRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const anonymousDeviceId = getDeviceId(parsed.data);
  if (!anonymousDeviceId) {
    res.status(400).json({ error: "anonymousDeviceId is required" });
    return;
  }

  const now = new Date();
  const receipt = await getOrCreateDailyReceipt({
    anonymousDeviceId,
    userId: parsed.data.userId ?? null,
    featureType: parsed.data.featureType,
    dailyKey: parsed.data.dailyKey,
    now,
  });

  res.json(serializeDailyReceipt(receipt, now));
});

router.patch("/daily-receipts/open", async (req, res) => {
  const parsed = dailyReceiptRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const anonymousDeviceId = getDeviceId(parsed.data);
  if (!anonymousDeviceId) {
    res.status(400).json({ error: "anonymousDeviceId is required" });
    return;
  }

  const now = new Date();
  const receipt = await openDailyReceipt({
    anonymousDeviceId,
    userId: parsed.data.userId ?? null,
    featureType: parsed.data.featureType,
    dailyKey: parsed.data.dailyKey,
    now,
  });

  res.json(serializeDailyReceipt(receipt, now));
});

const syncSchema = dailyReceiptRequestSchema.extend({
  dailyKey: dateSchema, assignedCardId: z.string().max(100).nullable(),
  orientation: z.enum(["upright", "reversed"]).nullable().optional(), openedAt: z.string().datetime(),
});
router.post("/daily-receipts/sync", async (req, res) => {
  const parsed = syncSchema.safeParse(req.body);
  if (!parsed.success || !getDeviceId(parsed.data)) { res.status(400).json({ error: "Invalid revealed receipt" }); return; }
  try {
    const receipt = await syncRevealedDailyReceipt({ ...parsed.data, anonymousDeviceId: getDeviceId(parsed.data)! });
    res.json(serializeDailyReceipt(receipt));
  } catch (error) {
    res.status(error instanceof DailyReceiptConflict ? 409 : error instanceof DailyReceiptInputError ? 400 : 503).json({ error: error instanceof DailyReceiptConflict ? error.message : "Could not synchronize the revealed card" });
  }
});

export default router;

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// A deletion watermark also covers receipts first uploaded after history was cleared.
export const historyClearsTable = pgTable("history_clears", {
  ownerId: text("owner_id").primaryKey(),
  clearedAt: timestamp("cleared_at", { withTimezone: true }).notNull(),
  throughDay: text("through_day").notNull(),
});

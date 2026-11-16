import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

export const readingsTable = pgTable("readings", {
  id: uuid("id").primaryKey().defaultRandom(),
  anonId: text("anon_id").notNull(),
  cardName: text("card_name").notNull(),
  whisper: text("whisper").notNull(),
  spreadType: text("spread_type").notNull(),
  question: text("question"),
  territory: text("territory"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("readings_owner_created_at_idx").on(table.anonId, table.createdAt.desc().nullsFirst())]);

export type Reading = typeof readingsTable.$inferSelect;
export type InsertReading = typeof readingsTable.$inferInsert;

import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

export const journalEntriesTable = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  anonId: text("anon_id").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  mood: text("mood"),
  clientRequestId: uuid("client_request_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex("journal_entries_owner_request_unique").on(table.anonId, table.clientRequestId),
  index("journal_entries_owner_created_at_idx").on(table.anonId, table.createdAt.desc().nullsFirst()),
]);

export type JournalEntry = typeof journalEntriesTable.$inferSelect;
export type InsertJournalEntry = typeof journalEntriesTable.$inferInsert;

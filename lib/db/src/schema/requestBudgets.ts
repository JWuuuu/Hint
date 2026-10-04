import { pgTable, uuid, text, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";
export const requestBudgetsTable = pgTable("request_budgets", {
  bucketKey: text("bucket_key").notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  used: integer("used").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, table => [primaryKey({ columns: [table.bucketKey, table.periodStart] })]);
export const providerLeasesTable = pgTable("provider_leases", {
  id: uuid("id").primaryKey(), ownerId: uuid("owner_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

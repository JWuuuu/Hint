import { pgTable, uuid, text, timestamp, doublePrecision } from "drizzle-orm/pg-core";

export const profilesTable = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  anonId: text("anon_id").notNull().unique(),
  name: text("name").notNull(),
  birthDate: text("birth_date").notNull(),
  birthTime: text("birth_time"),
  birthPlace: text("birth_place"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  timezone: text("timezone"),
  timezoneOffset: doublePrecision("timezone_offset"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Profile = typeof profilesTable.$inferSelect;
export type InsertProfile = typeof profilesTable.$inferInsert;

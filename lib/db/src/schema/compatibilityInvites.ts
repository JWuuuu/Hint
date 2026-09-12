import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
export const compatibilityInvitesTable = pgTable("compatibility_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  ownerId: text("owner_id").notNull(),
  accepterOwnerId: uuid("accepter_owner_id"),
  relationshipType: text("relationship_type").notNull().default("unclear"),
  creatorInput: jsonb("creator_input").$type<Record<string, unknown>>().notNull(),
  friendInput: jsonb("friend_input").$type<Record<string, unknown>>(),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("pending"),
  jobId: uuid("job_id"),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  resultId: uuid("result_id").unique(),
  result: jsonb("result").$type<Record<string, unknown>>(),
});

import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";
export const testerInvitesTable = pgTable("tester_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  codeHash: text("code_hash").notNull().unique(),
  label: text("label").notNull().unique(),
  maxDevices: integer("max_devices").notNull().default(3),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

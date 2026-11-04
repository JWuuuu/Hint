import crypto from "node:crypto";
import type { pool } from "@workspace/db";

type Client = Pick<typeof pool, "query">;

/**
 * Private beta access. When invites are required, a new device session needs a
 * tester invitation code. The web app and its source are public, so this check
 * lives on the server. Production requires invites unless explicitly disabled.
 */
export function invitesRequired(env: NodeJS.ProcessEnv = process.env) {
  if (env.HINT_TESTER_INVITES_REQUIRED === "1") return true;
  if (env.HINT_TESTER_INVITES_REQUIRED === "0") return false;
  return env.NODE_ENV === "production";
}

/** 32 symbols without I, O, 0 or 1, so a code read aloud or retyped stays unambiguous. */
export const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

export function normalizeInviteCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 40) return null;
  const code = raw.toUpperCase().replace(/[\s-]/g, "");
  return CODE.test(code) ? code : null;
}
export const inviteCodeHash = (code: string) => crypto.createHash("sha256").update(`hint-tester-invite:${code}`).digest("hex");
/** 8 symbols, 40 bits. 256 is a multiple of 32, so masking each byte stays uniform. */
export const generateInviteCode = () => Array.from(crypto.randomBytes(8), byte => INVITE_ALPHABET[byte & 31]).join("");
export const formatInviteCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

const messages = {
  INVITE_REQUIRED: "This private beta needs a tester invite. Local features remain available.",
  INVITE_INVALID: "That tester invite isn't valid. Check the code, or ask for a new one.",
  INVITE_EXHAUSTED: "This tester invite is already connected on its maximum number of devices.",
} as const;
export type InviteFailure = keyof typeof messages;
export class InviteAccessError extends Error {
  readonly status = 403;
  constructor(readonly code: InviteFailure) { super(messages[code]); }
}

/**
 * Lock the invitation row and check its device cap. Call inside a transaction
 * that also inserts the device session, so concurrent claims cannot exceed it.
 */
export async function claimInvite(client: Client, rawCode: unknown): Promise<string> {
  if (rawCode === undefined || rawCode === null || rawCode === "") throw new InviteAccessError("INVITE_REQUIRED");
  const code = normalizeInviteCode(rawCode);
  if (!code) throw new InviteAccessError("INVITE_INVALID");
  const invite = (await client.query(
    "SELECT id,max_devices FROM tester_invites WHERE code_hash=$1 AND revoked_at IS NULL FOR UPDATE", [inviteCodeHash(code)],
  )).rows[0] as { id: string; max_devices: number } | undefined;
  if (!invite) throw new InviteAccessError("INVITE_INVALID");
  const active = (await client.query(
    "SELECT count(*)::int AS active FROM device_sessions WHERE invite_id=$1 AND revoked_at IS NULL AND expires_at > now()", [invite.id],
  )).rows[0] as { active: number };
  if (active.active >= invite.max_devices) throw new InviteAccessError("INVITE_EXHAUSTED");
  return invite.id;
}

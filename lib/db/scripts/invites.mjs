// Manage private-beta tester invitations. Codes are printed once and only their
// hashes are stored. Revoking an invitation also ends the device sessions it enrolled.
//   pnpm --filter @workspace/db run invites -- create --label "Alice" [--max-devices 3]
//   pnpm --filter @workspace/db run invites -- revoke --label "Alice"
//   pnpm --filter @workspace/db run invites -- list
// Keep the code format and hash in step with artifacts/api-server/src/lib/testerInvites.ts.
import { createHash, randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

export const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const generateInviteCode = () => Array.from(randomBytes(8), byte => INVITE_ALPHABET[byte & 31]).join("");
export const inviteCodeHash = code => createHash("sha256").update(`hint-tester-invite:${code}`).digest("hex");
export const formatInviteCode = code => `${code.slice(0, 4)}-${code.slice(4)}`;

function option(args, name) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(args) {
  const [command] = args;
  if (!["create", "revoke", "list"].includes(command)) throw new Error("Use: create --label <name> [--max-devices <n>] | revoke --label <name> | list");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    if (command === "create") {
      const label = option(args, "label")?.trim();
      const maxDevices = Number(option(args, "max-devices") ?? 3);
      if (!label || label.length > 80) throw new Error("--label is required (1-80 characters)");
      if (!Number.isInteger(maxDevices) || maxDevices < 1 || maxDevices > 20) throw new Error("--max-devices must be 1-20");
      const code = generateInviteCode();
      await client.query("INSERT INTO tester_invites(code_hash,label,max_devices) VALUES ($1,$2,$3)", [inviteCodeHash(code), label, maxDevices]);
      console.log(`Invite for ${label} (up to ${maxDevices} devices): ${formatInviteCode(code)}`);
      console.log("This code is shown only now. Send the tester the app link ending in ?tester=" + formatInviteCode(code));
    } else if (command === "revoke") {
      const label = option(args, "label")?.trim();
      if (!label) throw new Error("--label is required");
      const result = await client.query("UPDATE tester_invites SET revoked_at=now() WHERE label=$1 AND revoked_at IS NULL", [label]);
      console.log(result.rowCount ? `Revoked ${label}. Its device sessions stop working on their next request.` : `No active invite labelled ${label}.`);
    } else {
      const { rows } = await client.query(`SELECT i.label,i.max_devices,i.created_at,i.revoked_at,
        count(s.id) FILTER (WHERE s.revoked_at IS NULL AND s.expires_at > now())::int AS devices
        FROM tester_invites i LEFT JOIN device_sessions s ON s.invite_id=i.id GROUP BY i.id ORDER BY i.created_at`);
      for (const row of rows) console.log(`${row.label}: ${row.devices}/${row.max_devices} devices${row.revoked_at ? " (revoked)" : ""}`);
      if (!rows.length) console.log("No invites yet.");
    }
  } finally { await client.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2).filter(arg => arg !== "--")).catch(error => { console.error(error.message); process.exit(1); });
}

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
declare const __HINT_SCHEMA_EXPECTED__: Array<{ name: string; sha256: string }> | undefined;
/** Production embeds the exact reviewed migration digests in its immutable build. */
export function expectedMigrations() {
  if (typeof __HINT_SCHEMA_EXPECTED__ !== "undefined") return __HINT_SCHEMA_EXPECTED__;
  const directory = path.resolve(import.meta.dirname, "../../../../lib/db/migrations");
  return readdirSync(directory).filter(name => /^\d.*\.sql$/.test(name)).sort().map(name => ({
    name, sha256: createHash("sha256").update(readFileSync(path.join(directory, name))).digest("hex"),
  }));
}

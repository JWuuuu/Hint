import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expectedMigrations } from "./schemaReadiness";

type Provenance = Readonly<{ build: string; schema: string }>;
const unknown: Provenance = Object.freeze({ build: "unknown", schema: "unknown" });
const digest = /^[a-f0-9]{64}$/;
const artifactName = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}\.(?:m?js|map)$/;
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

function regularFile(file: string, maxBytes: number) {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.size > maxBytes) throw new Error("Invalid build artifact");
  return readFileSync(file);
}

/** Startup snapshot of emitted bytes, not attestation, Git identity or DB state. */
export function readBuildProvenance(entryUrl: string, schema: typeof expectedMigrations): Provenance {
  try {
    const entry = fileURLToPath(entryUrl);
    // Direct source/dev execution has no production artifact identity.
    if (path.basename(entry) !== "index.mjs") return unknown;
    const directory = path.dirname(entry);
    const metadata = JSON.parse(regularFile(path.join(directory, "build-provenance.json"), 32768).toString("utf8"));
    if (metadata?.format !== "hint-api-artifacts-v1" ||
        typeof metadata.artifactSha256 !== "string" || !digest.test(metadata.artifactSha256) ||
        typeof metadata.schemaSha256 !== "string" || !digest.test(metadata.schemaSha256) ||
        !Array.isArray(metadata.files) || metadata.files.length < 1 || metadata.files.length > 32) return unknown;

    const files: Array<{ name: string; sha256: string }> = [];
    for (const file of metadata.files) {
      if (typeof file?.name !== "string" || !artifactName.test(file.name) ||
          typeof file.sha256 !== "string" || !digest.test(file.sha256) ||
          (files.length > 0 && files[files.length - 1].name >= file.name)) return unknown;
      // Basenames only; no traversal, absolute paths, URLs or symlinks.
      const bytes = regularFile(path.join(directory, file.name), 64 * 1024 * 1024);
      if (sha256(bytes) !== file.sha256) return unknown;
      files.push({ name: file.name, sha256: file.sha256 });
    }
    if (!files.some(file => file.name === "index.mjs")) return unknown;
    const emittedNames = readdirSync(directory).filter(name => name !== "build-provenance.json").sort();
    if (JSON.stringify(emittedNames) !== JSON.stringify(files.map(file => file.name))) return unknown;
    const expected = schema();
    if (!expected.length || sha256(JSON.stringify(expected)) !== metadata.schemaSha256) return unknown;
    const payload = { format: "hint-api-artifacts-v1", files, schemaSha256: metadata.schemaSha256 };
    if (sha256(JSON.stringify(payload)) !== metadata.artifactSha256) return unknown;
    return Object.freeze({ build: `sha256:${metadata.artifactSha256}`, schema: `sha256:${metadata.schemaSha256}` });
  } catch {
    // Optional diagnostics must never fail health, expose filesystem/env values,
    // or turn absent/invalid metadata into an invented revision.
    return unknown;
  }
}

export const buildProvenance = readBuildProvenance(import.meta.url, expectedMigrations);

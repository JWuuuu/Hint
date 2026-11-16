import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildProvenance, readBuildProvenance } from "./buildProvenance";

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const migrations = [{ name: "001_fixture.sql", sha256: sha("synthetic migration") }];
const unknown = { build: "unknown", schema: "unknown" };
let directory: string;
const manifestPath = () => path.join(directory, "build-provenance.json");
const read = () => readBuildProvenance(pathToFileURL(path.join(directory, "index.mjs")).href, () => migrations);
function manifest() {
  const files = ["index.mjs", "worker.mjs"].map(name => ({ name, sha256: sha(readFileSync(path.join(directory, name))) }));
  const payload = { format: "hint-api-artifacts-v1", files, schemaSha256: sha(JSON.stringify(migrations)) };
  return { ...payload, artifactSha256: sha(JSON.stringify(payload)) };
}
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "hint-provenance-unit-"));
  writeFileSync(path.join(directory, "index.mjs"), "// synthetic entry\n");
  writeFileSync(path.join(directory, "worker.mjs"), "// synthetic worker\n");
  writeFileSync(manifestPath(), JSON.stringify(manifest()));
});
afterEach(() => {
  vi.unstubAllEnvs(); vi.restoreAllMocks();
  if (path.dirname(directory) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith("hint-provenance-unit-")) throw new Error("Unsafe fixture cleanup");
  rmSync(directory, { recursive: true, force: true });
});

it("verifies actual bytes and changes identity when rebuilt artifacts change", () => {
  const first = read();
  expect(first).toEqual({ build: `sha256:${manifest().artifactSha256}`, schema: `sha256:${manifest().schemaSha256}` });
  writeFileSync(path.join(directory, "worker.mjs"), "// changed worker\n");
  expect(read()).toEqual(unknown); // old metadata cannot label new bytes
  writeFileSync(manifestPath(), JSON.stringify(manifest()));
  expect(read().build).not.toBe(first.build);
  expect(read().schema).toBe(first.schema);
});

it.each(["missing", "invalid JSON", "oversized", "directory"])("reports unknown for %s metadata without logging", kind => {
  const error = vi.spyOn(console, "error"), warn = vi.spyOn(console, "warn"), log = vi.spyOn(console, "log");
  rmSync(manifestPath());
  if (kind === "invalid JSON") writeFileSync(manifestPath(), "{synthetic secret/path");
  if (kind === "oversized") writeFileSync(manifestPath(), " ".repeat(32769));
  if (kind === "directory") mkdirSync(manifestPath());
  expect(read()).toEqual(unknown);
  expect(error).not.toHaveBeenCalled(); expect(warn).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled();
});

it.each([
  ["null", () => null],
  ["version", (m: any) => ({ ...m, format: "future" })],
  ["secret digest", (m: any) => ({ ...m, artifactSha256: "synthetic-secret:C:/private" })],
  ["unbound digest", (m: any) => ({ ...m, artifactSha256: "a".repeat(64) })],
  ["schema mismatch", (m: any) => ({ ...m, schemaSha256: "a".repeat(64) })],
  ["no entry", (m: any) => ({ ...m, files: m.files.slice(1) })],
  ["duplicate", (m: any) => ({ ...m, files: [m.files[0], m.files[0]] })],
  ["unsorted", (m: any) => ({ ...m, files: m.files.toReversed() })],
  ["missing worker", (m: any) => ({ ...m, files: [m.files[0], { ...m.files[1], name: "missing.mjs" }] })],
  ["traversal", (m: any) => ({ ...m, files: [{ ...m.files[0], name: "../index.mjs" }] })],
  ["absolute path", (m: any) => ({ ...m, files: [{ ...m.files[0], name: "C:/private/index.mjs" }] })],
  ["URL", (m: any) => ({ ...m, files: [{ ...m.files[0], name: "https://synthetic.invalid/index.mjs" }] })],
  ["self reference", (m: any) => ({ ...m, files: [{ ...m.files[0], name: "build-provenance.json" }] })],
  ["empty files", (m: any) => ({ ...m, files: [] })],
] as const)("reports unknown for malformed %s", (_name, change) => {
  writeFileSync(manifestPath(), JSON.stringify(change(manifest())));
  expect(read()).toEqual(unknown);
});

it("does not infer a build from environment, development source or failed schema loading", () => {
  const before = read();
  for (const key of ["GIT_COMMIT", "RENDER_GIT_COMMIT", "HINT_BUILD_ID", "HINT_SCHEMA_SHA256"]) vi.stubEnv(key, "synthetic-secret:C:/private/branch");
  expect(read()).toEqual(before);
  expect(buildProvenance).toEqual(unknown);
  expect(readBuildProvenance(pathToFileURL(path.join(directory, "source.ts")).href, () => migrations)).toEqual(unknown);
  expect(readBuildProvenance(pathToFileURL(path.join(directory, "index.mjs")).href, () => { throw new Error("private"); })).toEqual(unknown);
});

it("rejects unlisted output and a self-consistent but incomplete manifest", () => {
  writeFileSync(path.join(directory, "extra.mjs"), "// unlisted bytes\n");
  expect(read()).toEqual(unknown);
  rmSync(path.join(directory, "extra.mjs"));
  const { artifactSha256: _old, ...partial } = manifest();
  partial.files.pop();
  writeFileSync(manifestPath(), JSON.stringify({ ...partial, artifactSha256: sha(JSON.stringify(partial)) }));
  expect(read()).toEqual(unknown);
});

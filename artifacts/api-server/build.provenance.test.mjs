import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

const api = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(api, "../..");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const sentinel = "SYNTHETIC-SECRET-C:/private/branch-https://example.invalid/token";
const cleanEnv = Object.fromEntries(["PATH", "SystemRoot", "SYSTEMROOT", "TEMP", "TMP"].filter(key => process.env[key]).map(key => [key, process.env[key]]));
const spoof = Object.fromEntries(["GIT_COMMIT", "RENDER_GIT_COMMIT", "SOURCE_VERSION", "HINT_BUILD_ID", "HINT_BUILD_SHA256", "HINT_SCHEMA_SHA256"].map(key => [key, sentinel]));

function build(directory, cwd, env = {}) {
  const result = spawnSync(process.execPath, [path.join(directory, "build.mjs")], {
    cwd, env: { ...cleanEnv, GIT_DIR: path.join(cwd, "no-git-metadata"), ...env }, encoding: "utf8", timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!(result.stdout + result.stderr).includes(sentinel));
}

async function verifyManifest(dist, migrationDir) {
  const metadata = JSON.parse(await readFile(path.join(dist, "build-provenance.json"), "utf8"));
  // Independently enumerate and hash every emitted byte; no fixed expected SHA.
  const files = await Promise.all((await readdir(dist)).filter(name => name !== "build-provenance.json").sort().map(async name => ({ name, sha256: sha(await readFile(path.join(dist, name))) })));
  const expected = await Promise.all((await readdir(migrationDir)).filter(name => /^\d.*\.sql$/.test(name)).sort().map(async name => ({ name, sha256: sha(await readFile(path.join(migrationDir, name))) })));
  const payload = { format: "hint-api-artifacts-v1", files, schemaSha256: sha(JSON.stringify(expected)) };
  assert.deepEqual(metadata, { ...payload, artifactSha256: sha(JSON.stringify(payload)) });
  assert.ok(files.some(file => file.name === "index.mjs"));
  assert.ok(files.some(file => file.name === "pino-worker.mjs"));
  assert.ok(!JSON.stringify(metadata).includes(sentinel));
  return metadata;
}

async function sourceFixture(directory) {
  for (const relative of ["artifacts/api-server", "lib/db", "lib/api-zod"]) {
    const destination = path.join(directory, relative);
    await mkdir(destination, { recursive: true });
    for (const name of ["src", "package.json", "tsconfig.json"]) await cp(path.join(root, relative, name), path.join(destination, name), { recursive: true });
  }
  await cp(path.join(root, "tsconfig.base.json"), path.join(directory, "tsconfig.base.json"));
  await cp(path.join(root, "lib/db/migrations"), path.join(directory, "lib/db/migrations"), { recursive: true });
  const fixtureApi = path.join(directory, "artifacts/api-server");
  await cp(path.join(api, "build.mjs"), path.join(fixtureApi, "build.mjs"));
  const modules = path.join(fixtureApi, "node_modules");
  await mkdir(path.join(modules, "@workspace"), { recursive: true });
  for (const name of await readdir(path.join(api, "node_modules"))) {
    if (!name.startsWith(".") && name !== "@workspace") await symlink(path.join(api, "node_modules", name), path.join(modules, name), "junction");
  }
  for (const name of ["db", "api-zod"]) {
    await symlink(path.join(directory, "lib", name), path.join(modules, "@workspace", name), "junction");
    await symlink(path.join(root, "lib", name, "node_modules"), path.join(directory, "lib", name, "node_modules"), "junction");
  }
  return fixtureApi;
}

test("production provenance uses completed artifacts and stays honest after copying or mutation", { timeout: 90000 }, async t => {
  const temporary = await mkdtemp(path.join(tmpdir(), "hint-provenance-build-"));
  try {
    // Stop dotenv's ancestor search and force the actual production entry to
    // listen only on loopback/ephemeral ports. No credentials or real DB needed.
    await writeFile(path.join(temporary, ".env"), "# isolated synthetic test\n");
    const bootstrap = path.join(temporary, "loopback.mjs");
    await writeFile(bootstrap, `import net from 'node:net';
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function(port, callback) {
  if (typeof port !== 'number') throw new Error('Non-test listener');
  this.once('listening', () => process.send({ port: this.address().port }));
  return listen.call(this, 0, '127.0.0.1', callback);
};
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function(...args) {
  const options = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (!options || !['127.0.0.1', '::1', 'localhost'].includes(options.host)) throw new Error('Non-loopback connection blocked');
  return connect.apply(this, args);
};\n`);

    async function serve(dist, expected, env = {}) {
      let output = "";
      const child = spawn(process.execPath, ["--import", pathToFileURL(bootstrap).href, path.join(dist, "index.mjs")], {
        cwd: temporary,
        env: { ...cleanEnv, NODE_ENV: "production", PORT: "5050", LOG_LEVEL: "info", HINT_DRAINING: "1", DATABASE_URL: "postgresql://synthetic:synthetic@127.0.0.1:1/synthetic", ...env },
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      });
      child.stdout.on("data", data => { output += data; });
      child.stderr.on("data", data => { output += data; });
      try {
        const port = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Local API startup timed out")), 10000);
          child.once("message", value => { clearTimeout(timeout); resolve(value.port); });
          child.once("exit", code => { clearTimeout(timeout); reject(new Error(`Local API exited ${code}: ${output}`)); });
          child.once("error", error => { clearTimeout(timeout); reject(error); });
        });
        const health = await fetch(`http://127.0.0.1:${port}/api/healthz`);
        assert.equal(health.status, 200);
        assert.equal(await health.text(), '{"status":"ok"}');
        assert.equal(health.headers.get("cache-control"), "no-store");
        assert.equal(health.headers.get("x-hint-build"), expected ? `sha256:${expected.artifactSha256}` : "unknown");
        assert.equal(health.headers.get("x-hint-schema"), expected ? `sha256:${expected.schemaSha256}` : "unknown");
        assert.ok(!JSON.stringify([...health.headers]).includes(sentinel));
        const ready = await fetch(`http://127.0.0.1:${port}/api/readyz`);
        assert.equal(ready.status, 503);
        assert.deepEqual(await ready.json(), {
          status: "unavailable", error: "The request could not be completed.",
          code: "HTTP_503", requestId: ready.headers.get("x-request-id"),
        });
        const privateStatus = await fetch(`http://127.0.0.1:${port}/api/astro/status`);
        assert.equal(privateStatus.status, 401);
        assert.equal((await privateStatus.json()).code, "DEVICE_SESSION_REQUIRED");
        assert.equal(privateStatus.headers.get("x-hint-build"), null);
      } finally {
        if (child.exitCode === null) {
          const exited = new Promise(resolve => child.once("exit", resolve));
          child.kill("SIGKILL");
          await exited;
        }
      }
      assert.ok(!output.includes(sentinel), "Synthetic env sentinel leaked to logs");
    }

    const dist = path.join(api, "dist");
    build(api, api);
    const baseline = await verifyManifest(dist, path.join(root, "lib/db/migrations"));
    await t.test("actual production build and auth/draining boundaries", () => serve(dist, baseline));
    t.diagnostic(`workspace artifact sha256:${baseline.artifactSha256}; expected-schema sha256:${baseline.schemaSha256}`);

    await t.test("build-time environment, absent Git metadata and caller cwd cannot relabel bytes", async () => {
      build(api, temporary, spoof);
      assert.deepEqual(await verifyManifest(dist, path.join(root, "lib/db/migrations")), baseline);
    });
    const copied = path.join(temporary, "relocated-dist");
    await cp(dist, copied, { recursive: true });
    await t.test("copied artifact, changed cwd and runtime spoof environment retain identity", () => serve(copied, baseline, spoof));
    const sidecar = path.join(copied, "build-provenance.json");
    const original = await readFile(sidecar);
    await t.test("missing metadata stays healthy but unknown", async () => {
      await rm(sidecar); await serve(copied, null, spoof);
    });
    await t.test("malformed metadata stays healthy but unknown", async () => {
      await writeFile(sidecar, "{invalid synthetic metadata"); await serve(copied, null, spoof);
    });
    await t.test("altered executable cannot keep an old label", async () => {
      await writeFile(sidecar, original);
      await appendFile(path.join(copied, "index.mjs"), "\n// synthetic artifact mutation\n");
      await serve(copied, null, spoof);
    });
    await t.test("ordinary source archive builds without Git, and changed input changes fingerprint", async () => {
      const fixture = await sourceFixture(path.join(temporary, "source-archive"));
      build(fixture, fixture);
      const migrationDir = path.resolve(fixture, "../../lib/db/migrations");
      const first = await verifyManifest(path.join(fixture, "dist"), migrationDir);
      await serve(path.join(fixture, "dist"), first);
      // Maps are emitted artifacts too: even an input comment changes their bytes.
      await appendFile(path.join(fixture, "src/routes/health.ts"), "\n// Synthetic source change, isolated test only.\n");
      build(fixture, fixture);
      const second = await verifyManifest(path.join(fixture, "dist"), migrationDir);
      assert.notEqual(second.artifactSha256, first.artifactSha256);
      assert.equal(second.schemaSha256, first.schemaSha256);
      await serve(path.join(fixture, "dist"), second);
      await writeFile(path.join(fixture, "dist/build-provenance.json"), JSON.stringify(first));
      await serve(path.join(fixture, "dist"), null);
    });
  } finally {
    if (path.dirname(temporary) !== path.resolve(tmpdir()) || !path.basename(temporary).startsWith("hint-provenance-build-")) throw new Error("Unsafe fixture cleanup");
    await rm(temporary, { recursive: true, force: true });
  }
});

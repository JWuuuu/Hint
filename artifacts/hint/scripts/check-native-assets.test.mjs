import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const script = fileURLToPath(new URL("./check-native-assets.mjs", import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "hint-assets-regression-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const web = join(root, "web"); const native = join(root, "native");
  for (const path of [web, native]) mkdirSync(join(path, "assets"), { recursive: true });
  return { web, native, run: () => spawnSync(process.execPath, [script, web, native], { encoding: "utf8" }),
    write: (path, text, roots = [web, native]) => roots.forEach(root => writeFileSync(join(root, path), text)) };
}
test("an empty or incomplete web build never passes native verification", t => {
  const f = fixture(t);
  assert.equal(f.run().status, 1);
  f.write("index.html", "<html>fixture</html>");
  assert.equal(f.run().status, 1);
  f.write("assets/app.js", "");
  assert.equal(f.run().status, 1);
});
test("exact copied assets pass, including Capacitor's generated cordova files", t => {
  const f = fixture(t);
  f.write("index.html", "<script src='assets/app.js'></script>"); f.write("assets/app.js", "export default 'fixture'");
  f.write("cordova.js", "", [f.native]);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).nativeAssetsMatch, true);
});
test("modified and stale copied assets fail", t => {
  const f = fixture(t);
  f.write("index.html", "<script src='assets/app.js'></script>"); f.write("assets/app.js", "export default 'fixture'");
  f.write("assets/app.js", "stale", [f.native]); assert.equal(f.run().status, 1);
  f.write("assets/app.js", "export default 'fixture'"); f.write("assets/old.js", "stale", [f.native]);
  assert.equal(f.run().status, 1);
});

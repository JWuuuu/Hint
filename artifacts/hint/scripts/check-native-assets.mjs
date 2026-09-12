import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";

function files(root, directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return files(root, path);
    const content = readFileSync(path);
    return [{ path: relative(root, path), bytes: content.length, hash: createHash("sha256").update(content).digest("hex") }];
  });
}
const web = files(resolve(process.argv[2] || "dist/public"));
if (!web.some(row => row.path === "index.html" && row.bytes > 0) || !web.some(row => /^assets\/.+\.js$/.test(row.path) && row.bytes > 0)) {
  console.error("Verified web output requires a nonempty index.html and application JavaScript payload.");
  process.exit(1);
}
const nativeRoot = resolve(process.argv[3] || "ios/App/App/public");
const native = new Map(files(nativeRoot).map(row => [row.path, row.hash]));
const mismatches = web.filter(row => native.get(row.path) !== row.hash);
const extras = [...native.keys()].filter(path => !web.some(row => row.path === path) && !["cordova.js", "cordova_plugins.js"].includes(path));
if (mismatches.length || extras.length) {
  console.error(`Native assets differ from verified web output: ${mismatches.length} changed/missing, ${extras.length} stale.`);
  process.exit(1);
}
console.log(JSON.stringify({ webFiles: web.length, sha256: createHash("sha256").update(JSON.stringify(web.sort((a,b) => a.path.localeCompare(b.path)))).digest("hex"), nativeAssetsMatch: true }));

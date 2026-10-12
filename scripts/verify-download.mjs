import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = path.join(root, 'CHECKPOINT-MANIFEST.json');
const restoreProtection = process.argv.includes('--restore-protection');
let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  console.error('Download the full checkpoint ZIP from the release linked in HANDOFF_WINDOWS.md. The Git source ZIP does not include CHECKPOINT-MANIFEST.json or the frozen backup ZIPs.');
  process.exit(1);
}

let verified = 0;
const protectedFiles = [];
for (const entry of manifest.files) {
  const file = path.resolve(root, entry.path);
  const relative = path.relative(root, file);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Invalid checkpoint path: ${entry.path}`);
  }
  const info = await stat(file);
  if (!info.isFile() || info.size !== entry.bytes) throw new Error(`Size mismatch: ${entry.path}`);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  if (hash.digest('hex') !== entry.sha256) throw new Error(`Checksum mismatch: ${entry.path}`);
  verified += 1;
  if (entry.readOnly) protectedFiles.push(file);
}

if (restoreProtection) {
  for (const file of protectedFiles) await chmod(file, 0o444);
}
console.log(`Verified ${verified} files from commit ${manifest.commit}.`);
if (restoreProtection) console.log(`Restored read-only protection on ${protectedFiles.length} saved files.`);

import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const library = fileURLToPath(new URL('../', import.meta.url));
export const approved = path.join(library, 'approved/v1');
export async function verifyApproved() {
  const manifest = JSON.parse(await readFile(path.join(approved, 'checksums.json'), 'utf8'));
  for (const [name, expected] of Object.entries(manifest.files)) {
    const file = path.join(approved, name);
    const actual = createHash('sha256').update(await readFile(file)).digest('hex');
    if (actual !== expected) throw new Error(`Approved file changed: ${name}`);
    if ((await stat(file)).mode & 0o222) throw new Error(`Approved file is writable: ${name}`);
  }
  if (manifest.greetingSha256 !== 'fbda0c5e0722a0a9f706b1323336f3d4a704d2cb91252e28e5eca42725200191') {
    throw new Error('The approved greeting does not match the saved reference.');
  }
  return { files: Object.keys(manifest.files).length, greetingSha256: manifest.greetingSha256 };
}

export function assertWorkingOutput(target) {
  const relative = path.relative(library, path.resolve(target));
  const first = relative.split(path.sep)[0];
  if (!['preview', 'evidence', 'releases', 'assets'].includes(first)) {
    throw new Error('Output must stay in the working library; approved snapshots cannot be rebuilt.');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await verifyApproved()));
}

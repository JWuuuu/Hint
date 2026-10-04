import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import reporter from './qa-progress-reporter.cjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  const input = process.argv[2];
  if (!input) throw new Error('Usage: node scripts/qa-resume.mjs /absolute/path/progress.jsonl');
  const lines = readFileSync(input, 'utf8').split('\n');
  // A killed process may leave only the final line incomplete. Never infer a pass from it.
  const rows = lines.filter((line, index) => line.trim() && (index < lines.length - 1 || line.endsWith('}'))).map(line => JSON.parse(line));
  const selectors = reporter.completedSelectors(rows, reporter.captureSource(root), reporter.captureBuild(process.env.HINT_QA_BUILD_DIR));
  const output = path.resolve(path.dirname(input), 'completed-tests.txt');
  writeFileSync(output, `${selectors.join('\n')}${selectors.length ? '\n' : ''}`);
  console.log(`${selectors.length} completed passes verified against current source and build.`);
  console.log(`Use the original test selection with --test-list-invert "${output}" and a new HINT_HANDOFF_OUTPUT directory.`);
} catch (error) {
  console.error(`Cannot resume: ${error.message}`);
  process.exitCode = 1;
}

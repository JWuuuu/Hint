import test from 'node:test';
import assert from 'node:assert/strict';
import reporter from './qa-progress-reporter.cjs';

const source = { fingerprint: 'source-v1' };
const build = { fingerprint: 'build-v1' };
const entry = { kind: 'test', project: 'iphone-se', location: { file: 'journal.spec.ts', line: 10, column: 1 }, title: 'retains a failed draft' };
test('an interrupted run retains only completed passes, never skipped or failed cases', () => {
  const rows = [{ kind: 'begin', source, build }, { ...entry, status: 'passed' }, { ...entry, title: 'retry', status: 'failed' }, { ...entry, title: 'not applicable', status: 'skipped' }];
  assert.deepEqual(reporter.completedSelectors(rows, source, build), ['[iphone-se] › journal.spec.ts:10:1 › retains a failed draft']);
});
test('changed code or production assets cannot inherit previous passes', () => {
  const rows = [{ kind: 'begin', source, build }, { ...entry, status: 'passed' }];
  assert.throws(() => reporter.completedSelectors(rows, { fingerprint: 'source-v2' }, build), /Source or tests changed/);
  assert.throws(() => reporter.completedSelectors(rows, source, { fingerprint: 'build-v2' }), /assets are missing or changed/);
  assert.throws(() => reporter.completedSelectors(rows, source, null), /assets are missing or changed/);
});
test('a mixed log with an older build is rejected rather than silently deduplicated', () => {
  const rows = [{ kind: 'begin', source, build: { fingerprint: 'old' } }, { kind: 'begin', source, build }];
  assert.throws(() => reporter.completedSelectors(rows, source, build), /assets are missing or changed/);
});

#!/usr/bin/env node
// Summarize a Playwright JSON report so retries never hide a failure:
// clean first-attempt passes, tests that only passed on retry ("flaky"),
// failures, and skipped tests with their stated reason.
// Usage: node scripts/e2e-summary.mjs <report.json> [heading]
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const [file, heading = "WebKit e2e"] = process.argv.slice(2);
const out = text => process.env.GITHUB_STEP_SUMMARY ? appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`) : console.log(text);

if (!file || !existsSync(file)) {
  out(`### ${heading}\n\nNo Playwright report was written (${file ?? "no path given"}); the run stopped before tests finished.`);
  process.exit(0);
}

const report = JSON.parse(readFileSync(file, "utf8"));
const rows = [];
const walk = suites => {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
      const attempts = (test.results ?? []).map(result => result.status);
      const firstError = (test.results ?? []).find(result => result.error)?.error?.message ?? "";
      const reason = (test.annotations ?? []).find(note => note.type === "fixme" || note.type === "skip")?.description ?? "";
      rows.push({
        title: `${spec.file} › ${spec.title}`, project: test.projectName, status: test.status, attempts, reason,
        error: firstError.replace(/\u001b\[[0-9;]*m/g, "").split("\n").find(line => line.trim())?.trim().slice(0, 160) ?? "",
      });
    }
    walk(suite.suites);
  }
};
walk(report.suites);

const clean = rows.filter(row => row.status === "expected" && row.attempts[0] === "passed");
const flaky = rows.filter(row => row.status === "flaky");
const failed = rows.filter(row => row.status === "unexpected");
const skipped = rows.filter(row => row.status === "skipped");
const cell = text => text.replace(/\|/g, "\\|");

out(`### ${heading}\n`);
out(`| First attempt passed | Passed only on retry (flaky) | Failed | Skipped | Total |\n|---|---|---|---|---|\n| ${clean.length} | ${flaky.length} | ${failed.length} | ${skipped.length} | ${rows.length} |\n`);
if (failed.length) {
  out(`**Failed (${failed.length})**\n\n| Test | Project | First error |\n|---|---|---|`);
  for (const row of failed) out(`| ${cell(row.title)} | ${row.project} | ${cell(row.error)} |`);
  out("");
}
if (flaky.length) {
  out(`**Passed only on retry (${flaky.length}).** These are intermittent and still need a root-cause fix.\n\n| Test | Project | First-attempt error |\n|---|---|---|`);
  for (const row of flaky) out(`| ${cell(row.title)} | ${row.project} | ${cell(row.error)} |`);
  out("");
}
if (skipped.length) {
  const reasons = new Map();
  for (const row of skipped) reasons.set(row.reason || "(no reason given)", (reasons.get(row.reason || "(no reason given)") ?? 0) + 1);
  out(`**Skipped (${skipped.length}), not counted as passing**\n\n| Reason | Tests |\n|---|---|`);
  for (const [reason, count] of reasons) out(`| ${cell(reason)} | ${count} |`);
  out("");
}

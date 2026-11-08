#!/usr/bin/env node
// Summarize a Playwright JSON report so retries never hide a failure:
// clean first-attempt passes, tests that only passed on retry ("flaky"),
// failures, and skipped tests with their stated reason.
// It also prints each failing attempt's error and page snapshot to the job log,
// which stays readable where downloading the evidence artifact is not possible.
// Usage: node scripts/e2e-summary.mjs <report.json> [heading]
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const [file, heading = "WebKit e2e"] = process.argv.slice(2);
const out = text => process.env.GITHUB_STEP_SUMMARY ? appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`) : console.log(text);

if (!file || !existsSync(file)) {
  out(`### ${heading}\n\nNo Playwright report was written (${file ?? "no path given"}); the run stopped before tests finished.`);
  process.exit(0);
}

const report = JSON.parse(readFileSync(file, "utf8"));
const stripAnsi = text => text.replace(/\u001b\[[0-9;]*m/g, "");
const rows = [];
const details = [];
// The "# Page snapshot" section of Playwright's error-context attachment, if the attempt has one.
const pageSnapshot = result => {
  const attachment = (result.attachments ?? []).find(item => item.name === "error-context" && item.path && existsSync(item.path));
  if (!attachment) return "";
  const text = readFileSync(attachment.path, "utf8");
  const start = text.indexOf("# Page snapshot");
  return (start >= 0 ? text.slice(start) : text).split("\n").slice(0, 160).join("\n");
};
const walk = suites => {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
      const attempts = (test.results ?? []).map(result => result.status);
      const firstError = (test.results ?? []).find(result => result.error)?.error?.message ?? "";
      const reason = (test.annotations ?? []).find(note => note.type === "fixme" || note.type === "skip")?.description ?? "";
      const title = `${spec.file} › ${spec.title}`;
      rows.push({
        title, project: test.projectName, status: test.status, attempts, reason,
        error: stripAnsi(firstError).split("\n").find(line => line.trim())?.trim().slice(0, 160) ?? "",
      });
      if (test.status === "unexpected" || test.status === "flaky") {
        for (const result of test.results ?? []) if (result.status !== "passed" && result.status !== "skipped") {
          details.push({ title, project: test.projectName, attempt: result.retry ?? 0,
            error: stripAnsi(result.error?.message ?? result.status).split("\n").slice(0, 40).join("\n"), snapshot: pageSnapshot(result) });
        }
      }
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

for (const detail of details.slice(0, 40)) {
  console.log(`::group::${detail.project} attempt ${detail.attempt + 1}: ${detail.title}`);
  console.log(detail.error);
  if (detail.snapshot) console.log(`\n${detail.snapshot}`);
  console.log("::endgroup::");
}
if (details.length > 40) console.log(`${details.length - 40} more failing attempts are in the evidence artifact.`);

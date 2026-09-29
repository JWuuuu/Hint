const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

function hashFiles(root, files) {
  const hash = crypto.createHash('sha256');
  for (const name of [...new Set(files)].sort()) {
    hash.update(name.replaceAll('\\', '/')).update('\0');
    const filename = path.join(root, name);
    hash.update(fs.existsSync(filename) ? fs.readFileSync(filename) : '<deleted>').update('\0');
  }
  return hash.digest('hex');
}

function captureSource(root) {
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  const repository = git('rev-parse', '--show-toplevel');
  const files = execFileSync('git', ['-C', repository, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' })
    .split('\0').filter(Boolean).filter(name =>
      /^(artifacts\/(hint\/(src|public|e2e|scripts|ios)\/|api-server\/src\/)|lib\/|\.github\/workflows\/)/.test(name) ||
      /(^|\/)(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig[^/]*\.json|vite[^/]*\.ts|playwright[^/]*\.ts|capacitor\.config\.json|\.node-version)$/.test(name));
  return { commit: git('rev-parse', 'HEAD'), fingerprint: hashFiles(repository, files) };
}

function captureBuild(directory) {
  if (!directory) return null;
  const files = [];
  function visit(relative = '') {
    for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) visit(name);
      else if (entry.isFile()) files.push(name);
    }
  }
  visit();
  return { directory: path.resolve(directory), fingerprint: hashFiles(directory, files) };
}

function completedSelectors(rows, currentSource, currentBuild) {
  const starts = rows.filter(row => row.kind === 'begin');
  if (!starts.length) throw new Error('No recorded source/build identity; start a fresh run.');
  for (const run of starts) {
    if (run.source?.fingerprint !== currentSource.fingerprint) throw new Error('Source or tests changed; do not reuse these results.');
    if (!currentBuild || !run.build || run.build.fingerprint !== currentBuild.fingerprint) throw new Error('Production assets are missing or changed; start a fresh run.');
  }
  // A skip is not proof of completion. A failed or interrupted case must run again.
  return [...new Set(rows.filter(row => row.kind === 'test' && row.status === 'passed')
    .map(row => `[${row.project}] › ${row.location.file}:${row.location.line}:${row.location.column} › ${row.title}`))];
}

class DurableProgress {
  onBegin(config, suite) {
    this.root = config.rootDir;
    this.file = process.env.HINT_PROGRESS_JSONL || path.join(path.dirname(config.projects[0].outputDir), 'progress.jsonl');
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.write({ kind: 'begin', at: new Date().toISOString(), source: captureSource(config.rootDir), build: captureBuild(process.env.HINT_QA_BUILD_DIR), selected: suite.allTests().length });
  }
  write(value) { fs.appendFileSync(this.file, `${JSON.stringify(value)}\n`); }
  onTestEnd(test, result) {
    this.write({ kind: 'test', at: new Date().toISOString(), id: test.id, title: test.title,
      project: test.parent.project().name,
      location: { ...test.location, file: path.relative(this.root, test.location.file).replaceAll('\\', '/') },
      expectedStatus: test.expectedStatus, status: result.status, durationMs: result.duration,
      errors: result.errors.map(error => ({ message: error.message })),
      attachments: result.attachments.map(item => ({ name: item.name, contentType: item.contentType, path: item.path, body: item.body?.toString('base64') })),
    });
  }
  onEnd(result) { this.write({ kind: 'end', at: new Date().toISOString(), status: result.status }); }
}

module.exports = DurableProgress;
module.exports.captureSource = captureSource;
module.exports.captureBuild = captureBuild;
module.exports.completedSelectors = completedSelectors;

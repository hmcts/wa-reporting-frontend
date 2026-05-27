const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

function quote(value) {
  return JSON.stringify(value || 'unknown');
}

const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = process.env.PACKAGES_VERSION || packageJson.version || 'unknown';
const commit = process.env.GIT_COMMIT || process.env.COMMIT_SHA || git(['rev-parse', 'HEAD']);
const date = process.env.LAST_COMMIT_TIMESTAMP || process.env.BUILD_DATE || git(['log', '-1', '--format=%cI']);

writeFileSync(
  path.join(root, 'version'),
  [`version: ${quote(version)}`, `commit: ${quote(commit)}`, `date: ${quote(date)}`, ''].join('\n')
);

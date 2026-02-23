#!/usr/bin/env node

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const args = new Set(process.argv.slice(2));
const includeProd = !args.has('--dev');
const includeDev = !args.has('--prod');
const namesOnly = args.has('--names');
const spaceSeparated = args.has('--space');

if (!includeProd && !includeDev) {
  console.error('Select at least one group: --prod, --dev, or omit both for all.');
  process.exit(1);
}

const pkgPath = resolve(process.cwd(), 'package.json');
let pkg;

try {
  pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
} catch (error) {
  console.error(`Cannot read package.json at ${pkgPath}: ${error.message}`);
  process.exit(1);
}

const names = new Set();

if (includeProd && pkg.dependencies) {
  for (const name of Object.keys(pkg.dependencies)) {
    names.add(name);
  }
}

if (includeDev && pkg.devDependencies) {
  for (const name of Object.keys(pkg.devDependencies)) {
    names.add(name);
  }
}

const ordered = [...names].sort((a, b) => a.localeCompare(b));
const values = namesOnly ? ordered : ordered.map(name => `${name}@latest`);

if (spaceSeparated) {
  console.log(values.join(' '));
  process.exit(0);
}

for (const value of values) {
  console.log(value);
}

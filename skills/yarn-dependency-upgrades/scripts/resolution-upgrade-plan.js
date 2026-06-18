#!/usr/bin/env node

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildSuggestedNpmResolutionValue, parseNpmResolutionValue } = require('./descriptor-utils');

function runYarn(args) {
  const result = spawnSync('yarn', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    const details = stderr || stdout || `exit code ${result.status}`;
    throw new Error(`yarn ${args.join(' ')} failed: ${details}`);
  }

  return result.stdout || '';
}

function getLatestVersion(packageName) {
  const output = runYarn(['npm', 'info', packageName, '--fields', 'version', '--json'])
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  for (const line of output) {
    try {
      const row = JSON.parse(line);
      if (row?.name === packageName && typeof row?.version === 'string') {
        return row.version;
      }
    } catch {
      // Ignore invalid JSON lines.
    }
  }

  return null;
}

function buildResolutionPlanItem(descriptor, value, latestVersionForPackage) {
  const parsed = parseNpmResolutionValue(descriptor, value);
  const notes = [];

  if (!parsed.supported) {
    notes.push(
      parsed.protocol && parsed.protocol !== 'npm'
        ? `Unsupported resolution protocol "${parsed.protocol}"; review manually.`
        : 'Cannot parse npm resolution target; review manually.'
    );

    return {
      descriptor,
      packageName: parsed.descriptorPackageName,
      currentTarget: value,
      currentTargetPackage: parsed.targetPackageName,
      currentVersion: parsed.targetVersion,
      latestVersion: null,
      needsUpgrade: false,
      suggestedPackageJsonValue: null,
      notes,
    };
  }

  const latestVersion = latestVersionForPackage(parsed.targetPackageName);

  if (!latestVersion) {
    notes.push(`Cannot determine latest version for ${parsed.targetPackageName}.`);
  }

  const suggestedPackageJsonValue = latestVersion ? buildSuggestedNpmResolutionValue(parsed, latestVersion) : null;
  const needsUpgrade = Boolean(latestVersion && parsed.targetVersion !== latestVersion);

  if (needsUpgrade) {
    notes.push(
      'After updating this resolution, run `yarn install` and the production audit; revert or narrow it if install, audit, or tests fail.'
    );
  }

  return {
    descriptor,
    packageName: parsed.descriptorPackageName,
    currentTarget: value,
    currentTargetPackage: parsed.targetPackageName,
    currentVersion: parsed.targetVersion,
    latestVersion,
    needsUpgrade,
    suggestedPackageJsonValue,
    notes,
  };
}

function buildResolutionUpgradePlan(pkg, options = {}) {
  const latestVersionForPackage = options.getLatestVersion || getLatestVersion;
  const resolutions = pkg.resolutions || {};

  return Object.entries(resolutions)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([descriptor, value]) => buildResolutionPlanItem(descriptor, value, latestVersionForPackage));
}

function readPackageJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read package.json at ${path}: ${error.message}`);
  }
}

function main() {
  const packageJsonPath = resolve(process.cwd(), process.argv[2] || 'package.json');

  try {
    const pkg = readPackageJson(packageJsonPath);
    const resolutions = buildResolutionUpgradePlan(pkg);

    console.log(
      JSON.stringify(
        {
          packageJson: packageJsonPath,
          resolutions,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildResolutionPlanItem,
  buildResolutionUpgradePlan,
  getLatestVersion,
  readPackageJson,
};

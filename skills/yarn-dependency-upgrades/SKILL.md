---
name: yarn-dependency-upgrades
description: "Upgrade dependencies and maintain CVE-focused resolution hygiene in a Yarn 4 Node.js project. Use when asked to upgrade one dependency, multiple dependencies, or all dependencies to latest versions, when asked to remediate CVEs from `yarn-audit-known-issues` produced by `yarn npm audit --recursive --environment production --json`, or when asked to check and remove unnecessary `package.json` `resolutions` after upstream dependency upgrades. Follow this precedence for CVE remediation: (1) upgrade the vulnerable package if it is in package.json `dependencies`, (2) otherwise upgrade a direct parent dependency that pulls in the vulnerable transitive package, (3) otherwise use `yarn set resolution` for the vulnerable descriptor."
---

# Yarn Dependency Upgrades

## Overview
Use deterministic Yarn 4 commands that match `yarn up -i` outcomes while remaining scriptable and repeatable.

Top-level `resolutions` are a CVE-remediation mechanism in this skill. Do not add, keep, or upgrade a `resolution` just to force a newer transitive version. If removing a `resolution` does not cause the production audit command `yarn npm audit --recursive --environment production --json` to report a vulnerability, remove it.

## Preflight
- Run commands from the repository root.
- Confirm Yarn 4 is active: `yarn --version`.
- Confirm the repo manager: `node -p "require('./package.json').packageManager"`.

## Upgrade Scope
- Upgrade one dependency to latest: `yarn up <package>@latest`
- Upgrade multiple dependencies to latest: `yarn up <package-a>@latest <package-b>@latest`
- Preferred: upgrade all direct dependencies and devDependencies to latest using globs:
  - `yarn up '*' '@*/*'`
- Optional: refresh all matching transitive resolutions after the manifest upgrade:
  - `yarn up -R '*' '@*/*'`
- Keep glob patterns quoted (especially in `zsh`) to prevent shell expansion.
- Run interactive mode only when explicitly requested: `yarn up -i <pattern>`

## CVE Workflow
1. Generate the production audit file:
   - `yarn npm audit --recursive --environment production --json > yarn-audit-known-issues`
2. Check for findings:
   - `test -s yarn-audit-known-issues`
3. Create an action plan (helper script in this skill):
   - `node skills/yarn-dependency-upgrades/scripts/cve-upgrade-plan.js yarn-audit-known-issues`
4. Apply fixes in strict precedence order for each vulnerable package:
   - If package exists in top-level `dependencies`: run `yarn up <package>@latest`
   - Else upgrade a direct parent dependency that introduces it: run `yarn up <parent>@latest`
   - Else apply lockfile-level override: `yarn set resolution <descriptor> npm:<version>`
5. Re-run audit after each fix batch and continue until the file is empty.

## Resolution Guidance
- Derive descriptors from `yarn why <package> --json` and use each `descriptor` with `yarn set resolution`.
- Use latest version lookup when creating resolution commands:
  - `yarn npm info <package> --fields version --json`
- Persist overrides in top-level `resolutions` only when the production audit shows they are required to prevent a CVE.
- Do not retain or upgrade `resolutions` for freshness, compatibility, or general policy reasons unless the user explicitly asks for a different policy than this skill's default.

## Resolution Cleanup
1. Create a baseline audit snapshot:
   - `yarn npm audit --recursive --environment production --json > yarn-audit-baseline`
2. Work through `package.json` `resolutions` entries one at a time:
   - Identify current graph context for the resolved package: `yarn why <package> --json`
   - Temporarily remove one `resolutions` entry from `package.json`
   - Re-resolve without the override: `yarn up -R '*' '@*/*'`
   - Re-run audit: `yarn npm audit --recursive --environment production --json > yarn-audit-after`
3. Decide keep/remove for that entry:
   - Keep the entry removed when `yarn-audit-after` stays empty or otherwise does not introduce a vulnerability finding attributable to that package
   - Restore the entry only when removing it causes a production CVE to reappear
4. Repeat until each resolution entry has been tested, then run the CVE workflow again for any remaining findings.

## Verification
Run mandatory repository checks after dependency changes:
- `yarn lint`
- `yarn test:coverage`
- `yarn test:routes`
- `yarn build`

## References
- Use `references/yarn-upgrade-playbook.md` for command variants and troubleshooting.

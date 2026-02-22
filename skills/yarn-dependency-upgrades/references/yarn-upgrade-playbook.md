# Yarn Upgrade Playbook

## Command matrix
- Single package latest: `yarn up <package>@latest`
- Multiple packages latest: `yarn up <package-a>@latest <package-b>@latest`
- Preferred all-direct upgrade (prod + dev): `yarn up '*' '@*/*'`
- Optional transitive refresh after upgrade: `yarn up -R '*' '@*/*'`
- Keep glob patterns quoted to prevent shell expansion.
- Interactive (only when requested): `yarn up -i <pattern>`

## CVE-first flow
1. Generate audit file:
   - `yarn npm audit --recursive --environment production --json > yarn-audit-known-issues`
2. Detect whether findings exist:
   - `test -s yarn-audit-known-issues`
3. Generate remediation plan with skill helper:
   - `node skills/yarn-dependency-upgrades/scripts/cve-upgrade-plan.js yarn-audit-known-issues`
4. Apply commands from the plan in precedence order.
5. Re-run audit and verify no remaining CVEs.

## Direct parent discovery (manual fallback)
- Inspect dependency chain for vulnerable package:
  - `yarn why <package> --json`
- Walk parent packages upward until a package is found in top-level `dependencies`.
- Upgrade that direct parent with `yarn up <parent>@latest`.

## Resolution fallback
- Extract descriptors from `yarn why <package> --json` (field: `descriptor`).
- Look up latest available version:
  - `yarn npm info <package> --fields version --json`
- Apply per descriptor:
  - `yarn set resolution <descriptor> npm:<latest-version>`
- Persist overrides in `package.json` `resolutions` when needed.

## Resolution cleanup flow
1. Capture baseline:
   - `yarn npm audit --recursive --environment production --json > yarn-audit-baseline`
2. For each `package.json` `resolutions` entry (one entry at a time):
   - Inspect dependency context: `yarn why <package> --json`
   - Temporarily remove the resolution entry from `package.json`
   - Re-resolve lockfile without override: `yarn up -R '*' '@*/*'`
   - Re-audit: `yarn npm audit --recursive --environment production --json > yarn-audit-after`
3. Keep the entry removed only when no regression is introduced.
4. Restore the entry if CVEs reappear, then continue to the next resolution.

## Post-upgrade checks
- `yarn lint`
- `yarn test:coverage`
- `yarn test:routes`
- `yarn build`

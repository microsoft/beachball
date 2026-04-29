# Implementation plan: rename `canary` → `prerelease`, simplify ChangeType

This is a working document tracked alongside the implementation. It will be
updated as discoveries are made or decisions change.

## Decisions (open questions resolved)

1. `prereleasePrefix` defaults to `"prerelease"` so `beachball prerelease` works
   with zero configuration.
2. With `identifierBase: false` and the same target version already published,
   `beachball prerelease` errors with a message recommending `identifierBase: '0'`.

## High-level changes

- Rename command `canary` → `prerelease`. No alias for `canary`.
- Remove `canaryName` option. `prereleasePrefix` takes over its role (the
  suffix used by the prerelease command, e.g. `"beta"`, `"canary"`, `"pr30"`).
- `prereleasePrefix` no longer affects `bump`/`publish`.
- Shrink `ChangeType` to `'patch' | 'minor' | 'major' | 'none'`.
- Migration: change files / CLI types `premajor|preminor|prepatch` are coerced
  to `major|minor|patch` with a warning; `prerelease` is a hard error.
- `publish` strips an existing prerelease component from `package.json#version`
  before applying the change file's bump (assumption E).
- New `getPrereleaseVersion(...)` helper; `beachball prerelease` queries
  `listPackageVersions` for the highest existing counter.

## Checklist

- [ ] Explore the codebase to confirm exact file shapes/locations
- [ ] Update `ChangeType` in `src/types/ChangeInfo.ts`
- [ ] Migration logic for old types in `src/changefile/readChangeFiles.ts`
      (warn + coerce `pre*`, error on `prerelease`)
- [ ] CLI `--type` validation in `src/changefile/getPackageChangeTypes.ts`
      (or wherever `--type` is parsed) — same coercion + error
- [ ] `bumpPackageInfoVersion`: drop `prereleasePrefix`/`identifierBase` params,
      strip prerelease component before `semver.inc` (handles assumption E)
- [ ] New `src/bump/getPrereleaseVersion.ts` pure helper + unit tests
- [ ] Rename `src/commands/canary.ts` → `src/commands/prerelease.ts`; rewrite
      to use `listPackageVersions` + `getPrereleaseVersion`
- [ ] `src/cli.ts`: replace `canary` case with `prerelease`
- [ ] `src/types/BeachballOptions.ts`: drop `canaryName`; `command` includes
      `prerelease` (and not `canary`)
- [ ] `src/options/getCliOptions.ts`: drop `canaryName`; derive `tag` from
      `prereleasePrefix` for the `prerelease` command
- [ ] `src/options/getDefaultOptions.ts`: default `prereleasePrefix: 'prerelease'`,
      drop `canaryName` default
- [ ] `src/commands/configGet.ts`: drop `canaryName: true`
- [ ] `src/help.ts`: replace `--canary-name` docs with `prerelease` section;
      remove `--prerelease-prefix` from `bump`/`publish` sections
- [ ] `src/changefile/getQuestionsForPackage.ts`: drop "Prerelease" choice
- [ ] Changelog rendering: drop `pre*`/`prerelease` `groupNames` entries; prune snapshots
- [ ] Tests: update/remove canary references; add new tests per plan
- [ ] Docs: rename `docs/cli/canary.md` → `docs/cli/prerelease.md`; update
      sidebar; update `bump`/`publish` pages; update `configuration.md`,
      `change-types.md`; sentence-case headings; build with `yarn docs:build`
- [ ] Generate Beachball change file (major) via `/beachball-change-files`
- [ ] Run `yarn build`, `yarn test`, `yarn lint`, `yarn format`
- [ ] `parallel_validation`

## Notes/discoveries

(to be filled in as work progresses)

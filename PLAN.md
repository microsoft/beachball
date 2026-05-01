# Implementation plan: rename `canary` → `prerelease`, simplify ChangeType

This document tracked the plan as it was implemented.

## Decisions (open questions resolved)

1. `prereleasePrefix` defaults to `"prerelease"` (applied in the `prerelease`
   command itself rather than in `getDefaultOptions`, to keep `configList`
   output minimal). So `beachball prerelease` works with zero configuration.
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
- `bump`/`publish` strip an existing prerelease component from
  `package.json#version` before applying the change file's bump (assumption E).
- New `getPrereleaseVersion(...)` pure helper; `beachball prerelease` queries
  `listPackageVersions` for the highest existing counter.

## Checklist

- [x] Update `ChangeType` in `src/types/ChangeInfo.ts`
- [x] Migration logic for old types in `src/changefile/readChangeFiles.ts`
      (warn + coerce `pre*`, error on `prerelease`); also handles
      `dependentChangeType`
- [x] CLI `--type` and `--dependent-change-type` migration in
      `src/options/getCliOptions.ts` (same coercion + error)
- [x] `bumpPackageInfoVersion`: drop `prereleasePrefix`/`identifierBase` params,
      strip prerelease component before `semver.inc` (handles assumption E)
- [x] New `src/bump/getPrereleaseVersion.ts` pure helper + unit tests
- [x] Rename `src/commands/canary.ts` → `src/commands/prerelease.ts`; rewrite
      to use `listPackageVersions` + `getPrereleaseVersion`
- [x] `src/cli.ts`: replace `canary` case with `prerelease`
- [x] `src/types/BeachballOptions.ts`: drop `canaryName`
- [x] `src/options/getCliOptions.ts`: drop `canaryName`; derive `tag` from
      `prereleasePrefix` for the `prerelease` command
- [x] `src/options/getDefaultOptions.ts`: drop `canaryName` default (default
      for `prereleasePrefix` is applied at command level, not here)
- [x] `src/commands/configGet.ts`: drop `canaryName: true`
- [x] `src/help.ts`: replace `--canary-name` docs with `prerelease` section;
      remove `--prerelease-prefix` from `bump`/`publish` sections
- [x] `src/changefile/getQuestionsForPackage.ts`: drop "Prerelease" choice
- [x] Changelog rendering: drop `pre*`/`prerelease` `groupNames` entries;
      prune snapshot
- [x] Update existing tests (configList snapshot, getCliOptions, bumpInMemory,
      bumpPackageInfoVersion, changeTypes, getQuestionsForPackage,
      updateRelatedChangeType, writeChangelog, e2e bump)
- [x] Add new tests: - `__tests__/bump/getPrereleaseVersion.test.ts` - `__functional__/commands/prerelease.test.ts` - migration tests in `__functional__/changefile/readChangeFiles.test.ts` - legacy `--type` / `--dependent-change-type` tests in
      `__functional__/options/getCliOptions.test.ts`
- [x] Docs: create `docs/cli/prerelease.md`; add to sidebar in
      `docs/.vuepress/config.ts`; remove `--prerelease-prefix` rows from
      `docs/cli/bump.md` and `docs/cli/publish.md`; rewrite the
      `prereleasePrefix` row in `docs/overview/configuration.md`; add
      "Prereleases" section to `docs/concepts/change-types.md`. Built with
      `yarn docs:build`.
- [x] Generate Beachball change file (major)
- [x] Run `yarn build`, `yarn test`, `yarn lint`
- [ ] `parallel_validation`

## Notes/discoveries

- The single repo fixture has only the package `foo`; tests use that name.
- `createCommandContext` is `@deprecated` and triggers `etc/no-deprecated`;
  command implementations and their tests use
  `// eslint-disable-next-line etc/no-deprecated -- ...` to suppress.
- `cliOptions.command === 'prerelease'` overrides `--tag`, mirroring previous
  canary behavior. `--prerelease-prefix` outside of the `prerelease` command
  does NOT affect tag.
- `bumpInMemory.test.ts` previously had four `prereleasePrefix`-driven
  scenarios; all are removed since `bump` no longer produces prereleases.
  Replaced with a focused test for prerelease → release promotion.
- `updateRelatedChangeType` tests previously expected `preminor` as a fallback
  when `minor` was disallowed; with pre\* types removed, the algorithm now
  falls back to `patch` instead.
- `writeChangelog` "includes pre\* changes" tests are obsolete; replaced with
  one test exercising `major`/`minor`/`patch` headers.

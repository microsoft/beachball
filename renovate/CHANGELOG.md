# @microsoft/m365-renovate-config

<!-- Start content -->

## 3.0.0

July 21, 2026

Version 3 is the migration from `microsoft/m365-renovate-config` into this repo. There are a few breaking changes.

### Preset reference format

The `extends` reference format has changed due to nested subfolders:

```jsonc
// before
"github>microsoft/m365-renovate-config",
"github>microsoft/m365-renovate-config:foo",
// after
"github>microsoft/beachball//renovate/presets/default",
"github>microsoft/beachball//renovate/presets/foo",
```

Note that **pinning to a ref/tag won't work** if the preset `extends` any other local presets, since those would be pulled from `main` by default. That was done in the `m365-renovate-config` repo and could be brought back if necessary, but it requires an extra branch and [several extra steps](https://github.com/microsoft/m365-renovate-config/blob/main/scripts/release/bumpAndRelease.ts#L125) to update all references and create a corresponding commit (please open an issue if interested).

### Removed presets

The following presets have been removed:

- `automergeDevLock`, `automergeTypes` - manually set auto-merge instead
- `beachballPostUpgrade` - merged with `beachball`
- `groupFixtureUpdates` - minimally useful
- `minorDependencyUpdates` - didn't work as desired (it's better to go understand Renovate's [`rangeStrategy`](https://docs.renovatebot.com/configuration-options/#rangestrategy) for yourself and pick what you want)
- `newConfigWarningIssue` - included in `default`
- `pinActions` - included in `default` via `helpers:pinGitHubActionDigests`

### Updated behavior

- [`default`](#default) includes `docker:pinDigests`, `helpers:pinGitHubActionDigests`, and `configMigration`
- [`beachball`](#beachball) includes the old `beachballPostUpgrade` behavior directly (use `default` if you don't want that)
- [`groupFluent`](#groupfluent): outdated Fluent-family packages were removed

## 2.8.4

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.8.3...v2.8.4) - July 20, 2026 at 4:52 PM PDT

### Patch Changes

- [#292](https://github.com/microsoft/m365-renovate-config/pull/292) [`f46e7e0`](https://github.com/microsoft/m365-renovate-config/commit/f46e7e0099706071ac98bb0514ba278f7a282473) - Update default minimumReleaseAge to 7d for npm, 3d for others (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.8.3

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.8.2...v2.8.3) - April 24, 2026 at 8:46 PM PDT

### Patch Changes

- [#281](https://github.com/microsoft/m365-renovate-config/pull/281) [`7b26096`](https://github.com/microsoft/m365-renovate-config/commit/7b2609679ec0bcac6a8df969d446cd1fff8301fa) - Prevent accidental node updates lumped with github actions updates (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.8.2

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.8.1...v2.8.2) - April 8, 2026 at 7:30 PM PDT

### Patch Changes

- [#277](https://github.com/microsoft/m365-renovate-config/pull/277) [`ad5a08e`](https://github.com/microsoft/m365-renovate-config/commit/ad5a08e8bad86c9e4d2714c5c7217adc2f4c9371) - Add github/codeql-action to scheduleNoisy (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.8.1

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.8.0...v2.8.1) - January 24, 2026 at 12:27 AM PST

### Patch Changes

- [#255](https://github.com/microsoft/m365-renovate-config/pull/255) [`cd06d25`](https://github.com/microsoft/m365-renovate-config/commit/cd06d255fb79ba07e338a73fc0c17367948db2a1) - Add groupActions to groupMore (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.8.0

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.7.6...v2.8.0) - January 24, 2026 at 12:15 AM PST

### Minor Changes

- [#254](https://github.com/microsoft/m365-renovate-config/pull/254) [`c8bbbd6`](https://github.com/microsoft/m365-renovate-config/commit/c8bbbd6c4c5777253dbc34c68359caae77ff690e) - Add groupActions to group official github actions (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.7.6

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.7.5...v2.7.6) - September 22, 2025 at 12:30 PM PDT

### Patch Changes

- [#230](https://github.com/microsoft/m365-renovate-config/pull/230) [`899bbeb`](https://github.com/microsoft/m365-renovate-config/commit/899bbeba64ec7f1eed918078742227ea71aa4801) - Wait 3 days to pick up new releases (note this doesn't apply to implicit dep updates in lock file) (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.7.5

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.7.4...v2.7.5) - April 14, 2025 at 11:19 AM PDT

### Patch Changes

- [#206](https://github.com/microsoft/m365-renovate-config/pull/206) [`125fafd`](https://github.com/microsoft/m365-renovate-config/commit/125fafd4754bb0050da11a6ea6d50191b8b6f67a) - Fix method for only using beachball post-upgrade with npm (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.7.4

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.7.3...v2.7.4) - April 4, 2025 at 12:03 PM PDT

### Patch Changes

- [#202](https://github.com/microsoft/m365-renovate-config/pull/202) [`181aa5a`](https://github.com/microsoft/m365-renovate-config/commit/181aa5a07a7a0962472e1032a67bced06ec80457) - Only run beachball post-upgrade tasks on package.json changes (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.7.3

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.7.2...v2.7.3) - March 27, 2025 at 12:30 PM PDT

### Patch Changes

- [#199](https://github.com/microsoft/m365-renovate-config/pull/199) [`7e52af4`](https://github.com/microsoft/m365-renovate-config/commit/7e52af47f9ddee34b02059143fe2f40bdc2c47df) - Really fix the pin actions message (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.7.2

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.7.1...v2.7.2) - March 27, 2025 at 11:34 AM PDT

### Patch Changes

- [#196](https://github.com/microsoft/m365-renovate-config/pull/196) [`a53dcdb`](https://github.com/microsoft/m365-renovate-config/commit/a53dcdb88b684db7a3d2ae62cca83b917b876806) - Try again with pinActions message... (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.7.1

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.7.0...v2.7.1) - March 27, 2025 at 11:29 AM PDT

### Patch Changes

- [#194](https://github.com/microsoft/m365-renovate-config/pull/194) [`ded6ec4`](https://github.com/microsoft/m365-renovate-config/commit/ded6ec4ad3f9f9ff04de1edcc85a182daec34e66) - Fix pinActions (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.7.0

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.6.1...v2.7.0) - March 27, 2025 at 11:05 AM PDT

### Minor Changes

- [#192](https://github.com/microsoft/m365-renovate-config/pull/192) [`c202612`](https://github.com/microsoft/m365-renovate-config/commit/c202612ccb8c2afb83bf46ef6072526b8905320c) - Pin actions to specific commits by default (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.6.1

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.6.0...v2.6.1) - November 19, 2024 at 5:37 PM PST

### Patch Changes

- [#180](https://github.com/microsoft/m365-renovate-config/pull/180) [`acb126b`](https://github.com/microsoft/m365-renovate-config/commit/acb126b3b1964ae50a20c35cc8328729b21bedbe) - Lock file maintenance (Thanks [@renovate](https://github.com/apps/renovate)!)

## 2.6.0

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.5.0...v2.6.0) - August 22, 2024 at 9:55 PM PDT

### Minor Changes

- [#178](https://github.com/microsoft/m365-renovate-config/pull/178) [`ee3ecd0`](https://github.com/microsoft/m365-renovate-config/commit/ee3ecd054ba6aa03704ecd912e34adef017702fc) - Migrate configs for Renovate v38 (Thanks [@renovate](https://github.com/apps/renovate)!)

## 2.5.0

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.4.0...v2.5.0) - February 27, 2024 at 2:16 PM PST

### Minor Changes

- [`30d65c3`](https://github.com/microsoft/m365-renovate-config/commit/30d65c339391f09e57a79937f03d91dd76a7516d) - Disable minorDependencyUpdates by default and set rangeStrategy to "replace" for all npm dependencies (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.4.0

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.3.1...v2.4.0) - December 28, 2023 at 12:38 PM PST

### Minor Changes

- [`cfc530c`](https://github.com/microsoft/m365-renovate-config/commit/cfc530c4a83f81ef8f97c2fff2ff2297f1fe7d32) - groupEslint: don't group typescript-eslint with other eslint packages (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.3.1

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.3.0...v2.3.1) - October 18, 2023 at 3:43 PM PDT

### Patch Changes

- [`157ab35`](https://github.com/microsoft/m365-renovate-config/commit/157ab35575c16156fbd10aaf742a387799d70e51) - disableEsmVersions: add strip-ansi (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.3.0

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.2.1...v2.3.0) - September 11, 2023 at 4:46 PM PDT

### Minor Changes

- [#138](https://github.com/microsoft/m365-renovate-config/pull/138) [`280a87d`](https://github.com/microsoft/m365-renovate-config/commit/280a87d5b18d6b0a1f8e8aa13abb424a8957b702) - `keepFresh`: Reduce noise from unnecessary lock file-only dep updates (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

- [#138](https://github.com/microsoft/m365-renovate-config/pull/138) [`280a87d`](https://github.com/microsoft/m365-renovate-config/commit/280a87d5b18d6b0a1f8e8aa13abb424a8957b702) - `restrictNode`: enable `constraintsFiltering` to prevent installing deps with incompatible `engines.node` (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

### Patch Changes

- [#138](https://github.com/microsoft/m365-renovate-config/pull/138) [`280a87d`](https://github.com/microsoft/m365-renovate-config/commit/280a87d5b18d6b0a1f8e8aa13abb424a8957b702) - Restrict npm package-specific presets to only apply to npm deps (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.2.1

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.2.0...v2.2.1) - May 2, 2023, 6:18 PM PDT

### Patch Changes

- [`c61116a`](https://github.com/microsoft/m365-renovate-config/commit/c61116a1c90201a7cfba03aa51757c1e17b54329) - groupJest: include more packages and disable related built-in presets (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.2.0

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.1.0...v2.2.0) - May 2, 2023, 6:03 PM PDT

### Minor Changes

- [`10807ea`](https://github.com/microsoft/m365-renovate-config/commit/10807ea632787854e5fd30cf7c9a8d09292e18c0) - Remove `rangeStrategy: "bump"` for dependencies from default preset. This is more similar to the v1 behavior. (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.1.0

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.0.2...v2.1.0) - May 2, 2023, 3:36 PM PDT

### Minor Changes

- [`3384bbe`](https://github.com/microsoft/m365-renovate-config/commit/3384bbefebd5d9429a9cbe35b05ecae8fe874f99) - Add groupLageBackfill preset (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

### Patch Changes

- [`a54b42d`](https://github.com/microsoft/m365-renovate-config/commit/a54b42d8a28f75215eb7c93f6af499484553b344) - dependencyDashboardMajor: correctly specify 0.x versions (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.0.2

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.0.1...v2.0.2) - May 1, 2023, 8:46 PM PDT

### Patch Changes

- [`5f11999`](https://github.com/microsoft/m365-renovate-config/commit/5f11999564f3f372d20beca930d1c40415b99548) - **default**: Use "bump" instead of "replace" for `dependencies` (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.0.1

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v2.0.0...v2.0.1) - May 1, 2023, 8:33 PM PDT

### Patch Changes

- [`f6f77e3`](https://github.com/microsoft/m365-renovate-config/commit/f6f77e35fdf8b44fb1755ef47f91443c42eefc8d) - keepFresh: For lockFileMaintenance, rebase when behind the base branch (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 2.0.0

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v1.8.13...v2.0.0) - May 1, 2023, 3:44 PM PDT

### Major Changes

`m365-renovate-config` version 2 ([`9a9f133`](https://github.com/microsoft/m365-renovate-config/commit/9a9f133120e810860e8c1c26f361e9a157395adb)) makes the default preset a bit more opinionated based on testing, streamlines preset naming, and updates settings to better reflect recent improvements in Renovate.

**These changes have been picked up automatically** unless you specified a ref (e.g. `#v1`) as part of the preset names in your `extends` config.

Note: `<m365>` in preset names referenced below is a shorthand for `github>microsoft/m365-renovate-config`. This is just for readability of the readme and will _**not**_ work in actual configs (you must use the full repo prefix).

#### Default preset changes

The default preset (`github>microsoft/m365-renovate-config`) is now a bit more "opinionated" and includes the settings that were previously defined in `<m365>:libraryRecommended`. These settings can be disabled either individually or using the `excludePresets` option.

The dependency version update strategy (`rangeStrategy`) has also changed as described below.

#### Major preset changes and deprecations

Deprecated presets still exist for now to avoid immediate breaks in consuming repos, but will be removed in version 3.

- `<m365>:libraryRecommended` is deprecated in favor of this repo's default preset.
- `<m365>:beachballLibraryRecommended` is renamed to `<m365>:beachball`.

#### Dependency version update strategy

Previously, Renovate's `config:base` would pin `devDependencies` and possibly also `dependencies` to exact versions. Pinning `dependencies` is not desirable for libraries, so `v1` of `m365-renovate-config` omitted any pinning behavior in its default preset, and enabled pinning _only_ `devDependencies` in its `<m365>:libraryRecommended` preset.

A [recent Renovate update](https://docs.renovatebot.com/release-notes-for-major-versions/#version-35) included greatly expanded support for doing in-range updates (e.g. updating the installed version for `"foo": "^1.0.0"` from `1.1.0` to `1.2.0`) by changing only the lockfile. Therefore, Renovate's default [`rangeStrategy: "auto"`](https://docs.renovatebot.com/configuration-options/#rangestrategy) was changed to do lockfile-only updates when possible (instead of pinning or replacing versions), and `config:base` no longer includes any pinning of versions.

Since the lockfile-only updates are likely a good strategy for `devDependencies` in most repos, `m365-renovate-config`'s default preset (which supersedes `<m365>:libraryRecommended`) has been updated as follows:

- Use `rangeStrategy: "replace"` for `dependencies` (production) to reduce the chance of breaks for library consumers.
- Remove overrides (use `rangeStrategy: "auto"`) for other dependency types.

To restore the previous behavior of `<m365>:libraryRecommended`, extend the Renovate preset [`:pinOnlyDevDependencies`](https://docs.renovatebot.com/presets-default/#pinonlydevdependencies).

## 1.8.13

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v1.8.12...v1.8.13) - April 28, 2023, 4:07 PM PDT

### Patch Changes

- [`077edb3`](https://github.com/microsoft/m365-renovate-config/commit/077edb3d8a35f9fa0405b29328dfbec9adc01873) - Testing new release setup (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 1.8.12

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v1.8.11...v1.8.12) - April 27, 2023 at 9:17 PM GMT-7

### Patch Changes

- [`0a8f68e`](https://github.com/microsoft/m365-renovate-config/commit/0a8f68ef2fa4266598622aacfaecc854b37bc550) - More release updates (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 1.8.11

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v1.8.10...v1.8.11) - April 27, 2023 at 8:53 PM GMT-7

### Patch Changes

- [`433d88d`](https://github.com/microsoft/m365-renovate-config/commit/433d88d8e56b7980351fa6172d37946ee04efd3c) - More changelog fixes (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 1.8.10

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v1.8.9...v1.8.10) - April 27, 2023 at 8:42 PM GMT-7

### Patch Changes

- [`674a4ca`](https://github.com/microsoft/m365-renovate-config/commit/674a4ca31f32339ffde8596a86d3c497f14bfd8a) - Changeset fixes (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 1.8.9

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v1.8.8...v1.8.9) - April 27, 2023 at 8:38 PM GMT-7

### Patch Changes

- [`c33c229`](https://github.com/microsoft/m365-renovate-config/commit/c33c2292d8321ab27602d9a2301255870ad4af97) - Release using changesets (Thanks [@ecraig12345](https://github.com/ecraig12345)!)

## 1.8.8

[Compare source](https://github.com/microsoft/m365-renovate-config/compare/v1.8.7...v1.8.8) (2023-04-19)

### Bug Fixes

- include more dep types in groupFixtures ([ec07661](https://github.com/microsoft/m365-renovate-config/commit/ec07661b7759006165acef982b9cef2182c52fbc))

## [1.8.7](https://github.com/microsoft/m365-renovate-config/compare/v1.8.6...v1.8.7) (2023-04-13)

### Bug Fixes

- remove renovate from scheduleNoisy ([198e004](https://github.com/microsoft/m365-renovate-config/commit/198e00442ecf1ae4a7ca812b04ebd93d896ddf40))

## [1.8.6](https://github.com/microsoft/m365-renovate-config/compare/v1.8.5...v1.8.6) (2023-03-10)

### Bug Fixes

- Reduce scheduled update frequency ([a99d3d9](https://github.com/microsoft/m365-renovate-config/commit/a99d3d92c939cca155ee553ef55523a24549bea0))
- use valid schedules ([2bd4e18](https://github.com/microsoft/m365-renovate-config/commit/2bd4e18dab011d4116956ff199213c946b841ceb))

## [1.8.5](https://github.com/microsoft/m365-renovate-config/compare/v1.8.4...v1.8.5) (2023-02-21)

### Bug Fixes

- schedule eslint-related updates ([#51](https://github.com/microsoft/m365-renovate-config/issues/51)) ([410f3d5](https://github.com/microsoft/m365-renovate-config/commit/410f3d548c8b1224e9aa5bfe408f4b56f5a52406))

## [1.8.4](https://github.com/microsoft/m365-renovate-config/compare/v1.8.3...v1.8.4) (2022-09-21)

### Bug Fixes

- add `@microsoft/api-extractor` to noisy packages rule ([99ac22c](https://github.com/microsoft/m365-renovate-config/commit/99ac22c68d0843c4275f3eff98f9a284d1699354))

## [1.8.3](https://github.com/microsoft/m365-renovate-config/compare/v1.8.2...v1.8.3) (2022-09-16)

### Bug Fixes

- **disableEsmVersions:** add ansi-regex ([9e8c1f4](https://github.com/microsoft/m365-renovate-config/commit/9e8c1f4a89ff0704b62d52c37587ce6d71e108dd))

## [1.8.2](https://github.com/microsoft/m365-renovate-config/compare/v1.8.1...v1.8.2) (2022-09-13)

### Bug Fixes

- **default:** run schedules relative to pacific time ([89616d0](https://github.com/microsoft/m365-renovate-config/commit/89616d0d9e7071dd2e8d83a4f36361c4831483ee))

## [1.8.1](https://github.com/microsoft/m365-renovate-config/compare/v1.8.0...v1.8.1) (2022-09-13)

### Bug Fixes

- **groupTypes:** only run in early morning ([3e59a57](https://github.com/microsoft/m365-renovate-config/commit/3e59a57766ca3b6b222e2b04d2bbe3926062a3ca))

# [1.8.0](https://github.com/microsoft/m365-renovate-config/compare/v1.7.3...v1.8.0) (2022-09-12)

### Features

- add groupD3 ([bf79e31](https://github.com/microsoft/m365-renovate-config/commit/bf79e31cf37d635cbce129fb2eda834cbfe4a0fc))

## [1.7.3](https://github.com/microsoft/m365-renovate-config/compare/v1.7.2...v1.7.3) (2022-09-12)

### Bug Fixes

- **disableEsmVersions:** add pretty-bytes ([ccbc878](https://github.com/microsoft/m365-renovate-config/commit/ccbc8785f305c26353433749cf4d184eba07f5f3))

## [1.7.2](https://github.com/microsoft/m365-renovate-config/compare/v1.7.1...v1.7.2) (2022-09-10)

### Bug Fixes

- **groupNodeMajor:** remove broken engines rule ([5875670](https://github.com/microsoft/m365-renovate-config/commit/58756708c475084ae342ebf8fa61a03dca3a5712))

## [1.7.1](https://github.com/microsoft/m365-renovate-config/compare/v1.7.0...v1.7.1) (2022-09-10)

### Bug Fixes

- **disableEsmVersions:** add supports-color ([39cfa94](https://github.com/microsoft/m365-renovate-config/commit/39cfa94cb92e59aa96385009dba8f6f0e58c993f))
- **groupNodeMajor:** bump node version in engines ([f22bee7](https://github.com/microsoft/m365-renovate-config/commit/f22bee72c017dc9853ed6924a58ee17f0efbaef7))

# [1.7.0](https://github.com/microsoft/m365-renovate-config/compare/v1.6.0...v1.7.0) (2022-09-09)

### Bug Fixes

- **restrictNode:** add more ways of specifying node version ([5f138e8](https://github.com/microsoft/m365-renovate-config/commit/5f138e88b93a432c126b1706c5e86bdb8beb90e8))

### Features

- add groupNodeMajor ([92a8bdc](https://github.com/microsoft/m365-renovate-config/commit/92a8bdce1826d75cbe1e99865651d4558e33b4db))

# [1.6.0](https://github.com/microsoft/m365-renovate-config/compare/v1.5.0...v1.6.0) (2022-09-09)

### Features

- add disableEsmVersions ([bfbe09f](https://github.com/microsoft/m365-renovate-config/commit/bfbe09f06da192f7c89a56ada6c6faeb1fa728f3))

# [1.5.0](https://github.com/microsoft/m365-renovate-config/compare/v1.4.2...v1.5.0) (2022-09-09)

### Bug Fixes

- add groupYargs file ([8ff7423](https://github.com/microsoft/m365-renovate-config/commit/8ff7423055aecbfdc91e574e3c38a3437a99ad33))

### Features

- add groupYargs ([9eb24ec](https://github.com/microsoft/m365-renovate-config/commit/9eb24ec24cc13fa223ec58a0f0695441b67628a0))

## [1.4.2](https://github.com/microsoft/m365-renovate-config/compare/v1.4.1...v1.4.2) (2022-09-09)

### Bug Fixes

- clarify groupTypes group name ([5384f40](https://github.com/microsoft/m365-renovate-config/commit/5384f40bf6d0b6f6053ecb258a3e02707b149dc2))
- exclude other grouped packages from groupTypes ([41efe17](https://github.com/microsoft/m365-renovate-config/commit/41efe175c1ef8923ff00a8e8e317120a872624f7))

## [1.4.1](https://github.com/microsoft/m365-renovate-config/compare/v1.4.0...v1.4.1) (2022-09-09)

### Bug Fixes

- exclude 0.x from groupTypes ([f0f3a1b](https://github.com/microsoft/m365-renovate-config/commit/f0f3a1b5fc2a8d7b37650834a965edd970d10a06))

# [1.4.0](https://github.com/microsoft/m365-renovate-config/compare/v1.3.0...v1.4.0) (2022-09-09)

### Features

- add restrictNode ([538ba0c](https://github.com/microsoft/m365-renovate-config/commit/538ba0c423590cf9b8ac4679381e0aad75df8937))

# [1.3.0](https://github.com/microsoft/m365-renovate-config/compare/v1.2.0...v1.3.0) (2022-09-09)

### Features

- add groupTypes ([f1eba61](https://github.com/microsoft/m365-renovate-config/commit/f1eba6144a28d0620d455b10164fef26c746e652))

# [1.2.0](https://github.com/microsoft/m365-renovate-config/compare/v1.1.0...v1.2.0) (2022-09-06)

### Features

- add beachballLibraryVerbose ([12fa211](https://github.com/microsoft/m365-renovate-config/commit/12fa2111e7ced8fb7bb6431d737b76c147c2906e))

# [1.1.0](https://github.com/microsoft/m365-renovate-config/compare/v1.0.4...v1.1.0) (2022-09-01)

### Bug Fixes

- **keepFresh:** remove unnecessary updateNotScheduled setting ([480d161](https://github.com/microsoft/m365-renovate-config/commit/480d161a68a1d07cca8997c2ab0089f55a35c175))

### Features

- add scheduleNoisy preset ([f880ddb](https://github.com/microsoft/m365-renovate-config/commit/f880ddbd965f9b304cbf91939408c12b4f71fbae))

## [1.0.4](https://github.com/microsoft/m365-renovate-config/compare/v1.0.3...v1.0.4) (2022-09-01)

### Bug Fixes

- **keepFresh:** allow wider schedule for lock file updates ([22c4317](https://github.com/microsoft/m365-renovate-config/commit/22c4317c0a9dcb0e07d32b098c798c2dee8e68cf))

## [1.0.3](https://github.com/microsoft/m365-renovate-config/compare/v1.0.2...v1.0.3) (2022-09-01)

### Bug Fixes

- use correct option name yarnDedupeFewer in keepFresh ([03fdab8](https://github.com/microsoft/m365-renovate-config/commit/03fdab8cb9e89b4692930f543863f83c81a9b767))

## [1.0.2](https://github.com/microsoft/m365-renovate-config/compare/v1.0.1...v1.0.2) (2022-09-01)

### Bug Fixes

- update keepFresh to use yarnDedupeFewest ([a166eef](https://github.com/microsoft/m365-renovate-config/commit/a166eeffd6f935c7daddb29ee4e7ec87268ef5e5))

## [1.0.1](https://github.com/microsoft/m365-renovate-config/compare/v1.0.0...v1.0.1) (2022-08-25)

### Bug Fixes

- update react monorepo config to extend default group ([139741f](https://github.com/microsoft/m365-renovate-config/commit/139741ff745005d68bc851569498a58e9fbc1a6b))

# 1.0.0 (2022-08-18)

### Features

- Add config and build files ([3c698d3](https://github.com/microsoft/m365-renovate-config/commit/3c698d3d19de488809c631e9057d024ebec87e88))

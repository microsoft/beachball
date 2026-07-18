# yarn-plugins

Yarn plugins related to dependency installation and management, intended for consumption by other repos.

## Plugins

### [`engines`](./engines) (`yarn-plugin-engines`)

Enforce the `engines.node` requirement from the repo-root `package.json` across the dependencies of published packages.

### [`npmrc`](./npmrc) (`yarn-plugin-npmrc`)

Use registry authentication settings from `.npmrc` instead of `.yarnrc.yml`.

## Building

Each plugin has two build steps, wired into lage's `build` → `bundle` pipeline:

- `build` — standard `tsc` type-check (no emit).
- `bundle` — [`scripts/bundleYarnPlugin.ts`](../scripts/bundleYarnPlugin.ts) uses esbuild to produce the single-file plugin bundles in `dist/`:
  - `dist/plugin.js` — minified (loaded by `.yarnrc.yml`).
  - `dist/plugin.dev.js` — unminified, for debugging.

The `dist/` bundles are **checked into git**. Run `yarn build` from the repo root and commit any changes to `yarn-plugins/*/dist/` after modifying plugin source. Bundle size limits are enforced in `bundleYarnPlugin.ts`.

Because `.yarnrc.yml` loads the built `dist/plugin.js` bundles, a broken or missing bundle can make `yarn` commands fail to start. If that happens, temporarily comment out the local plugins in `.yarnrc.yml` and run `yarn build` to regenerate them.

## Testing

The plugins are referenced by `../.yarnrc.yml` as a very basic E2E test, and may also have their own tests.

## npmrc patch

`npmrc` depends on a patched `@npmcli/config` (patch file in [`.yarn/patches`](../.yarn/patches)). The vendored patch source lives in [`./yarn/patches-source`](../.yarn/patches-source) for regeneration. See [`npmrc` readme](./npmrc/README.md) for details.

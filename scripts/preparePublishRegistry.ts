//
// This script MUST NOT USE EXTERNAL DEPENDENCIES!
// It's run before `yarn install` in .ado/publish.yml to use a private registry for compliance.
//

import fs from 'fs';
import path from 'path';

const defaultRepoRoot = path.dirname(import.meta.dirname);

const defaultRegistries = {
  npm: 'https://registry.npmjs.org/',
  // In rare cases, this could point to the npm registry - when copying the hook, update if needed
  yarn1: 'https://registry.yarnpkg.com/',
};

/** Find the registry URL in `.npmrc.publish` under `repoRoot`. */
export function getPublishRegistry(repoRoot: string = defaultRepoRoot): string | undefined {
  return fs
    .readFileSync(path.join(repoRoot, '.npmrc.publish'), 'utf-8')
    .split(/\r?\n/g)
    .find((line: string) => line.startsWith('registry='))
    ?.replace(/^registry="?([^"]+).*/, '$1');
}

/**
 * yarn berry (v2+) resolves packages relative to `npmRegistryServer` in `.yarnrc.yml` rather than
 * from URLs in the lock file, so add that setting and enable `yarn-plugin-npmrc` to read `.npmrc`
 * (reusing `.npmrc` for auth makes things simpler with other tools).
 */
function updateYarnrcYml(yarnrcPath: string, registry: string): void {
  const yarnrcUpdates = `
npmRegistryServer: "${registry}"
npmAlwaysAuth: true
npmrcAuthEnabled: true
`;
  console.log(`Updating ${yarnrcPath} with private registry settings:\n${yarnrcUpdates}`);
  const yarnrcContent = fs.readFileSync(yarnrcPath, 'utf-8');
  fs.writeFileSync(yarnrcPath, `${yarnrcContent}\n${yarnrcUpdates}`, 'utf-8');
}

/**
 * Update public registry URLs saved in yarn v1 or npm lock files to point to a private registry.
 *
 * Not included:
 * - yarn berry's `yarn.lock` doesn't store absolute URLs
 * - pnpm's `pnpm-lock.yaml` omits tarball URLs for the default registry (it reconstructs them from
 *   the `.npmrc` registry at install time), and only stores absolute URLs for non-default
 *   registries, which this replacement wouldn't match anyway. So pnpm relies on the `.npmrc` copy.
 *   This is safe with `pnpm install --frozen-lockfile`: pnpm resolves packages by their `integrity`
 *   hash rather than the registry host, so pointing `.npmrc` at the private feed installs from there
 *   without modifying the lock file.
 */
export function updateLockFileRegistry(params: {
  manager: 'yarn1' | 'npm';
  registry: string;
  /** Root directory with the lock file */
  cwd: string;
  /** If true, revert from `registry` to the default registry. Otherwise apply `registry` to the lock file. */
  revert?: boolean;
}): void {
  const { manager, registry, cwd, revert } = params;
  const lockFilePath = path.join(cwd, manager === 'yarn1' ? 'yarn.lock' : 'package-lock.json');
  if (!fs.existsSync(lockFilePath)) {
    return;
  }

  const content = fs.readFileSync(lockFilePath, 'utf-8');
  const updated = revert
    ? content.replaceAll(registry, defaultRegistries[manager])
    : content.replaceAll(defaultRegistries[manager], registry);
  if (updated !== content) {
    console.log(`${revert ? 'Reverting' : 'Updating'} registry URLs in ${lockFilePath}`);
    fs.writeFileSync(lockFilePath, updated, 'utf-8');
  }
}

/**
 * Configure the private registry from `.npmrc.publish` for whichever package manager the repo uses:
 * copy it to `.npmrc`, update `.yarnrc.yml` (yarn berry), and rewrite lock file URLs (npm/yarn v1).
 * @param repoRoot The repo root containing `.npmrc.publish`.
 * @returns The private registry URL, or `undefined` if none was found in `.npmrc.publish`.
 */
export function preparePublishRegistry(repoRoot: string = defaultRepoRoot): string | undefined {
  const registry = getPublishRegistry(repoRoot);
  if (!registry) {
    return undefined;
  }

  // Copy the .npmrc.publish to .npmrc so the private registry is used for install and auth.
  // (npm, pnpm, yarn v1, and yarn berry via yarn-plugin-npmrc all read the registry/auth from here.)
  const publishNpmrcPath = path.join(repoRoot, '.npmrc.publish');
  const npmrcPath = path.join(repoRoot, '.npmrc');
  fs.copyFileSync(publishNpmrcPath, npmrcPath);
  console.log(`Copied ${publishNpmrcPath} to ${npmrcPath}\n`);

  const yarnrcPath = path.join(repoRoot, '.yarnrc.yml');
  if (fs.existsSync(yarnrcPath)) {
    // yarn berry: configure the registry and auth in .yarnrc.yml.
    updateYarnrcYml(yarnrcPath, registry);
  } else {
    // npm / yarn v1: rewrite absolute registry URLs saved in the lock file.
    updateLockFileRegistry({ manager: 'npm', registry, cwd: repoRoot });
    updateLockFileRegistry({ manager: 'yarn1', registry, cwd: repoRoot });
  }

  return registry;
}

if (import.meta.main) {
  if (!preparePublishRegistry()) {
    console.error(`No registry found in ${path.join(defaultRepoRoot, '.npmrc.publish')}`);
    process.exit(1);
  }
}

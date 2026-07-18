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
 * Persist a yarn config as a `YARN_*` env var across ADO pipeline steps.
 */
function setAdoYarnVariable(yarnConfigName: string, value: string): void {
  // avoid accidentally setting variables
  const prefix = process.env.JEST_WORKER_ID ? '##fake' : '##vso';
  const varName = `YARN_${yarnConfigName.replace(/[A-Z]/g, c => `_${c}`).toUpperCase()}`;
  console.log(`${prefix}[task.setvariable variable=${varName}]${value}`);
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
  const normalizedRegistry = registry.endsWith('/') ? registry : `${registry}/`;
  const lockFilePath = path.join(cwd, manager === 'yarn1' ? 'yarn.lock' : 'package-lock.json');
  if (!fs.existsSync(lockFilePath)) {
    return;
  }

  const content = fs.readFileSync(lockFilePath, 'utf-8');
  const updated = revert
    ? content.replaceAll(normalizedRegistry, defaultRegistries[manager])
    : content.replaceAll(defaultRegistries[manager], normalizedRegistry);
  if (updated !== content) {
    console.log(`${revert ? 'Reverting' : 'Updating'} registry URLs in ${lockFilePath}`);
    fs.writeFileSync(lockFilePath, updated, 'utf-8');
  }
}

/**
 * Configure the private registry from `.npmrc.publish` for whichever package manager the repo uses:
 * - For yarn berry, ensure `yarn-plugin-npmrc` is installed, and configure relevant settings via
 *   `YARN_*` env vars persisted across steps (so we don't modify `.yarnrc.yml`).
 * - For npm or yarn v1, rewrite lock file URLs.
 *
 * @returns The private registry URL, or `undefined` if none was found in `.npmrc.publish`.
 */
export function preparePublishRegistry(repoRoot: string = defaultRepoRoot): string | undefined {
  const registry = getPublishRegistry(repoRoot);
  if (!registry) {
    console.error(`No registry found in ${path.join(repoRoot, '.npmrc.publish')}`);
    return undefined;
  }

  const yarnrcPath = path.join(repoRoot, '.yarnrc.yml');
  if (fs.existsSync(yarnrcPath)) {
    // Yarn 4 doesn't respect .npmrc, so verify that this plugin to fix it is installed.
    const yarnrcContent = fs.readFileSync(yarnrcPath, 'utf-8');
    if (!yarnrcContent.includes('yarn-plugin-npmrc') && !yarnrcContent.includes('yarn-plugins/npmrc')) {
      console.error(
        `yarn-plugin-npmrc is not installed in ${yarnrcPath}\n` +
          `(add it from https://github.com/microsoft/beachball/tree/main/yarn-plugins/npmrc )`
      );
      return undefined;
    }
    // Persist config via YARN_* variables so we're not updating a checked-in file.
    setAdoYarnVariable('npmRegistryServer', registry);
    setAdoYarnVariable('npmAlwaysAuth', 'true');
    setAdoYarnVariable('npmrcAuthEnabled', 'true'); // for yarn-plugin-npmrc
  } else {
    // npm / yarn v1: rewrite absolute registry URLs saved in the lock file.
    updateLockFileRegistry({ manager: 'npm', registry, cwd: repoRoot });
    updateLockFileRegistry({ manager: 'yarn1', registry, cwd: repoRoot });
  }

  return registry;
}

if (import.meta.main) {
  if (!preparePublishRegistry()) {
    process.exit(1);
  }
}

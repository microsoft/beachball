import fs from 'node:fs';
import path from 'node:path';
import type { BeachballOptions } from '../types/BeachballOptions';
import { BeachballError } from '../types/BeachballError';
import { getWorkspaceManagerAndRoot } from 'workspace-tools';

// registries MUST have a trailing slash
const defaultNpmRegistry = 'https://registry.npmjs.org/';
const defaultYarnRegistry = 'https://registry.yarnpkg.com/';

/**
 * Update public registry URLs saved in yarn v1 or npm lock files.
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
export function updateLockFileRegistry(
  params: Pick<BeachballOptions, 'registry'> & {
    /** Current working directory (will find the project root from here). */
    cwd: string;
    /** If true, revert from `registry` to the default registry. Otherwise apply `registry` to the lock file. */
    revert?: boolean;
  }
): void {
  const { revert } = params;

  let registry = params.registry;
  if (!registry) {
    throw new BeachballError('The "registry" option is required to update lock files');
  }
  registry = registry.replace(/(?<!\/)$/, '/');

  const workspace = getWorkspaceManagerAndRoot(params.cwd);
  if (
    !workspace ||
    !['npm', 'yarn'].includes(workspace.manager) ||
    (workspace.manager === 'yarn' && fs.existsSync(path.join(workspace.root, '.yarnrc.yml')))
  ) {
    console.log('Skipping lock file update for current package manager which does not embed URLs');
    return;
  }
  const { manager, root } = workspace;

  const managerFile = manager === 'yarn' ? 'yarn.lock' : 'package-lock.json';
  const defaultRegistry = manager === 'yarn' ? defaultYarnRegistry : defaultNpmRegistry;
  if (registry === defaultRegistry) {
    console.log('Skipping lock file update for default registry');
    return;
  }
  const oldRegistry = revert ? registry : defaultRegistry;
  const newRegistry = revert ? defaultRegistry : registry;

  const lockFilePath = path.join(root, managerFile);
  const lockFileContent = fs.readFileSync(lockFilePath, 'utf-8');
  if (!lockFileContent.includes(oldRegistry)) {
    throw new BeachballError(`Lock file ${lockFilePath} does not contain ${oldRegistry}`);
  }

  const updated = lockFileContent.replaceAll(oldRegistry, newRegistry);
  console.log(`${revert ? 'Reverting' : 'Updating'} registry URLs in ${lockFilePath}`);
  fs.writeFileSync(lockFilePath, updated, 'utf-8');
}

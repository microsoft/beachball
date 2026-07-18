//
// Sample beachball `hooks.precommit` implementation to accompany preparePublishRegistry.ts.
// It's NOT used by beachball itself (yarn 4 doesn't store registry URLs in its lock file).
//
// When the package manager records resolved registry URLs in its lock file (npm, yarn v1),
// preparePublishRegistry.ts rewrites those URLs to the private registry before install.
// If the lock file ALSO reflects local package versions (which beachball has bumped),
// the URL changes need to be reverted so the version bumps can be committed.
//
// pnpm isn't handled here: it never writes default-registry tarball URLs to `pnpm-lock.yaml`
// (see updateLockFileRegistry in preparePublishRegistry.ts), so there's nothing to revert.
//
// In beachball.config.js:
//   const { revertPublishRegistryHook } = require('./scripts/revertPublishRegistryHook.ts');
//   module.exports = { hooks: { precommit: revertPublishRegistryHook } };
//
import { getPublishRegistry, updateLockFileRegistry } from './preparePublishRegistry.ts';

// Update as appropriate
const manager: 'yarn1' | 'npm' = 'yarn1';

/**
 * beachball `hooks.precommit`: revert the private registry URLs written by preparePublishRegistry.ts
 * back to the public registry, so the committed lock file doesn't reference the private feed.
 * @param cwd The monorepo root path
 */
export function revertPublishRegistryHook(cwd: string): void {
  const registry = getPublishRegistry(cwd);
  if (registry) {
    updateLockFileRegistry({ manager, registry, cwd, revert: true });
  }
}

//
// Sample script to update lock file registry URLs to point to a private feed.
// (The explicit .mts extension makes it safe to copy into non-ESM projects using Node 22.18+.)
//
// For repos using npm, it also exports a revertLockFileRegistry() for use in
// beachball.config.js `hooks.precommit`.
//
// This script MUST NOT USE EXTERNAL DEPENDENCIES!
// It's run before deps are installed in a release pipeline.
// It assumes the registry URL was set in a REGISTRY_URL variable in the pipeline.
//

import fs from 'fs';
import path from 'path';

// ‼️‼️‼️ UPDATE AS NEEDED for your repo's setup ‼️‼️‼️
const repoRoot = path.resolve(import.meta.dirname, '..');
const npmrcPath = path.join(repoRoot, '.npmrc');
const lockFilePath = path.join(repoRoot, 'package-lock.json');
const defaultRegistry = 'https://registry.npmjs.org/';

const customRegistry = process.env.REGISTRY_URL || '';
if (!customRegistry) {
  console.error('process.env.REGISTRY_URL is not set');
  process.exit(1);
}

// validate the URL (in case the very simple parsing above fails)
try {
  new URL(customRegistry);
} catch {
  console.error(`Invalid registry URL parsed from ${npmrcPath}:\n${customRegistry}`);
  process.exit(1);
}

function updateLockFileRegistry(params: { oldRegistry: string; newRegistry: string }): void {
  // ensure trailing slashes
  const oldRegistry = params.oldRegistry.replace(/(?<!\/)$/, '/');
  const newRegistry = params.newRegistry.replace(/(?<!\/)$/, '/');
  console.log(`Updating registry URLs in ${lockFilePath} from ${oldRegistry} to ${newRegistry}`);

  const lockFileContent = fs.readFileSync(lockFilePath, 'utf-8');
  const updated = lockFileContent.replaceAll(oldRegistry, newRegistry);
  fs.writeFileSync(lockFilePath, updated, 'utf-8');
}

/**
 * `precommit` hook for `beachball.config.js` to revert URLs to the default registry.
 * For example:
 * ```js
 * const { revertLockFileRegistry } = require('./scripts/updateLockFileRegistry.mts');
 * module.exports = { hooks: { precommit: revertLockFileRegistry } };
 * ```
 */
export function revertLockFileRegistry(): void {
  updateLockFileRegistry({ oldRegistry: customRegistry, newRegistry: defaultRegistry });
}

if (import.meta.main) {
  // Update URLs in the lock file to point to a private registry.
  updateLockFileRegistry({ oldRegistry: defaultRegistry, newRegistry: customRegistry });
}

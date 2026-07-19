import fs from 'fs';
import path from 'path';

/**
 * Sample `hooks.precommit` for `beachball.config.js` to revert URLs to the default registry.
 */
export function revertLockFileRegistry(cwd: string): void {
  // ‼️‼️‼️ UPDATE AS NEEDED for your repo's setup ‼️‼️‼️
  // In the sample, this is set at the pipeline level
  const registryEnv = 'REGISTRY_URL';
  // For npm:
  const lockFileName = 'package-lock.json';
  const defaultRegistry = 'https://registry.npmjs.org/';
  // For yarn:
  // const lockFileName = 'yarn.lock';
  // const defaultRegistry = 'https://registry.yarnpkg.com/';

  const customRegistry = process.env[registryEnv]?.replace(/(?<!\/)$/, '/');
  if (!customRegistry) {
    throw new Error(`process.env.${registryEnv} is not set`);
  }

  const lockFilePath = path.join(cwd, lockFileName);
  const lockFileContent = fs.readFileSync(lockFilePath, 'utf-8');
  const updated = lockFileContent.replaceAll(customRegistry, defaultRegistry);
  fs.writeFileSync(lockFilePath, updated, 'utf-8');
}

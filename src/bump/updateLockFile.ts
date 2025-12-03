import fs from 'fs-extra';
import path from 'path';
import { packageManager } from '../packageManager/packageManager';
import { env } from '../env';
import type { BeachballOptions } from '../types/BeachballOptions';

/**
 * Detects lockfile for npm, pnpm, or yarn and runs the appropriate command to update it
 */
export async function updateLockFile(options: Pick<BeachballOptions, 'path'>): Promise<void> {
  // Never update the lock file while running in tests (if tests are added to cover this step,
  // a method can be added to override this condition with a local variable)
  if (env.isJest) {
    return;
  }

  const root = options.path;
  let updateFile: string | undefined;
  let updateCommand: ['npm' | 'pnpm' | 'yarn', ...string[]] | undefined;

  if (fs.existsSync(path.join(root, 'package-lock.json'))) {
    updateFile = 'package-lock.json';
    updateCommand = ['npm', 'install', '--package-lock-only', '--ignore-scripts'];
  } else if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) {
    updateFile = 'pnpm-lock.yaml';
    updateCommand = ['pnpm', 'install', '--lockfile-only', '--ignore-scripts'];
  } else if (fs.existsSync(path.join(root, 'yarn.lock'))) {
    const version = await packageManager('yarn', ['--version'], { cwd: root });
    if (version.success) {
      // For yarn v1, local versions aren't recorded in the lock file, so we don't need an update.
      // yarn v2+ records these versions and may require an update.
      if (!version.stdout.startsWith('1.')) {
        updateFile = 'yarn.lock';
        updateCommand = ['yarn', 'install', '--mode', 'update-lockfile'];
      }
    } else {
      console.warn('Failed to get yarn version. Continuing...');
    }
  }

  if (updateFile && updateCommand) {
    console.log(`Updating ${updateFile} after bumping packages`);

    const res = await packageManager(updateCommand[0], updateCommand.slice(1), { stdio: 'inherit', cwd: root });

    if (!res.success) {
      console.warn(`Updating ${updateFile} failed. Continuing...`);
    }
  }
}

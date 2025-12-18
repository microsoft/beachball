import fs from 'fs';
import path from 'path';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { getChangePath } from '../paths';
import type { ChangeFileInfo, ChangeType } from '../types/ChangeInfo';
import type { BeachballOptions } from '../types/BeachballOptions';

/** Change file with `packageName` required and other props optional */
export type PartialChangeFile = { packageName: string } & Partial<ChangeFileInfo>;

/** Placeholder email/author */
export const fakeEmail = 'test@test.com';

/**
 * Generate a change file for the given package.
 */
export function getChange(
  packageName: string,
  comment = `${packageName} comment`,
  type: ChangeType = 'minor'
): ChangeFileInfo {
  return {
    comment,
    email: fakeEmail,
    packageName,
    type,
    dependentChangeType: 'patch',
  };
}

/**
 * Generates and writes change files for the given packages.
 * Also commits if `options.commit` is true (the default with full options) and the context is a git repo.
 * @param changes Array of package names or partial change files (which must include `packageName`).
 * Default values:
 * - `type: 'minor'`
 * - `dependentChangeType: 'patch'`
 * - `comment: '<packageName> comment'`
 * - `email: 'test@test.com'`
 */
export function generateChangeFiles(
  changes: (string | PartialChangeFile)[],
  options: Parameters<typeof writeChangeFiles>[1]
): void {
  writeChangeFiles(
    changes.map(change => {
      change = typeof change === 'string' ? { packageName: change } : change;
      return {
        ...getChange(change.packageName, undefined, 'minor'),
        ...change,
      };
    }),
    options
  );
}

/** Get full paths to existing change files under `cwd` */
export function getChangeFiles(options: Pick<BeachballOptions, 'path' | 'changeDir'>): string[] {
  const changePath = getChangePath(options);
  return changePath && fs.existsSync(changePath) ? fs.readdirSync(changePath).map(p => path.join(changePath, p)) : [];
}

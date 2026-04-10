import fs from 'fs';
import path from 'path';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { getChangePath } from '../paths';
import type { ChangeFileInfo, ChangeSet, ChangeType } from '../types/ChangeInfo';
import type { BeachballOptions } from '../types/BeachballOptions';

/** Change file with `packageName` required and other props optional */
export type PartialChangeFile = { packageName: string } & Partial<ChangeFileInfo>;

/** Placeholder email/author */
export const fakeEmail = 'test@test.com';

/**
 * Generate a change file for the given package.
 * Default values:
 * - `type: 'minor'`
 * - `dependentChangeType: 'patch'`
 * - `comment: '<packageName> comment'`
 * - `email: 'test@test.com'`
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
 * Generates change files for the given packages.
 * @param changes Array of package names or partial change files (which must include `packageName`).
 * See {@link getChange} for default values.
 */
function generateChanges(changes: (string | PartialChangeFile)[]): ChangeFileInfo[] {
  return changes.map(change => {
    change = typeof change === 'string' ? { packageName: change } : change;
    return {
      ...getChange(change.packageName, undefined, 'minor'),
      ...change,
    };
  });
}

/**
 * Generates a change set for the given packages (the file names will not be realistic).
 * @param changes Array of package names or partial change files (which must include `packageName`).
 * See {@link getChange} for default values.
 */
export function generateChangeSet(changes: (string | PartialChangeFile)[]): ChangeSet {
  return generateChanges(changes).map((change, i) => ({
    change,
    changeFile: `change${i}.json`,
  }));
}

/**
 * Generates and writes change files for the given packages.
 * Also commits if `options.commit` is true.
 *
 * Default change info values:
 * - `type: 'minor'`
 * - `dependentChangeType: 'patch'`
 * - `comment: '<packageName> comment'`
 * - `email: 'test@test.com'`
 *
 * @param changes Array of package names or partial change files (which must include `packageName`).
 */
export function generateChangeFiles(
  changes: (string | PartialChangeFile)[],
  options: Parameters<typeof writeChangeFiles>[1]
): void {
  writeChangeFiles(generateChanges(changes), options);
}

/** Get full paths to existing change files under `cwd` */
export function getChangeFiles(options: Pick<BeachballOptions, 'path' | 'changeDir'>): string[] {
  const changePath = getChangePath(options);
  return changePath && fs.existsSync(changePath) ? fs.readdirSync(changePath).map(p => path.join(changePath, p)) : [];
}

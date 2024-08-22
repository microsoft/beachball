import fs from 'fs';
import path from 'path';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { getChangePath } from '../paths';
import { ChangeFileInfo } from '../types/ChangeInfo';
import type { BeachballOptions } from '../types/BeachballOptions';

/** Change file with `packageName` required and other props optional */
export type PartialChangeFile = { packageName: string } & Partial<ChangeFileInfo>;

/**
 * Generates and writes change files for the given packages.
 * @param changes Array of package names or partial change files (which must include `packageName`).
 * Default values are `type: 'minor'`, `dependentChangeType: 'patch'`, and placeholders for other fields.
 */
export function generateChangeFiles(
  changes: (string | PartialChangeFile)[],
  options: Pick<BeachballOptions, 'path' | 'groupChanges' | 'changeDir'>
): void {
  writeChangeFiles(
    changes.map(change => {
      change = typeof change === 'string' ? { packageName: change } : change;
      return {
        comment: `${change.packageName} test comment`,
        email: 'test@test.com',
        type: 'minor',
        dependentChangeType: 'patch',
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

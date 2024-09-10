import { ChangeSet } from '../types/ChangeInfo';
import { getChangePath } from '../paths';
import fs from 'fs-extra';
import path from 'path';
import { PackageInfos } from '../types/PackageInfo';
import type { BeachballOptions } from '../types/BeachballOptions';
import { DeepReadonly } from '../types/DeepReadonly';

/**
 * Unlink only change files that are specified in the changes param
 *
 * @param changes existing change files to be removed
 */
export function unlinkChangeFiles(
  changeSet: DeepReadonly<ChangeSet>,
  packageInfos: PackageInfos,
  options: Pick<BeachballOptions, 'path' | 'changeDir'>
): void {
  const changePath = getChangePath(options);
  if (!changeSet?.length) {
    return;
  }
  console.log('Removing change files:');
  for (let { changeFile, change } of changeSet) {
    if (changeFile && packageInfos[change.packageName] && !packageInfos[change.packageName].private) {
      console.log(`- ${changeFile}`);
      fs.removeSync(path.join(changePath, changeFile));
    }
  }
  if (fs.existsSync(changePath) && fs.readdirSync(changePath).length === 0) {
    console.log('Removing change path');
    fs.removeSync(changePath);
  }
}

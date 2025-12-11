import type { ChangeSet } from '../types/ChangeInfo';
import { getChangePath } from '../paths';
import fs from 'fs';
import path from 'path';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { DeepReadonly } from '../types/DeepReadonly';

/**
 * Unlink only change files that are specified in the `changeSet` param.
 * Does nothing if `options.keepChangeFiles` is true.
 *
 * @param changeSet existing change files to be removed
 */
export function unlinkChangeFiles(
  changeSet: DeepReadonly<ChangeSet>,
  options: Pick<BeachballOptions, 'path' | 'changeDir' | 'keepChangeFiles'>
): void {
  if (!changeSet.length || options.keepChangeFiles) {
    return;
  }

  console.log('Removing change files:');
  const changePath = getChangePath(options);
  for (const { changeFile } of changeSet) {
    if (changeFile) {
      console.log(`- ${changeFile}`);
      fs.rmSync(path.join(changePath, changeFile), { force: true });
    }
  }
  if (fs.existsSync(changePath) && fs.readdirSync(changePath).length === 0) {
    console.log(`Removing empty ${options.changeDir} folder`);
    fs.rmSync(changePath, { recursive: true, force: true });
  }
}

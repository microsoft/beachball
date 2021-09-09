import { BeachballOptions } from '../types/BeachballOptions';
import { PackageInfos } from '../types/PackageInfo';
import { areChangeFilesDeleted } from './areChangeFilesDeleted';
import { isChangeFileNeeded } from './isChangeFileNeeded';

export function hasNeededChangeFiles(
  options: BeachballOptions,
  packageInfos: PackageInfos,
  allowMissingChangeFiles: boolean
): { isChangeNeeded: boolean; hasError: boolean } {
  const isChangeNeeded = isChangeFileNeeded(options, packageInfos);
  let hasError = false;

  if (isChangeNeeded && !allowMissingChangeFiles) {
    console.error('ERROR: Change files are needed!');
    console.log(options.changehint);
    hasError = true;
  }

  if (options.disallowDeletedChangeFiles && areChangeFilesDeleted(options)) {
    console.error('ERROR: Change files must not be deleted!');
    hasError = true;
  }

  return { isChangeNeeded, hasError };
}

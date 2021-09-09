import { getUntrackedChanges } from 'workspace-tools';
import { getValidatedPackageGroups } from './getValidatedPackageGroups';
import { BeachballOptions } from '../types/BeachballOptions';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { validatePackageDependencies } from '../publish/validatePackageDependencies';
import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import { areOptionsValid } from './areOptionsValid';
import { hasNeededChangeFiles } from './hasNeededChangeFiles';
import { isValidChangeSet } from './isValidChangeSet';
import { readChangeFiles } from '../changefile/readChangeFiles';

type ValidationOptions = {
  allowMissingChangeFiles?: boolean;
  allowFetching?: boolean;
};

export function validate(options: BeachballOptions, validateOptions?: Partial<ValidationOptions>) {
  const { allowMissingChangeFiles = false, allowFetching = true } = validateOptions || {};

  if (!areOptionsValid(options, { allowFilesystem: true })) {
    process.exit(1);
  }

  const packageInfos = getPackageInfos(options.path);

  if (options.package && !packageInfos[options.package]) {
    console.error('ERROR: Specified package name is not valid');
    process.exit(1);
  }

  const untracked = getUntrackedChanges(options.path);

  if (untracked && untracked.length > 0) {
    console.warn('WARN: There are untracked changes in your repository:');
    console.warn('- ' + untracked.join('\n- '));
    console.warn('Changes in these files will not trigger a prompt for change descriptions');
  }

  let isChangeNeeded = false;

  if (allowFetching) {
    const result = hasNeededChangeFiles(options, packageInfos, allowMissingChangeFiles);
    isChangeNeeded = result.isChangeNeeded;

    if (result.hasError) {
      process.exit(1);
    }
  }

  const packageGroups = getValidatedPackageGroups(options.path, options.groups, packageInfos);
  if (!packageGroups) {
    process.exit(1);
  }

  const changeSet = readChangeFiles(options, packageInfos);
  if (!isValidChangeSet(changeSet, packageInfos, packageGroups)) {
    process.exit(1);
  }

  if (!isChangeNeeded) {
    const bumpInfo = gatherBumpInfo(options, packageInfos);
    if (!validatePackageDependencies(bumpInfo)) {
      console.error(`ERROR: one or more published packages depend on an unpublished package!

  Consider one of the following solutions:
  - If the unpublished package should be published, remove \`"private": true\` from its package.json.
  - If it should NOT be published, verify that it is only listed under devDependencies of published packages.
  `);
      process.exit(1);
    }
  }

  return {
    isChangeNeeded,
  };
}

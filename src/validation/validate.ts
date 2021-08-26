import { isGitAvailable } from './isGitAvailable';
import { getUntrackedChanges } from 'workspace-tools';
import { isValidAuthType } from './isValidAuthType';
import { isValidChangeType } from './isValidChangeType';
import { isChangeFileNeeded } from './isChangeFileNeeded';
import { isValidGroupOptions } from './isValidGroupOptions';
import { BeachballOptions } from '../types/BeachballOptions';
import { isValidChangelogOptions } from './isValidChangelogOptions';
import { readChangeFiles } from '../changefile/readChangeFiles';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { getPackageGroups } from '../monorepo/getPackageGroups';
import { getDisallowedChangeTypes } from '../changefile/getDisallowedChangeTypes';
import { areChangeFilesDeleted } from './areChangeFilesDeleted';
import { validatePackageDependencies } from '../publish/validatePackageDependencies';
import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import { isValidDependentChangeType } from './isValidDependentChangeType';

type ValidationOptions = {
  allowMissingChangeFiles?: boolean;
  allowFetching?: boolean;
};

export function validate(options: BeachballOptions, validateOptions?: Partial<ValidationOptions>) {
  const { allowMissingChangeFiles = false, allowFetching = true } = validateOptions || {};

  if (!isGitAvailable(options.path)) {
    console.error('ERROR: Please make sure git is installed and initialize the repository with "git init".');
    process.exit(1);
  }

  const untracked = getUntrackedChanges(options.path);

  if (untracked && untracked.length > 0) {
    console.warn('WARN: There are untracked changes in your repository:');
    console.warn('- ' + untracked.join('\n- '));
    console.warn('Changes in these files will not trigger a prompt for change descriptions');
  }

  const packageInfos = getPackageInfos(options.path);

  if (options.package && !Array.isArray(options.package) && !packageInfos[options.package]) {
    console.error('ERROR: Specified package name is not valid');
    process.exit(1);
  }
  if (options.authType && !isValidAuthType(options.authType)) {
    console.error(`ERROR: auth type ${options.authType} is not valid`);
    process.exit(1);
  }

  if (options.dependentChangeType && !isValidChangeType(options.dependentChangeType)) {
    console.error(`ERROR: dependent change type ${options.dependentChangeType} is not valid`);
    process.exit(1);
  }

  if (options.type && !isValidChangeType(options.type)) {
    console.error(`ERROR: change type ${options.type} is not valid`);
    process.exit(1);
  }

  let isChangeNeeded = false;

  if (allowFetching) {
    isChangeNeeded = isChangeFileNeeded(options, packageInfos);

    if (isChangeNeeded && !allowMissingChangeFiles) {
      console.error('ERROR: Change files are needed!');
      console.log(options.changehint);
      process.exit(1);
    }

    if (options.disallowDeletedChangeFiles && areChangeFilesDeleted(options)) {
      console.error('ERROR: Change files must not be deleted!');
      process.exit(1);
    }
  }

  if (options.groups && !isValidGroupOptions(options.path, options.groups)) {
    console.error('ERROR: Groups defined inside the configuration is invalid');
    console.log(options.groups);
    process.exit(1);
  }

  if (options.changelog && !isValidChangelogOptions(options.changelog)) {
    console.error('ERROR: Changelog defined inside the configuration is invalid');
    console.log(options.changelog);
    process.exit(1);
  }

  const changeSet = readChangeFiles(options, packageInfos);
  const packageGroups = getPackageGroups(packageInfos, options.path, options.groups);

  for (const [changeFile, change] of changeSet) {
    const disallowedChangeTypes = getDisallowedChangeTypes(change.packageName, packageInfos, packageGroups);

    if (!change.type || !isValidChangeType(change.type) || disallowedChangeTypes?.includes(change.type)) {
      console.error(
        `ERROR: there is an invalid change type detected ${changeFile}: "${change.type}" is not a valid change type`
      );
      process.exit(1);
    }
    if (!change.dependentChangeType || !isValidDependentChangeType(change.dependentChangeType, disallowedChangeTypes)) {
      console.error(
        `ERROR: there is an invalid dependentChangeType detected ${changeFile}: "${change.dependentChangeType}" is not a valid dependentChangeType`
      );
      process.exit(1);
    }
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

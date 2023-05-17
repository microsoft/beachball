import { isGitAvailable } from './isGitAvailable';
import { getUntrackedChanges } from 'workspace-tools';
import { isValidAuthType } from './isValidAuthType';
import { isValidChangeType } from './isValidChangeType';
import { isChangeFileNeeded } from './isChangeFileNeeded';
import { isValidGroupedPackageOptions, isValidGroupOptions } from './isValidGroupOptions';
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
import { getPackagesToPublish } from '../publish/getPackagesToPublish';
import { env } from '../env';

type ValidationOptions = {
  /**
   * Defaults to true. If false, skip fetching the latest from the remote and don't check whether
   * changes files are needed (or whether change files are deleted).
   */
  allowFetching?: boolean;
  /**
   * If true, skip checking whether change files are needed. Ignored if `allowFetching` is false.
   */
  allowMissingChangeFiles?: boolean;
};

export function validate(options: BeachballOptions, validateOptions?: Partial<ValidationOptions>) {
  const { allowMissingChangeFiles = false, allowFetching = true } = validateOptions || {};

  console.log('\nValidating options and change files...');

  // Run the validation checks in stages and wait to exit until the end of the stage.
  // This provides more potentially useful info the user rather than hiding errors.
  let hasError = false;

  const logValidationError = (message: string) => {
    console.error(`ERROR: ${message}`);
    hasError = true;
  };

  if (!isGitAvailable(options.path)) {
    logValidationError('Please make sure git is installed and initialize the repository with "git init"');
    process.exit(1);
  }

  const untracked = getUntrackedChanges(options.path);

  if (untracked.length) {
    console.warn('WARN: There are untracked changes in your repository:\n' + untracked.join('\n- '));
    !env.isCI && console.warn('Changes in these files will not trigger a prompt for change descriptions');
  }

  const packageInfos = getPackageInfos(options.path);

  if (typeof options.package === 'string' && !packageInfos[options.package]) {
    logValidationError(`package "${options.package}" was not found`);
  } else {
    const invalidPackages = Array.isArray(options.package)
      ? options.package.filter(pkg => !packageInfos[pkg])
      : undefined;
    if (invalidPackages?.length) {
      logValidationError(`package(s) ${invalidPackages.map(pkg => `"${pkg}"`).join(', ')} were not found`);
    }
  }

  if (options.authType && !isValidAuthType(options.authType)) {
    logValidationError(`authType "${options.authType}" is not valid`);
  }

  if (options.dependentChangeType && !isValidChangeType(options.dependentChangeType)) {
    logValidationError(`dependentChangeType "${options.dependentChangeType}" is not valid`);
  }

  if (options.type && !isValidChangeType(options.type)) {
    logValidationError(`Change type "${options.type}" is not valid`);
  }

  if (options.changelog && !isValidChangelogOptions(options.changelog)) {
    hasError = true; // the helper logs this
  }

  if (options.groups && !isValidGroupOptions(options.groups)) {
    hasError = true; // the helper logs this
  }

  // this exits the process if any package belongs to multiple groups
  const packageGroups = getPackageGroups(packageInfos, options.path, options.groups);

  if (options.groups && !isValidGroupedPackageOptions(packageInfos, packageGroups)) {
    hasError = true; // the helper logs this
  }

  if (hasError) {
    // If any of the above basic checks failed, it doesn't make sense to check if change files are needed
    process.exit(1);
  }

  let isChangeNeeded = false;

  if (allowFetching) {
    // This has the side effect of fetching, so call it even if !allowMissingChangeFiles for now
    isChangeNeeded = isChangeFileNeeded(options, packageInfos);

    if (isChangeNeeded && !allowMissingChangeFiles) {
      logValidationError('Change files are needed!');
      console.log(options.changehint);
      process.exit(1); // exit here (this is the main poin)
    }

    if (options.disallowDeletedChangeFiles && areChangeFilesDeleted(options)) {
      logValidationError('Change files must not be deleted!');
      process.exit(1);
    }
  }

  const changeSet = readChangeFiles(options, packageInfos);

  for (const { changeFile, change } of changeSet) {
    const disallowedChangeTypes = getDisallowedChangeTypes(change.packageName, packageInfos, packageGroups);

    if (!change.type) {
      logValidationError(`Change type is missing in ${changeFile}`);
      hasError = true;
    } else if (!isValidChangeType(change.type)) {
      logValidationError(`Invalid change type detected in ${changeFile}: "${change.type}"`);
      hasError = true;
    } else if (disallowedChangeTypes?.includes(change.type)) {
      logValidationError(`Disallowed change type detected in ${changeFile}: "${change.type}"`);
      hasError = true;
    }

    if (!change.dependentChangeType) {
      logValidationError(`dependentChangeType is missing in ${changeFile}`);
      hasError = true;
    } else if (!isValidDependentChangeType(change.dependentChangeType, disallowedChangeTypes)) {
      logValidationError(`Invalid dependentChangeType detected in ${changeFile}: "${change.dependentChangeType}"`);
      hasError = true;
    }
  }

  if (!isChangeNeeded) {
    console.log('\nValidating package dependencies...');
    // TODO: It would be preferable if this could be done without getting the full bump info,
    // or at least if the bump info could be passed back out to other methods which currently
    // duplicate the calculation (it can be expensive, especially in large repos).
    const bumpInfo = gatherBumpInfo(options, packageInfos);
    const packagesToPublish = getPackagesToPublish(bumpInfo, true /*validationMode*/);
    if (!validatePackageDependencies(packagesToPublish, bumpInfo.packageInfos)) {
      logValidationError(`One or more published packages depend on an unpublished package!

Consider one of the following solutions:
- If the unpublished package should be published, remove \`"private": true\` from its package.json.
- If it should NOT be published, verify that it is only listed under devDependencies of published packages.
`);
      process.exit(1);
    }
  }

  console.log();

  return {
    isChangeNeeded,
  };
}

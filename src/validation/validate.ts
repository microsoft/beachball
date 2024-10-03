import { isGitAvailable } from './isGitAvailable';
import { getUntrackedChanges } from 'workspace-tools';
import { isValidAuthType } from './isValidAuthType';
import { isValidChangeType } from './isValidChangeType';
import { isValidGroupedPackageOptions, isValidGroupOptions } from './isValidGroupOptions';
import type { BeachballOptions } from '../types/BeachballOptions';
import { isValidChangelogOptions } from './isValidChangelogOptions';
import { readChangeFiles } from '../changefile/readChangeFiles';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { getPackageGroups } from '../monorepo/getPackageGroups';
import { getDisallowedChangeTypes } from '../changefile/getDisallowedChangeTypes';
import { areChangeFilesDeleted } from './areChangeFilesDeleted';
import { validatePackageDependencies } from '../publish/validatePackageDependencies';
import { bumpInPlace } from '../bump/bumpInPlace';
import { isValidDependentChangeType } from './isValidDependentChangeType';
import { getPackagesToPublish } from '../publish/getPackagesToPublish';
import { env } from '../env';
import type { PackageGroups, PackageInfos } from '../types/PackageInfo';
import type { BumpInfo } from '../types/BumpInfo';
import type { ChangeSet } from '../types/ChangeInfo';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import { getChangedPackages } from '../changefile/getChangedPackages';

type ValidationOptions = {
  /**
   * If true (the default), fetch the latest from the remote and check whether change files are needed
   * (or whether change files are deleted, if this is disallowed in options).
   *
   * If false, don't fetch and don't check if change files are needed.
   * Setting to false also guarantees that dependency versions will be verified and
   * `bumpInfo` will be present in the result object.
   * @default true
   */
  checkChangeNeeded?: boolean;
  /**
   * If true, skip checking whether change files are needed. Ignored if `checkChangeNeeded` is false.
   */
  allowMissingChangeFiles?: boolean;
  /**
   * If true, validate that the dependencies of any packages with change files are valid
   * (not private).
   */
  checkDependencies?: boolean;
};

type ValidationResult = {
  /** True if change files are needed. Always false if `validateOptions.checkChangeNeeded` wasn't true. */
  isChangeNeeded: boolean;
  /** Changed package names. This is only set if `options.checkChangeNeeded` is true or unset. */
  changedPackages: string[] | undefined;
  /** This is only guaranteed to be set if `options.checkChangeNeeded` is false. */
  bumpInfo: BumpInfo | undefined;
  /** Original package infos (not the ones modified by bumping). */
  packageInfos: PackageInfos;
  packageGroups: PackageGroups;
  changeSet: ChangeSet;
  /** Package names that are in scope per the options */
  scopedPackages: string[];
};

/**
 * Run validation of options, change files, and packages. Exit 1 if it's invalid.
 * If `validateOptions.checkChangeNeeded` is true, also check whether change files are needed.
 * @returns Various info retrieved during validation which is also needed by other functions.
 */
export function validate(
  options: BeachballOptions,
  validateOptions: ValidationOptions,
  packageInfos: PackageInfos
): ValidationResult;
/** @deprecated Must provide the package infos */
export function validate(options: BeachballOptions, validateOptions?: ValidationOptions): ValidationResult;
export function validate(
  options: BeachballOptions,
  validateOptions?: ValidationOptions,
  packageInfos?: PackageInfos
): ValidationResult {
  const { allowMissingChangeFiles, checkChangeNeeded = true, checkDependencies } = validateOptions || {};

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

  packageInfos ||= getPackageInfos(options.path);

  if (options.all && options.package) {
    logValidationError('Cannot specify both "all" and "package" options');
  } else if (typeof options.package === 'string' && !packageInfos[options.package]) {
    logValidationError(`package "${options.package}" was not found`);
  } else {
    const invalidPackages = Array.isArray(options.package)
      ? options.package.filter(pkg => !packageInfos![pkg])
      : undefined;
    if (invalidPackages?.length) {
      logValidationError(`package(s) ${invalidPackages.map(pkg => `"${pkg}"`).join(', ')} were not found`);
    }
  }

  if (options.authType && !isValidAuthType(options.authType)) {
    logValidationError(`authType "${options.authType}" is not valid`);
  }

  if (options.command === 'publish' && options.token !== undefined) {
    if (options.token === '') {
      logValidationError(
        'token should not be an empty string. This usually indicates an incorrect variable name ' +
          'or forgetting to pass a secret into a workflow step.'
      );
    } else if (options.token.startsWith('$') && options.authType !== 'password') {
      logValidationError(
        `token appears to be a variable reference: "${options.token}" -- please check your workflow configuration.`
      );
    }
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

  const scopedPackages = getScopedPackages(options, packageInfos);

  const changeSet = readChangeFiles(options, packageInfos, scopedPackages);

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

  if (hasError) {
    // If any of the above basic checks failed, it doesn't make sense to check if change files are needed
    process.exit(1);
  }

  let isChangeNeeded = false;
  let changedPackages: string[] | undefined;

  if (checkChangeNeeded) {
    console.log(`Checking for changes against "${options.branch}"`);

    // This has the side effect of fetching, so call it even if !allowMissingChangeFiles for now
    changedPackages = getChangedPackages(options, packageInfos);
    if (changedPackages.length > 0) {
      console.log(
        `Found changes in the following packages: ${[...changedPackages]
          .sort()
          .map(pkg => `\n  ${pkg}`)
          .join('')}`
      );
      isChangeNeeded = true;
    }

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

  let bumpInfo: BumpInfo | undefined;
  // if (!isChangeNeeded && checkDependencies && changeSet.length) {
  if (!isChangeNeeded) {
    console.log('\nValidating package dependencies...');

    // In theory, we could validate in-repo deps of all packages instead of doing this bump logic,
    // but there's a risk that this could result in new checks/errors in existing repos
    // (and might be more perf-intensive in large repos, but it's hard to say).
    bumpInfo = bumpInPlace({ packageGroups, packageInfos, scopedPackages, changeFileChangeInfos: changeSet }, options);

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

  return { isChangeNeeded, changedPackages, bumpInfo, changeSet, packageGroups, packageInfos, scopedPackages };
}

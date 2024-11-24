import { getUntrackedChanges } from 'workspace-tools';
import { isValidAuthType } from './isValidAuthType';
import { isValidChangeType } from './isValidChangeType';
import { isValidGroupedPackageOptions, isValidGroupOptions } from './isValidGroupOptions';
import type { BeachballOptions, ParsedOptions } from '../types/BeachballOptions';
import { isValidChangelogOptions } from './isValidChangelogOptions';
import { readChangeFiles } from '../changefile/readChangeFiles';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { getPackageGroups } from '../monorepo/getPackageGroups';
import { getDisallowedChangeTypes } from '../changefile/getDisallowedChangeTypes';
import { areChangeFilesDeleted } from './areChangeFilesDeleted';
import { validatePackageDependencies } from '../publish/validatePackageDependencies';
import { bumpInMemory } from '../bump/bumpInMemory';
import { isValidDependentChangeType } from './isValidDependentChangeType';
import { getPackagesToPublish } from '../publish/getPackagesToPublish';
import { env } from '../env';
import { bulletedList } from '../logging/bulletedList';
import type { BumpInfo } from '../types/BumpInfo';
import type { ChangeCommandContext, CommandContext } from '../types/CommandContext';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import { getChangedPackages } from '../changefile/getChangedPackages';

export type ValidateOptions = {
  /**
   * If true, check whether change files are needed (and whether change files are deleted).
   */
  checkChangeNeeded?: boolean;
  /**
   * If true, don't error if change files are needed (just return `isChangeNeeded` true).
   * This is used by the `change` command.
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
  /**
   * Context calculated during validation that can also be used by main command logic.
   * `bumpInfo` will only be set if `checkDependencies` was true and no changes were needed.
   * `changedPackages` will only be set if `checkChangeNeeded` was true.
   */
  context: CommandContext & ChangeCommandContext;
};

/**
 * Run validation of options, change files, and packages. Exit 1 if it's invalid.
 * If `validateOptions.checkChangeNeeded` is true, also check whether change files are needed.
 * @returns Various info retrieved during validation which is also needed by other functions.
 */
export function validate(parsedOptions: ParsedOptions, validateOptions: ValidateOptions): ValidationResult;
/** @deprecated Use other signature */
export function validate(options: BeachballOptions, validateOptions?: ValidateOptions): ValidationResult;
export function validate(
  _options: BeachballOptions | ParsedOptions,
  validateOptions?: ValidateOptions
): ValidationResult {
  const options = 'options' in _options ? _options.options : _options;

  const { allowMissingChangeFiles, checkChangeNeeded, checkDependencies } = validateOptions || {};

  console.log('\nValidating options and change files...');

  // Run the validation checks in stages and wait to exit until the end of the stage.
  // This provides more potentially useful info the user rather than hiding errors.
  let hasError = false;

  const logValidationError = (message: string) => {
    console.error(`ERROR: ${message}`);
    hasError = true;
  };

  const untracked = getUntrackedChanges({ cwd: options.path });

  if (untracked.length) {
    console.warn('WARN: There are untracked changes in your repository:\n' + bulletedList(untracked));
    !env.isCI && console.warn('Changes in these files will not trigger a prompt for change descriptions');
  }

  const originalPackageInfos =
    // eslint-disable-next-line etc/no-deprecated
    'cliOptions' in _options ? getPackageInfos(_options.cliOptions) : getPackageInfos(options.path);

  if (options.all && options.package) {
    logValidationError('Cannot specify both "all" and "package" options');
  } else if (options.package) {
    // TODO: combine with other package validation logic, including in getChangedPackages
    const packages = Array.isArray(options.package) ? options.package : [options.package];
    const invalidReasons: string[] = [];
    for (const pkg of packages) {
      if (!originalPackageInfos[pkg]) {
        invalidReasons.push(`"${pkg}" was not found`);
      } else if (originalPackageInfos[pkg].private) {
        invalidReasons.push(`"${pkg}" is marked as private`);
      }
    }
    if (invalidReasons.length) {
      logValidationError(`Invalid package(s) specified:\n${bulletedList(invalidReasons)}`);
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
  const packageGroups = getPackageGroups(originalPackageInfos, options.path, options.groups);

  if (options.groups && !isValidGroupedPackageOptions(originalPackageInfos, packageGroups)) {
    hasError = true; // the helper logs this
  }

  const scopedPackages = getScopedPackages(options, originalPackageInfos);
  const changeSet = readChangeFiles(options, originalPackageInfos, scopedPackages);

  for (const { changeFile, change } of changeSet) {
    const disallowedChangeTypes = getDisallowedChangeTypes(
      change.packageName,
      originalPackageInfos,
      packageGroups,
      options
    );

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
    // TODO: consider throwing instead
    // eslint-disable-next-line no-restricted-properties
    process.exit(1);
  }

  let isChangeNeeded = false;
  let changedPackages: string[] | undefined;

  if (checkChangeNeeded) {
    changedPackages = getChangedPackages(options, originalPackageInfos, scopedPackages);
    isChangeNeeded = changedPackages.length > 0;
    if (isChangeNeeded) {
      const message = options.all
        ? 'Considering the following packages due to --all'
        : options.package
          ? 'Considering the specific --package'
          : 'Found changes in the following packages';
      console.log(`${message}:\n${bulletedList([...changedPackages].sort())}`);
    }

    if (isChangeNeeded && !allowMissingChangeFiles) {
      logValidationError('Change files are needed!');
      console.log(options.changehint);
      // TODO: consider throwing instead
      // eslint-disable-next-line no-restricted-properties
      process.exit(1); // exit here (this is the main poin)
    }

    if (options.disallowDeletedChangeFiles && areChangeFilesDeleted(options)) {
      logValidationError('Change files must not be deleted!');
      // TODO: consider throwing instead
      // eslint-disable-next-line no-restricted-properties
      process.exit(1);
    }
  }

  let bumpInfo: BumpInfo | undefined;
  if (!isChangeNeeded && checkDependencies && changeSet.length) {
    console.log('\nValidating package dependencies...');
    // Unfortunately, to get full info about which dependents would be bumped, it's probably necessary
    // to calculate the full bump info.
    bumpInfo = bumpInMemory(options, { originalPackageInfos, packageGroups, changeSet, scopedPackages });
    const packagesToPublish = getPackagesToPublish(bumpInfo);

    if (!validatePackageDependencies(packagesToPublish, bumpInfo.packageInfos)) {
      logValidationError(`One or more published packages depend on an unpublished package!

Consider one of the following solutions:
- If the unpublished package should be published, remove \`"private": true\` from its package.json.
- If it should NOT be published, verify that it is only listed under devDependencies of published packages.
`);
      // TODO: consider throwing instead
      // eslint-disable-next-line no-restricted-properties
      process.exit(1);
    }
  }

  console.log();

  return {
    isChangeNeeded,
    context: { originalPackageInfos, packageGroups, scopedPackages, changeSet, changedPackages, bumpInfo },
  };
}

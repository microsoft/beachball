import { findGitRoot, git } from 'workspace-tools';
import { AuthType } from '../types/Auth';
import { BeachballOptions, VersionGroupOptions } from '../types/BeachballOptions';
import { ChangelogGroupOptions } from '../types/ChangelogOptions';
import { isValidChangeType } from './isValidChangeType';
import { isValidDependentChangeType } from './isValidDependentChangeType';

function isGitAvailable(cwd: string) {
  const result = git(['--version']);
  const gitRoot = findGitRoot(cwd);
  return result.success && gitRoot;
}

function isValidAuthType(authType: string): boolean {
  const authTypes: AuthType[] = ['authtoken', 'password'];
  return authTypes.includes(authType as AuthType);
}

function isValidChangelogGroups(groups: ChangelogGroupOptions[]): boolean {
  return groups.every(group => !!(group.masterPackageName && group.changelogPath && group.include));
}

function isValidVersionGroupOptions(groups: VersionGroupOptions[]): boolean {
  return groups.every(group => !!(group.include && group.name));
}

/**
 * Validates the parts of BeachballOptions listed in the types for `options`.
 * (Exception: `options.path` will only be validated if `validationOptions.allowFilesystem` is true.)
 */
export function areOptionsValid(
  options: Pick<
    BeachballOptions,
    'authType' | 'changelog' | 'dependentChangeType' | 'disallowedChangeTypes' | 'groups' | 'path' | 'type'
  >,
  validationOptions: { allowFilesystem: boolean }
): boolean {
  const { allowFilesystem } = validationOptions;

  if (allowFilesystem && !isGitAvailable(options.path)) {
    console.error('ERROR: Please make sure git is installed and initialize the repository with "git init".');
    return false;
  }

  let isValid = true;

  if (options.authType && !isValidAuthType(options.authType)) {
    console.error(`ERROR: auth type ${options.authType} is not valid`);
    isValid = false;
  }

  if (
    options.dependentChangeType &&
    !isValidDependentChangeType(options.dependentChangeType, options.disallowedChangeTypes)
  ) {
    console.error(`ERROR: dependent change type ${options.dependentChangeType} is not valid`);
    isValid = false;
  }

  if (options.type && !isValidChangeType(options.type)) {
    console.error(`ERROR: change type ${options.type} is not valid`);
    isValid = false;
  }

  if (options.changelog?.groups && !isValidChangelogGroups(options.changelog.groups)) {
    console.error(
      `ERROR: all changelog groups ('changelog.groups' in repo-level config) must specify ` +
        `'masterPackageName', 'changelogPath', and 'include'.`
    );
    console.log(JSON.stringify(options.changelog.groups, null, 2));
    isValid = false;
  }

  if (options.groups && !isValidVersionGroupOptions(options.groups)) {
    console.error(
      `ERROR: All package version groups ('groups' in repo-level config) must specify 'include' and 'name'`
    );
    isValid = false;
  }

  return isValid;
}

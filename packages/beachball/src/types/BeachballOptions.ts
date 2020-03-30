import { ChangeType } from './ChangeInfo';

export type BeachballOptions = CliOptions & RepoOptions & PackageOptions;

export interface CliOptions {
  branch: string;
  command: string;
  message: string;
  path: string;
  registry: string;
  tag: string;
  token: string;
  push: boolean;
  publish: boolean;
  bumpDeps: boolean;
  fetch: boolean;
  yes: boolean;
  new: boolean;
  access: 'public' | 'restricted';
  package: string;
  changehint: string;
  type?: ChangeType | null;
  help?: boolean;
  version?: boolean;
  scope?: string[] | null;
  retries?: number;
}

export interface RepoOptions {
  branch: string;
  message: string;
  path: string;
  registry: string;
  tag: string;
  push: boolean;
  publish: boolean;
  bumpDeps: boolean;
  fetch: boolean;
  access: 'public' | 'restricted';
  changehint: string;
  disallowedChangeTypes: ChangeType[] | null;
  defaultNpmTag: string;

  /** number of retries for a package publish before failing */
  retries: number;
  groups?: VersionGroupOptions[];
  changelog?: ChangelogOptions;
}

export interface PackageOptions {
  disallowedChangeTypes: ChangeType[] | null;
  defaultNpmTag: string;
}

export interface VersionGroupOptions {
  /** minimatch pattern (or array of minimatch) to detect which packages should be included in this group */
  include: string | string[];

  /** minimatch pattern (or array of minimatch) to detect which packages should be excluded in this group */
  exclude?: string | string[];

  disallowedChangeTypes: ChangeType[] | null;

  /** name of the version group */
  name: string;
}

/**
 * Options for change log related configurations.
 */
export interface ChangelogOptions {
  groups: ChangelogGroupOptions[];
}

export interface ChangelogGroupOptions {
  /** the main package which a group of changes bubbles up to. all changes within the group are used to describe changes for the master package. */
  masterPackageName: string;

  /** minimatch pattern (or array of minimatch) to detect which packages should be included in this group */
  include: string | string[];

  /** minimatch pattern (or array of minimatch) to detect which packages should be excluded in this group */
  exclude?: string | string[];

  changelogPath: string;
}

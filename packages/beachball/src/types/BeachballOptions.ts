import { ChangeType } from './ChangeInfo';

export type BeachballOptions = CliOptions & RepoOptions & PackageOptions;

export type VersionStrategy = 'lockedStep' | 'changeFiles';

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
  access: 'public' | 'restricted';
  package: string;
  changehint: string;
  type?: ChangeType | null;
  help?: boolean;
  version?: boolean;
  groups?: VersionGroupOptions[];
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
}

export interface PackageOptions {
  disallowedChangeTypes: ChangeType[] | null;
  defaultNpmTag: string;
}

export interface VersionGroupOptions {
  versionStrategy: VersionStrategy;

  /** minimatch pattern (or array of minimatch) to detect which packages should be included in this group */
  include: string | string[];

  /** minimatch pattern (or array of minimatch) to detect which packages should be excluded in this group */
  exclude: string | string[];

  name?: string;
}

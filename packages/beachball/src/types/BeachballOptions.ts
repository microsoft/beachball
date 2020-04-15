import { ChangeType } from './ChangeInfo';
import { ChangeFilePromptOptions } from './ChangeFilePrompt';
import { ChangelogOptions } from './ChangelogOptions';
import { BumpInfo } from './BumpInfo';

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
  retries: number;
  type?: ChangeType | null;
  help?: boolean;
  version?: boolean;
  scope?: string[] | null;
  timeout?: number;
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
  changeFilePrompt?: ChangeFilePromptOptions;

  hooks?: {
    /**
     * Prepublish hook gets run right before npm publish (during performBump)
     * the changes will be reverted before pushing
     *
     * This hook expects manipulation to the bumpInfo object (side effects)
     */
    prepublish?: (bumpInfo: BumpInfo) => void | Promise<void>;
  };
}

export interface PackageOptions {
  disallowedChangeTypes: ChangeType[] | null;
  defaultNpmTag: string;
  changeFilePrompt?: ChangeFilePromptOptions;
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

import { AuthType } from './Auth';
import { ChangeInfo, ChangeType } from './ChangeInfo';
import { ChangeFilePromptOptions } from './ChangeFilePrompt';
import { ChangelogOptions } from './ChangelogOptions';

export type BeachballOptions = CliOptions & RepoOptions & PackageOptions;

export interface CliOptions {
  all: boolean;
  authType: AuthType;
  branch: string;
  command: string;
  message: string;
  path: string;
  registry: string;
  gitTags: boolean;
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
  fromRef?: string;
  keepChangeFiles?: boolean;
  bump: boolean;
  canaryName?: string | undefined;
  forceVersions?: boolean;
  disallowedChangeTypes: ChangeType[] | null;
  dependentChangeType: ChangeType | null;
  disallowDeletedChangeFiles?: boolean;
  prereleasePrefix?: string | null;
  configPath?: string;
  commit?: boolean;
}

export interface RepoOptions {
  branch: string;
  message: string;
  path: string;
  registry: string;
  gitTags: boolean;
  tag: string;
  push: boolean;
  publish: boolean;
  bumpDeps: boolean;
  fetch: boolean;
  access: 'public' | 'restricted';
  changehint: string;
  disallowedChangeTypes: ChangeType[] | null;
  defaultNpmTag: string;
  generateChangelog: boolean;

  /** number of retries for a package publish before failing */
  retries: number;
  groups?: VersionGroupOptions[];
  changelog?: ChangelogOptions;
  changeFilePrompt?: ChangeFilePromptOptions;

  hooks?: {
    /**
     * Runs for each package after version bumps have been processed and committed to git, but before the actual
     * publish command.
     *
     * This allows for file modifications which will be reflected in the published package but not be reflected in the
     * repository.
     */
    prepublish?: (packagePath: string, name: string, version: string) => void | Promise<void>;

    /**
     * Runs for each package after the publish command.
     * Any file changes made in this step will **not** be committed automatically.
     */
    postpublish?: (packagePath: string, name: string, version: string) => void | Promise<void>;
  };

  transform?: {
    /**
     * Runs for each of the filtered change files.
     *
     * This allows for adding or editing information to the change files
     * without having to modify anything on the disk.
     */
    changeFiles?: (changeInfo: ChangeInfo, changeFilePath: string) => ChangeInfo;
  }
}

export interface PackageOptions {
  gitTags: boolean;
  disallowedChangeTypes: ChangeType[] | null;
  tag: string | null;
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

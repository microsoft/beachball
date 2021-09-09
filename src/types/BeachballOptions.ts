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
  /** The target branch */
  branch: string;
  message: string;
  /** The directory to run beachball in (default `process.cwd()`) */
  path: string;
  /** Target npm registry for publishing */
  registry: string;
  /** Whether to create git tags for published packages (default true) */
  gitTags: boolean;
  /** npm dist-tag when publishing (default 'latest') */
  tag: string;
  /** Whether to push to the remote git branch when publishing (default true) */
  push: boolean;
  /** Whether to publish to the npm registry (default true) */
  publish: boolean;
  /** Bump dependent packages during publish (bump A if A depends on B) */
  bumpDeps: boolean;
  /** Fetch from remote before doing diff comparisons (default true) */
  fetch: boolean;
  /** access level for npm publish */
  access: 'public' | 'restricted';
  /** Hint message for when change files are not detected but required */
  changehint: string;
  /** What change types are disallowed */
  disallowedChangeTypes: ChangeType[] | null;
  /** The default dist-tag used for npm publish */
  defaultNpmTag: string;
  /** Whether to generate changelog files */
  generateChangelog: boolean;

  /** number of retries for a package publish before failing */
  retries: number;
  groups?: VersionGroupOptions[];
  changelog?: ChangelogOptions;
  changeFilePrompt?: ChangeFilePromptOptions;
  /** Prerelease prefix for packages that are specified to receive a prerelease bump */
  prereleasePrefix?: string | null;
  /** Ignore changes in these files (minimatch patterns; negations not supported) */
  ignorePatterns?: string[];
  /** Custom pre/post publish actions */
  hooks?: HooksOptions;
  /** Transformations for change files */
  transform?: TransformOptions;
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

export interface HooksOptions {
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
}

export interface TransformOptions {
  /**
   * Runs for each of the filtered change files.
   *
   * This allows for adding or editing information to the change files
   * without having to modify anything on the disk.
   */
  changeFiles?: (changeInfo: ChangeInfo, changeFilePath: string) => ChangeInfo;
}

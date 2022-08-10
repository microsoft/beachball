import { AuthType } from './Auth';
import { ChangeInfo, ChangeInfoMultiple, ChangeType } from './ChangeInfo';
import { ChangeFilePromptOptions } from './ChangeFilePrompt';
import { ChangelogOptions } from './ChangelogOptions';

export type BeachballOptions = CliOptions & RepoOptions & PackageOptions;

export interface CliOptions
  extends Pick<
    RepoOptions,
    | 'access'
    | 'branch'
    | 'bumpDeps'
    | 'changehint'
    | 'disallowedChangeTypes'
    | 'fetch'
    | 'gitTags'
    | 'message'
    | 'path'
    | 'prereleasePrefix'
    | 'publish'
    | 'push'
    | 'registry'
    | 'retries'
    | 'scope'
    | 'tag'
    | 'depth'
  > {
  all: boolean;
  authType: AuthType;
  bump: boolean;
  canaryName?: string | undefined;
  command: string;
  commit?: boolean;
  configPath?: string;
  dependentChangeType: ChangeType | null;
  disallowDeletedChangeFiles?: boolean;
  forceVersions?: boolean;
  fromRef?: string;
  help?: boolean;
  keepChangeFiles?: boolean;
  new: boolean;
  package: string | string[];
  timeout?: number;
  token: string;
  type?: ChangeType | null;
  verbose?: boolean;
  version?: boolean;
  yes: boolean;
}

export interface RepoOptions {
  /** access level for npm publish */
  access: 'public' | 'restricted';
  /** The target branch */
  branch: string;
  /** Bump dependent packages during publish (bump A if A depends on B) */
  bumpDeps: boolean;
  changeFilePrompt?: ChangeFilePromptOptions;
  /** Prerelease prefix for packages that are specified to receive a prerelease bump */
  /** Hint message for when change files are not detected but required */
  changehint: string;
  changelog?: ChangelogOptions;
  /** The default dist-tag used for npm publish */
  defaultNpmTag: string;
  /** What change types are disallowed */
  disallowedChangeTypes: ChangeType[] | null;
  /** Fetch from remote before doing diff comparisons (default true) */
  fetch: boolean;
  /** Whether to generate changelog files */
  generateChangelog: boolean;
  groups?: VersionGroupOptions[];
  /** Whether to create git tags for published packages (default true) */
  gitTags: boolean;
  /** Custom pre/post publish actions */
  hooks?: HooksOptions;
  ignorePatterns?: string[];
  message: string;
  /** The directory to run beachball in (default `process.cwd()`) */
  path: string;
  prereleasePrefix?: string | null;
  /** Ignore changes in these files (minimatch patterns; negations not supported) */
  /** Whether to publish to the npm registry (default true) */
  publish: boolean;
  /** Whether to push to the remote git branch when publishing (default true) */
  push: boolean;
  /** Target npm registry for publishing */
  registry: string;
  /** number of retries for a package publish before failing */
  retries: number;
  /** Filters paths that beachball uses to find packages */
  scope?: string[] | null;
  /** npm dist-tag when publishing (default 'latest') */
  tag: string;
  /** Transformations for change files */
  transform?: TransformOptions;
  /** Put multiple changes in a single changefile */
  groupChanges?: boolean;
  /** Depth of git history to consider when doing fetch */
  depth?: number;
}

export interface PackageOptions {
  gitTags: boolean;
  disallowedChangeTypes: ChangeType[] | null;
  tag: string | null;
  defaultNpmTag: string;
  changeFilePrompt?: ChangeFilePromptOptions;
  /**
   * Disable publishing a particular package.
   * (Does NOT work to enable publishing a package that wouldn't otherwise be published.)
   */
  shouldPublish?: false | undefined;
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

  /**
   * Runs for each package, before writing changelog and package.json updates
   * to the filesystem. May be called multiple times during publish.
   */
  prebump?: (packagePath: string, name: string, version: string) => void | Promise<void>;

  /**
   * Runs for each package, after writing changelog and package.json updates
   * to the filesystem. May be called multiple times during publish.
   */
  postbump?: (packagePath: string, name: string, version: string) => void | Promise<void>;
}

export interface TransformOptions {
  /**
   * Runs for each of the filtered change files.
   *
   * This allows for adding or editing information to the change files
   * without having to modify anything on the disk.
   */
  changeFiles?: (changeInfo: ChangeInfo | ChangeInfoMultiple, changeFilePath: string) => ChangeInfo;
}

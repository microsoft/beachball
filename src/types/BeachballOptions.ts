import { AuthType } from './Auth';
import { ChangeInfo, ChangeInfoMultiple, ChangeType } from './ChangeInfo';
import { ChangeFilePromptOptions } from './ChangeFilePrompt';
import { ChangelogOptions } from './ChangelogOptions';
import { PackageInfos } from './PackageInfo';

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
  /**
   * For publish: If true, publish all newly added packages in addition to modified packages.
   * New packages *with change files* will always be published regardless of this option.
   *
   * (This has limited use unless you pushed new packages directly to the main branch, or
   * your PR build doesn't run `beachball check`. Otherwise, `beachball check` will require
   * change files to be created for the missing packages.)
   */
  new: boolean;
  package?: string | string[];
  /** Timeout for npm operations (other than install, which is expected to take longer) */
  timeout?: number;
  /** Timeout for `git push` operations */
  gitTimeout?: number;
  token?: string;
  type?: ChangeType | null;
  verbose?: boolean;
  version?: boolean;
  yes: boolean;
}

export interface RepoOptions {
  /**
   * Access level for npm publish
   * @default 'restricted'
   */
  access: 'public' | 'restricted';
  /**
   * The target branch. In the repo or CLI config, this can be specified without a remote name
   * as long as `repository` is set in `package.json` to allow inferring the correct remote.
   *
   * (In the resolved config used internally, the remote name should *usually* be included,
   * unless neither a remote name nor `package.json` `repository` was specified.)
   * @default 'origin/master'
   */
  branch: string;
  /**
   * Bump dependent packages during publish (bump A if A depends on B)
   * @default true
   */
  bumpDeps: boolean;
  /** Options for customizing change file prompt. */
  changeFilePrompt?: ChangeFilePromptOptions;
  /**
   * Hint message for when change files are not detected but required
   * @default 'Run "beachball change" to create a change file'
   */
  changehint: string;
  /** Options for customizing changelog rendering */
  changelog?: ChangelogOptions;
  /**
   * The default dist-tag used for npm publish
   * @default 'latest'
   */
  defaultNpmTag: string;
  /** What change types are disallowed */
  disallowedChangeTypes: ChangeType[] | null;
  /**
   * Fetch from remote before doing diff comparisons
   * @default true
   */
  fetch: boolean;
  /**
   * Whether to generate changelog files
   * @default true
   */
  generateChangelog: boolean;
  /** Options for bumping package versions together */
  groups?: VersionGroupOptions[];
  /**
   * Whether to create git tags for published packages
   * @default true
   */
  gitTags: boolean;
  /** Custom pre/post publish actions */
  hooks?: HooksOptions;
  /** Ignore changes in these files (minimatch patterns; negations not supported) */
  ignorePatterns?: string[];
  /** For the `change` command, change message. For the `publish` command, commit message. */
  message: string;
  /**
   * The directory to run beachball in
   * @default process.cwd()
   */
  path: string;
  /** Prerelease prefix for packages that are specified to receive a prerelease bump */
  prereleasePrefix?: string | null;
  /**
   * Whether to publish to the npm registry
   * @default true
   */
  publish: boolean;
  /**
   * Whether to push to the remote git branch when publishing
   * @default true
   */
  push: boolean;
  /**
   * Target npm registry for publishing
   * @default 'https://registry.npmjs.org/'
   */
  registry: string;
  /**
   * Number of retries for a package publish before failing
   * @default 3
   */
  retries: number;
  /** Filters paths that beachball uses to find packages */
  scope?: string[] | null;
  /**
   * npm dist-tag when publishing
   * @default 'latest'
   */
  tag: string;
  /** Transformations for change files */
  transform?: TransformOptions;
  /** Put multiple changes in a single changefile */
  groupChanges?: boolean;
  /** For shallow clones only: Depth of git history to consider when doing fetch */
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

/**
 * Options for bumping package versions together.
 */
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
   *
   * @param packagePath The path to the package directory
   * @param name The name of the package as defined in package.json
   * @param version The post-bump version of the package to be published
   * @param packageInfos Metadata about other packages processed by Beachball. Computed post-bump. Readonly.
   */
  prepublish?: (
    packagePath: string,
    name: string,
    version: string,
    packageInfos: Readonly<PackageInfos>
  ) => void | Promise<void>;

  /**
   * Runs for each package after the publish command.
   * Any file changes made in this step will **not** be committed automatically.
   *
   * @param packagePath The path to the package directory
   * @param name The name of the package as defined in package.json
   * @param version The post-bump version of the package to be published
   * @param packageInfos Metadata about other packages processed by Beachball. Computed post-bump. Readonly.
   */
  postpublish?: (
    packagePath: string,
    name: string,
    version: string,
    packageInfos: Readonly<PackageInfos>
  ) => void | Promise<void>;

  /**
   * Runs for each package, before writing changelog and package.json updates
   * to the filesystem. May be called multiple times during publish.
   *
   * @param packagePath The path to the package directory
   * @param name The name of the package as defined in package.json
   * @param version The pre-bump version of the package to be published
   */
  prebump?: (packagePath: string, name: string, version: string) => void | Promise<void>;

  /**
   * Runs for each package, after writing changelog and package.json updates
   * to the filesystem. May be called multiple times during publish.
   *
   * @param packagePath The path to the package directory
   * @param name The name of the package as defined in package.json
   * @param version The post-bump version of the package to be published
   * @param packageInfos Metadata about other packages processed by Beachball. Computed post-bump. Readonly.
   */
  postbump?: (
    packagePath: string,
    name: string,
    version: string,
    packageInfos: Readonly<PackageInfos>
  ) => void | Promise<void>;

  /**
   * Runs once after all bumps to all packages before committing changes
   */
  precommit?: (cwd: string) => void | Promise<void>;
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

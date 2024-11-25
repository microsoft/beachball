import type { AuthType } from './Auth';
import type { ChangeInfo, ChangeInfoMultiple, ChangeType } from './ChangeInfo';
import type { ChangeFilePromptOptions } from './ChangeFilePrompt';
import type { ChangelogOptions } from './ChangelogOptions';
import type { PackageInfos } from './PackageInfo';

export type BeachballOptions = CliOptions & RepoOptions & PackageOptions;

export interface CliOptions
  extends Pick<
    RepoOptions,
    | 'access'
    | 'branch'
    | 'bump'
    | 'bumpDeps'
    | 'canaryName'
    | 'changehint'
    | 'changeDir'
    | 'commit'
    | 'concurrency'
    | 'depth'
    | 'disallowedChangeTypes'
    | 'disallowDeletedChangeFiles'
    | 'fetch'
    | 'fromRef'
    | 'gitTags'
    | 'gitTimeout'
    | 'keepChangeFiles'
    | 'message'
    | 'new'
    | 'path'
    | 'prereleasePrefix'
    | 'publish'
    | 'push'
    | 'registry'
    | 'retries'
    | 'scope'
    | 'tag'
    | 'timeout'
  > {
  all: boolean;
  authType: AuthType;
  command: string;
  configPath?: string;
  dependentChangeType?: ChangeType;
  /**
   * For sync: use the version from the registry even if it's older than local.
   */
  forceVersions?: boolean;
  help?: boolean;
  package?: string | string[];
  token?: string;
  type?: ChangeType | null;
  verbose?: boolean;
  version?: boolean;
  yes: boolean;

  // ONLY add new options here if they only make sense on the command line!
  // Most options should be defined in RepoOptions and added to the Pick<...> above.
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
   * Whether to bump versions during publish.
   * @default true
   */
  bump: boolean;
  /**
   * Bump dependent packages during publish: e.g. if B is bumped, and A depends on B, also bump A.
   * @default true
   */
  bumpDeps: boolean;
  canaryName?: string;
  /** Options for customizing change file prompt. */
  changeFilePrompt?: ChangeFilePromptOptions;
  /**
   * Hint message for when change files are not detected but required
   * @default 'Run "beachball change" to create a change file'
   */
  changehint: string;
  /**
   * Directory where change files are stored (relative to repo root).
   * @default 'change'
   */
  changeDir: string;
  /** Options for customizing changelog rendering */
  changelog?: ChangelogOptions;
  /**
   * If true, commit change files automatically after `beachball change`.
   * If false, only stage them.
   * @default true
   */
  commit?: boolean;
  /**
   * Maximum concurrency.
   * As of writing, concurrency only applies for calling hooks and publishing to npm.
   * @default 1
   */
  concurrency: number;
  /**
   * The default dist-tag used for npm publish
   * @default 'latest'
   */
  defaultNpmTag: string;
  /** What change types are disallowed */
  disallowedChangeTypes: ChangeType[] | null;
  disallowDeletedChangeFiles?: boolean;
  /**
   * Fetch from remote before doing diff comparisons
   * @default true
   */
  fetch: boolean;
  /**
   * Consider change files since this git ref (branch name, commit SHA, etc).
   */
  fromRef?: string;
  /**
   * Whether to generate changelog files.
   * - `'md'` (default) to generate only CHANGELOG.md
   * - `true` to generate both CHANGELOG.md and CHANGELOG.json
   * - `false` to skip changelog generation
   * - `'json'` to generate only CHANGELOG.json
   * @default 'md'
   */
  generateChangelog: boolean | 'md' | 'json';
  /** Options for bumping package versions together */
  groups?: VersionGroupOptions[];
  /**
   * Whether to create git tags for published packages
   * @default true
   */
  gitTags: boolean;
  /** Custom pre/post publish actions */
  hooks?: HooksOptions;
  /**
   * Ignore changes in these files (picomatch patterns; negations not supported).
   * Patterns are relative to the repo root and must use forward slashes.
   */
  ignorePatterns?: string[];
  keepChangeFiles?: boolean;
  /** For the `change` command, change message. For the `publish` command, commit message. */
  message: string;
  /**
   * The directory to run beachball in
   * @default process.cwd()
   */
  path: string;
  /** Prerelease prefix for packages that are specified to receive a prerelease bump */
  prereleasePrefix?: string | null;
  /** This is for prerelease. Set it to "0" for zero-based or "1" for one-based.
   *  Set it to false to omit the prerelease number.
   *  @default "0"
   */
  identifierBase?: '0' | '1' | false;
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
  /**
   * Only apply commands to package paths matching these picomatch patterns.
   * Patterns are relative to the monorepo root and must use forward slashes.
   *
   * Negations are supported: e.g. `['packages/foo/*', '!packages/foo/bar']`
   *
   * Note that if you have multiple sets of packages with different scopes,
   * `groupChanges` is not supported.
   */
  scope?: string[] | null;
  /**
   * npm dist-tag when publishing
   * @default 'latest'
   */
  tag: string;
  /** Timeout for npm operations (other than install, which is expected to take longer) */
  timeout?: number;
  /** Timeout for `git push` operations */
  gitTimeout?: number;
  /** Transformations for change files */
  transform?: TransformOptions;
  /** Put multiple changes in a single changefile */
  groupChanges?: boolean;
  /** For shallow clones only: Depth of git history to consider when doing fetch */
  depth?: number;
  /**
   * For publish: If true, publish all newly added packages in addition to modified packages.
   * This is rarely needed since new packages *with change files* will always be published
   * regardless of this option.
   *
   * (This has limited use unless you pushed new packages directly to the main branch, or
   * your PR build doesn't run `beachball check`. Otherwise, `beachball check` will require
   * change files to be created for the new packages.)
   */
  new: boolean;
}

export interface PackageOptions {
  gitTags: boolean;
  disallowedChangeTypes: ChangeType[] | null;
  tag: string | null;
  defaultNpmTag: string;
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
  /** name of the version group */
  name: string;

  /**
   * picomatch pattern(s) for package paths to include in this group.
   * Patterns are relative to the repo root and must use forward slashes.
   * If `true`, include all packages except those matching `exclude`.
   */
  include: string | string[] | true;

  /**
   * picomatch pattern(s) for package paths to exclude from this group.
   * Patterns are relative to the repo root and must use forward slashes.
   */
  exclude?: string | string[];

  disallowedChangeTypes: ChangeType[] | null;
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
  changeFiles?: (
    changeInfo: ChangeInfo | ChangeInfoMultiple,
    changeFilePath: string,
    context: {
      /** The beachball command that is being run when this transform is invoked. Can be used to selectively run the transform on a specific beachball command like "beachball change" */
      command: string;
    }
  ) => ChangeInfo;
}

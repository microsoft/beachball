import type { AuthType } from './Auth';
import type { ChangeInfo, ChangeInfoMultiple, ChangeType } from './ChangeInfo';
import type { ChangeFilePromptOptions } from './ChangeFilePrompt';
import type { ChangelogOptions } from './ChangelogOptions';
import type { PackageInfos } from './PackageInfo';

// TODO: this shouldn't include PackageOptions
export type BeachballOptions = CliOptions & RepoOptions & PackageOptions;

/** Separate options objects, returned for reuse in `getPackageInfos`. */
export interface ParsedOptions {
  /** Only the specified CLI options, plus the path and command */
  cliOptions: Partial<CliOptions> & Pick<CliOptions, 'path' | 'command'>;
  /** Merged repo-level options (includes repo, CLI, and defaults) */
  options: BeachballOptions;
}

export interface CliOptions
  extends Pick<
    RepoOptions,
    | 'access'
    | 'authType'
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
    | 'npmReadConcurrency'
    | 'packToPath'
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
  /** Consider all packages to have changed */
  all: boolean;
  command: string;
  configPath?: string;
  dependentChangeType?: ChangeType;
  /**
   * For sync: use the version from the registry even if it's older than local.
   */
  forceVersions?: boolean;
  help?: boolean;
  /** Force change files for these packages */
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
  authType: AuthType;
  /**
   * The target branch. In the repo or CLI config, this can be specified without a remote name
   * as long as `repository` is set in `package.json` to allow inferring the correct remote.
   *
   * This defaults to the default branch of the default remote.
   * - The default remote is the one matching `repository` in `package.json`, falling back to
   *   `upstream` if defined, the first defined remote, or `origin`.
   * - The default branch is the remote's default branch if defined, falling back to
   *   `git config init.defaultBranch` or `master`.
   *
   * (In the resolved config used internally, the remote name should *usually* be included,
   * unless neither a remote name nor `package.json` `repository` was specified.)
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
   * Maximum concurrency for write operations.
   * As of writing, this only applies for calling `hooks` and publishing to npm.
   * (See also `npmReadConcurrency`.)
   * @default 1
   */
  concurrency: number;
  /**
   * Maximum concurrency for fetching package versions/tags from the registry.
   * This should be a faster operation than publishing and can use a higher limit.
   * (See `concurrency` for write operations.)
   * @default 10
   */
  npmReadConcurrency: number;
  /**
   * The default dist-tag used for npm publish, if no other `tag` is specified.
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
   * - `true` (default) to generate both CHANGELOG.md and CHANGELOG.json
   * - `false` to skip changelog generation
   * - `'md'` to generate only CHANGELOG.md
   * - `'json'` to generate only CHANGELOG.json
   */
  generateChangelog: boolean | 'md' | 'json';
  /**
   * Options for bumping package versions together.
   * (For changelog groups, use `BeachballOptions.changelog.groups`.)
   */
  groups?: VersionGroupOptions[];
  /**
   * Whether to create git tags for published packages
   * @default true
   */
  gitTags: boolean;
  /** Custom pre/post publish actions */
  hooks?: HooksOptions;
  /**
   * Ignore changes in these files (minimatch patterns; negations not supported).
   * Patterns are relative to the repo root and must use forward slashes.
   */
  ignorePatterns?: string[];
  keepChangeFiles?: boolean;
  /** For the `change` command, change message. For the `publish` command, commit message. */
  message: string;
  /**
   * The directory to run beachball in.
   * This is assumed to be the project root (monorepo manager root or git root).
   *
   * In real usage, this will be an absolute path determined relative to `process.cwd()`.
   * In tests which don't use the filesystem, this may be an empty string or fake path.
   */
  path: string;
  /** Prerelease prefix for packages that are specified to receive a prerelease bump */
  prereleasePrefix?: string | null;
  /**
   * This is for prerelease. Set it to "0" for zero-based or "1" for one-based.
   * Set it to false to omit the prerelease number.
   * @default "0"
   */
  identifierBase?: '0' | '1' | false;
  /**
   * Whether to publish to the npm registry
   * @default true
   */
  publish: boolean;
  /**
   * If provided, pack packages to the specified path instead of publishing.
   * Implies `publish: false`.
   */
  packToPath?: string;
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
   * Only apply commands to package paths matching these minimatch patterns.
   * Patterns are relative to the monorepo root and must use forward slashes.
   *
   * Negations are supported: e.g. `['packages/foo/*', '!packages/foo/bar']`
   *
   * Note that if you have multiple sets of packages with different scopes,
   * `groupChanges` is not supported.
   */
  scope?: string[] | null;
  /**
   * npm dist-tag when publishing.
   * If not specified, uses `defaultNpmTag` (which defaults to `'latest'`).
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
   * @deprecated This option is not recommended because it will negatively impact perf (it requires
   * checking the registry for ALL unmodified packages). It also has limited use unless you pushed
   * new packages directly to the main branch, or your PR build doesn't run `beachball check`.
   * Normally, `beachball check` will require change files to be created for the new packages.
   */
  new: boolean;
}

export interface PackageOptions
  extends Partial<Pick<RepoOptions, 'gitTags' | 'disallowedChangeTypes' | 'defaultNpmTag'>> {
  tag?: string | null;
  /**
   * Disable publishing a particular package.
   * (Does NOT work to enable publishing a package that wouldn't otherwise be published.)
   */
  shouldPublish?: false;
}

/**
 * Options for bumping package versions together.
 *
 * For changelog groups, use `BeachballOptions.changelog.groups` (`ChangelogGroupOptions`).
 */
export interface VersionGroupOptions {
  /** name of the version group */
  name: string;

  /**
   * minimatch pattern(s) for package paths to include in this group.
   * Patterns are relative to the repo root and must use forward slashes.
   * If `true`, include all packages except those matching `exclude`.
   */
  include: string | string[] | true;

  /**
   * minimatch pattern(s) for package paths to exclude from this group.
   * Patterns are relative to the repo root and must use forward slashes.
   *
   * Currently this must use **negated patterns only**: e.g. if you want to exclude `packages/foo`,
   * you must specify `exclude` as `!packages/foo`. (This will be fixed in a future major version.)
   */
  exclude?: string | string[];

  /**
   * Disallowed change types for the group.
   * (If a package is in a group, it can't specify its own `disallowedChangeTypes`.)
   */
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
   * @param packageInfos Metadata about other packages processed by Beachball after bumping. Readonly.
   */
  prepublish?: (
    packagePath: string,
    name: string,
    version: string,
    // TODO: make all of these DeepReadonly
    packageInfos: Readonly<PackageInfos>
  ) => void | Promise<void>;

  /**
   * Runs for each package after the publish command.
   * Any file changes made in this step will **not** be committed automatically.
   *
   * @param packagePath The path to the package directory
   * @param name The name of the package as defined in package.json
   * @param version The post-bump version of the package to be published
   * @param packageInfos Metadata about other packages processed by Beachball after bumping. Readonly.
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
   * @param packageInfos Metadata about other packages processed by Beachball after bumping. Readonly.
   */
  postbump?: (
    packagePath: string,
    name: string,
    version: string,
    packageInfos: Readonly<PackageInfos>
  ) => void | Promise<void>;

  /**
   * Runs once after all bumps to all packages before committing changes
   * @param cwd The monorepo root path
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

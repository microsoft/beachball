import type { CliOptions } from '../types/BeachballOptions';

export type OptionType = 'string' | 'number' | 'boolean' | 'array';

/** Definition of a single CLI option, used to build its commander `Option`. */
export interface OptionDefinition {
  desc: string;
  /**
   * Single-character short flag (without dash), e.g. `b` for `--branch`.
   * For options with an alias, this is only applied to the alias variant of the option.
   */
  short?: string;
  /**
   * Extra long-flag alias (without dashes), e.g. `config` for the `configPath` option. When set,
   * the alias is shown in help *instead of* the canonical dashed name, but the value is still
   * stored under the canonical name.
   */
  alias?: string;
  /**
   * Value type. `'array'` is currently always a string array.
   * `'boolean'` values get a negated `--no-` form automatically when added via `addAllOptions`.
   * @default 'string'
   */
  type?: OptionType;
  /** Valid choices, such as for `disallowedChangeTypes` (string or array options only). */
  choices?: string[];
  /** Omit the default option from `getDefaultOptions` from the help text. */
  omitDefault?: boolean;
}

/**
 * Single source of truth for every parseable CLI option: its type, description, short flag, and
 * optional long-flag alias. TypeScript enforces (via the `Record<Exclude<...>>` type) that every
 * `CliOptions` key except the ones filled in elsewhere has an entry here.
 */
export const optionDefinitions: Record<
  Exclude<keyof CliOptions, 'path' | 'command' | '_extraPositionalArgs' | 'version' | 'help'>,
  OptionDefinition
> = {
  // array options
  disallowedChangeTypes: { type: 'array', desc: 'change types that are not allowed' },
  package: {
    type: 'array',
    short: 'p',
    desc: 'force creating a change file for this package (can be specified multiple times)',
  },
  scope: {
    type: 'array',
    desc: 'only consider package paths matching this pattern (can be specified multiple times; supports negations)',
  },
  // boolean options
  all: { type: 'boolean', desc: 'generate change files for all packages' },
  bump: { type: 'boolean', desc: 'bump versions during publish' },
  bumpDeps: { type: 'boolean', desc: 'bump dependent packages during publish' },
  commit: { type: 'boolean', desc: 'commit change files after "change"' },
  disallowDeletedChangeFiles: {
    type: 'boolean',
    desc: 'verify that no change files were deleted between head and target branch',
  },
  fetch: { type: 'boolean', desc: 'fetch from the remote before determining changes' },
  forceVersions: {
    type: 'boolean',
    alias: 'force',
    desc: "for 'sync': use the version from the registry even if it's older than local",
  },
  gitTags: { type: 'boolean', desc: 'create git tags for each published package version' },
  keepChangeFiles: { type: 'boolean', desc: "don't delete the change files from disk after bumping" },
  publish: { type: 'boolean', desc: 'publish to the npm registry' },
  push: { type: 'boolean', desc: 'push changes back to the remote git branch' },
  verbose: { type: 'boolean', desc: 'print additional information to the console' },
  yes: { type: 'boolean', short: 'y', desc: 'skip the confirmation prompts' },
  // number options
  concurrency: { type: 'number', desc: 'maximum concurrency for write operations such as publishing' },
  depth: { type: 'number', desc: 'for shallow clones: depth of git history to consider when fetching' },
  npmReadConcurrency: {
    type: 'number',
    desc: 'maximum concurrency for reading package versions from the registry',
  },
  gitTimeout: { type: 'number', desc: 'timeout in ms for git push operations' },
  retries: { type: 'number', desc: 'number of retries for an npm publish before failing' },
  timeout: { type: 'number', desc: 'timeout in ms for npm operations (other than install)' },
  // string options
  access: { desc: 'npm publish access level: "public" or "restricted"' },
  authType: { short: 'a', desc: 'npm auth type for NPM_TOKEN: "authtoken" or "password"' },
  branch: { short: 'b', desc: 'target branch from remote (default: git config init.defaultBranch)', omitDefault: true },
  canaryName: { desc: 'dist-tag and version name to use for canary publishes' },
  changehint: { desc: 'customized hint message shown when a change file is needed but missing' },
  changeDir: { desc: 'name of the directory to store change files' },
  configPath: {
    short: 'c',
    alias: 'config',
    desc: 'custom beachball config path (default: cosmiconfig standard paths)',
  },
  dependentChangeType: { desc: 'change type to use for dependent packages (default: patch)' },
  fromRef: { alias: 'since', desc: 'consider changes or change files since this git ref (branch name, commit SHA)' },
  message: { short: 'm', desc: 'for "change", the change description; for "publish", the commit message' },
  packToPath: { desc: 'pack packages to tgz files under this path instead of publishing to npm' },
  prereleasePrefix: { desc: 'prerelease prefix for packages that will receive a prerelease bump' },
  registry: { short: 'r', desc: 'npm registry' },
  tag: { short: 't', desc: 'npm dist-tag for publishes (default: "latest")', omitDefault: true },
  token: { short: 'n', desc: 'npm auth token (defaults to the NPM_TOKEN environment variable)' },
  type: { desc: 'type of change: e.g. major, minor, patch, none (instead of prompting)' },
};

import { SortedChangeTypes } from '../changefile/changeTypes';
import type { CliOptions } from '../types/BeachballOptions';
import { authTypes } from '../validation/isValidAuthType';

export type OptionDefinitions = Partial<Record<keyof CliOptions, OptionDefinition>>;

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
   * stored under the canonical name, and the canonical name is also accepted as a CLI option.
   */
  alias?: string;
  /**
   * Value type. `'array'` is currently always a string array.
   * `'boolean'` values get a negated `--no-` form automatically when added via `addAllOptions`.
   * @default 'string'
   */
  type?: OptionType;
  /** Valid choices, such as for `disallowedChangeTypes` (string or array options only). */
  choices?: readonly string[];
  /** Custom argument parser/validator */
  parse?: (value: unknown, previous: unknown) => unknown;
}

/** All CLI options. */
export const optionDefinitions: Record<
  Exclude<keyof CliOptions, 'path' | 'command' | '_extraPositionalArgs'>,
  OptionDefinition
> = {
  // migrate may read options but doesn't need any CLI options besides configPath

  // logging
  verbose: { type: 'boolean', desc: 'print additional information to the console' },

  // everything but init
  configPath: {
    short: 'c',
    alias: 'config',
    desc: 'custom beachball config path (default: cosmiconfig standard paths)',
  },

  // git options (validation and comparison)
  branch: { short: 'b', desc: 'target branch from remote (default: the default remote branch)' },
  fromRef: { alias: 'since', desc: 'consider changes or change files since this git ref (branch name, commit SHA)' },
  fetch: { type: 'boolean', desc: 'fetch from the remote before determining changes' },
  depth: { type: 'number', desc: 'for shallow clones: depth of git history to consider when fetching' },

  // Validation and comparison options
  disallowedChangeTypes: { type: 'array', desc: 'change types that are not allowed', choices: SortedChangeTypes },
  disallowDeletedChangeFiles: {
    type: 'boolean',
    desc: 'verify that no change files were deleted between head and target branch',
  },
  changehint: { desc: 'customized hint message shown when a change file is needed but missing' },
  changeDir: { desc: 'name of the directory to store change files' },

  // bump/publish but also used by bumpInMemory (potential validation)
  bumpDeps: { type: 'boolean', desc: 'bump dependent packages during publish' },
  prereleasePrefix: { desc: 'prerelease prefix for packages that will receive a prerelease bump' },

  // scoping?
  scope: { type: 'array', desc: 'only consider package paths matching the pattern(s) (supports "!negations")' },
  // should be an error if specified where not supported
  all: { type: 'boolean', desc: 'generate change files for all packages' },
  // should be an error if specified where not supported
  package: { type: 'array', short: 'p', desc: 'force creating a change file for the specified package(s)' },

  // publish/canary/sync; also init fetches beachball from the registry
  timeout: { type: 'number', desc: 'timeout in ms for npm operations (other than install)' },
  registry: { short: 'r', desc: 'npm registry' },
  token: { short: 'n', desc: 'npm auth token (defaults to the NPM_TOKEN environment variable)' },
  tag: { short: 't', desc: 'npm dist-tag for publishing and comparison (default: defaultNpmTag or "latest")' },
  npmReadConcurrency: { type: 'number', desc: 'maximum concurrency for reading package versions from the registry' },

  // publish only
  bump: { type: 'boolean', desc: 'bump versions during publish' },
  publish: { type: 'boolean', desc: 'publish to the npm registry' },
  push: { type: 'boolean', desc: 'push changes back to the remote git branch' },
  yes: { type: 'boolean', short: 'y', desc: 'skip publish confirmation prompts (default: true in CI, false locally)' },
  gitTimeout: { type: 'number', desc: 'timeout in ms for git push operations' },
  retries: { type: 'number', desc: 'number of retries for an npm publish before failing' },
  access: { desc: 'npm publish access level', choices: ['public', 'restricted'] },
  authType: { short: 'a', desc: 'npm auth type for NPM_TOKEN', choices: authTypes },
  gitTags: { type: 'boolean', desc: 'create git tags for each published package version' },
  packToPath: { desc: 'pack packages to tgz files under this path instead of publishing to npm' },

  // change/publish with different description
  message: { short: 'm', desc: 'for "change", the change description; for "publish", the commit message' },

  // change only
  type: { desc: 'type of change (instead of prompting)', choices: SortedChangeTypes },
  dependentChangeType: {
    desc: 'change type to use for dependent packages (default: patch)',
    choices: SortedChangeTypes,
  },
  commit: { type: 'boolean', desc: 'commit change files after "change"' },

  // sync only
  forceVersions: {
    type: 'boolean',
    alias: 'force',
    desc: "use the version from the registry even if it's older than local",
  },

  // bump/publish only
  keepChangeFiles: { type: 'boolean', desc: "don't delete the change files from disk after bumping" },

  // bump/publish/canary only
  concurrency: { type: 'number', desc: 'maximum concurrency for write operations (hook calls, npm publish)' },

  // canary only
  canaryName: { desc: 'dist-tag and version name to use for canary publishes' },
};

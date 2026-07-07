import { SortedChangeTypes } from '../changefile/changeTypes';
import type { CliOptions } from '../types/BeachballOptions';
import { authTypes } from '../validation/isValidAuthType';
import { allCommandNames, type CommandName } from './commandDefinitions';

export type OptionDefinitions = Partial<Record<keyof CliOptions, OptionDefinition>>;

export type OptionType = 'string' | 'number' | 'boolean' | 'array';

/**
 * Help group names for options (pass to `option.helpGroup()`).
 *
 * The ordering of entries is used to determine the order of sections in help output.
 */
export const optionGroups = {
  default: 'Options:',
  npm: 'npm options:',
  /** Non-logging options shared between all/most commands */
  common: 'Common options:',
};
export type OptionGroup = keyof typeof optionGroups;

/** Definition of a single CLI option, used to build its commander `Option`. */
export interface OptionDefinition {
  desc: string | ((cmdName: string | undefined) => string);
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
  group?: OptionGroup;
  /** Valid choices, such as for `disallowedChangeTypes` (string or array options only). */
  choices?: readonly string[];
  /** Conflicting option names */
  conflicts?: readonly (keyof CliOptions)[];
  /** Custom argument parser/validator */
  parse?: (value: unknown, previous: unknown) => unknown;
  /**
   * Only show the option in help for the specified commands, or `true` for all commands.
   * Use `defaultCommands` for options that apply to all the "full" commands.
   */
  commands: readonly CommandName[] | true;
}

type OptionNoCommands = Omit<OptionDefinition, 'commands'> & Partial<OptionDefinition>;

/** Add `group` and/or `commands` to a subset of options */
export function makeOptions<K extends keyof CliOptions>(
  group: OptionGroup,
  commands: OptionDefinition['commands'],
  opts: Record<K, OptionNoCommands>
): Record<K, OptionDefinition>;
export function makeOptions<K extends keyof CliOptions>(
  commands: OptionDefinition['commands'],
  opts: Record<K, OptionNoCommands>
): Record<K, OptionDefinition>;
export function makeOptions<K extends keyof CliOptions>(
  groupOrCommands: OptionGroup | OptionDefinition['commands'],
  commandsOrOpts: Record<K, OptionNoCommands> | OptionDefinition['commands'],
  opts?: Record<K, OptionNoCommands>
): Record<K, OptionDefinition> {
  const group = typeof groupOrCommands === 'string' ? groupOrCommands : undefined;
  const commands =
    typeof groupOrCommands === 'string' ? (commandsOrOpts as OptionDefinition['commands']) : groupOrCommands;
  opts ??= commandsOrOpts as Record<K, OptionNoCommands>;

  for (const opt of Object.values(opts) as OptionDefinition[]) {
    group && (opt.group ??= group);
    opt.commands ??= commands;
  }
  return opts as Record<K, OptionDefinition>;
}

/** Commands which should show most options */
const defaultCommands = ['change', 'check', 'bump', 'publish', 'canary'] as const;

const nonInitCommands = allCommandNames.filter(cmd => cmd !== 'init');

/** All CLI options. */
export const optionDefinitions: Record<
  Exclude<keyof CliOptions, 'path' | 'command' | '_extraPositionalArgs'>,
  OptionDefinition
> = {
  configPath: {
    commands: nonInitCommands,
    group: 'common',
    short: 'c',
    alias: 'config',
    desc: 'custom beachball config path (default: cosmiconfig standard paths)',
  },
  verbose: { group: 'common', commands: true, type: 'boolean', desc: 'print additional information to the console' },

  // git options (validation and comparison)
  ...makeOptions(defaultCommands, {
    branch: { short: 'b', desc: 'target branch from remote (default: the default remote branch)' },
    fromRef: { alias: 'since', desc: 'consider changes or change files since this git ref (branch name, commit SHA)' },
    fetch: { type: 'boolean', desc: 'fetch from the remote before determining changes' },
    depth: { type: 'number', desc: 'for shallow clones: depth of git history to consider when fetching' },

    // Validation and comparison options
    disallowedChangeTypes: { type: 'array', desc: 'change types that are not allowed', choices: SortedChangeTypes },
  }),
  disallowDeletedChangeFiles: {
    commands: ['change', 'check'],
    type: 'boolean',
    desc: 'verify that no change files were deleted between head and target branch',
  },
  changehint: { commands: ['check'], desc: 'customized hint message shown when a change file is needed but missing' },
  changeDir: { commands: defaultCommands, desc: 'name of the directory to store change files' },

  // bumpDeps/prereleasePrefix are also used by bumpInMemory
  // (bumpDeps might impact validation but probably doesn't need to show in help)
  ...makeOptions(['bump', 'publish'], {
    bumpDeps: { type: 'boolean', desc: 'bump dependent packages during publish' },
    prereleasePrefix: { desc: 'prerelease prefix for packages that will receive a prerelease bump' },
    keepChangeFiles: { type: 'boolean', desc: "don't delete the change files from disk after bumping" },
  }),

  // scoping?
  scope: {
    commands: [...defaultCommands, 'sync'],
    type: 'array',
    desc: 'only consider package paths matching the pattern(s) (supports "!negations")',
  },
  all: {
    commands: ['change', 'canary'],
    type: 'boolean',
    desc: cmd =>
      (cmd === 'change' && 'generate change files for all packages') ||
      (cmd === 'canary' && 'publish prerelease versions of all packages') ||
      'apply command to all packages',
  },
  package: {
    type: 'array',
    short: 'p',
    commands: ['change'],
    conflicts: ['all'],
    desc: 'force creating a change file for the specified package(s)',
  },

  // npm read or write; also init fetches beachball from the registry
  ...makeOptions('npm', ['publish', 'canary', 'sync', 'init'], {
    registry: { short: 'r', desc: 'npm registry' },
    token: { short: 'n', desc: 'npm auth token (prefer using NPM_TOKEN environment variable)' },
    authType: { short: 'a', desc: 'npm auth type for NPM_TOKEN', choices: authTypes },
    npmReadConcurrency: { type: 'number', desc: 'maximum concurrency for reading package versions from the registry' },
    timeout: { type: 'number', desc: 'timeout in ms for npm operations (other than install)' },
    // TODO sort of npm group but semantically different
    tag: {
      short: 't',
      desc: cmd =>
        `npm dist-tag ${cmd === 'sync' ? 'to sync with' : 'for publishing'} ` +
        `(default: ${cmd === 'canary' ? 'canaryName or "canary"' : 'defaultNpmTag or "latest"'})`,
      commands: ['publish', 'canary', 'sync'],
    },
  }),

  ...makeOptions('npm', ['publish', 'canary'], {
    access: { desc: 'npm publish access level', choices: ['public', 'restricted'] },
    retries: { type: 'number', desc: 'number of retries for an npm publish before failing' },
    packToPath: { desc: 'pack packages to tgz files under this path instead of publishing to npm' },
  }),

  ...makeOptions(['publish'], {
    bump: { type: 'boolean', desc: 'bump versions during publish' },
    publish: { type: 'boolean', desc: 'publish to the npm registry' },
    push: { type: 'boolean', desc: 'push changes back to the remote git branch' },
    yes: {
      type: 'boolean',
      short: 'y',
      desc: 'skip publish confirmation prompts (default: true in CI, false locally)',
    },
    gitTimeout: { type: 'number', desc: 'timeout in ms for git push operations' },
    gitTags: { type: 'boolean', desc: 'create git tags for each published package version' },
  }),

  message: {
    short: 'm',
    commands: ['change', 'publish'],
    desc: cmd =>
      (cmd === 'change' && 'the change description') ||
      (cmd === 'publish' && 'version bump commit description') ||
      'change description or commit description',
  },

  ...makeOptions(['change'], {
    type: { desc: 'type of change (instead of prompting)', choices: SortedChangeTypes },
    dependentChangeType: {
      desc: 'change type to use for dependent packages (default: patch)',
      choices: SortedChangeTypes,
    },
    commit: { type: 'boolean', desc: 'commit change files after "change"' },
  }),

  forceVersions: {
    commands: ['sync'],
    type: 'boolean',
    alias: 'force',
    desc: "use the version from the registry even if it's older than local",
  },

  concurrency: {
    commands: ['bump', 'publish', 'canary'],
    type: 'number',
    desc: 'maximum concurrency for write operations (hook calls, npm publish)',
  },

  canaryName: { commands: ['canary'], desc: 'dist-tag and version name to use for canary publishes' },
};

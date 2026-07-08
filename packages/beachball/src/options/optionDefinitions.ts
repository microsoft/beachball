import { SortedChangeTypes } from '../changefile/changeTypes';
import type { CliOptions } from '../types/BeachballOptions';
import { authTypes } from '../validation/isValidAuthType';
import type { CommandName } from './commandDefinitions';

export type OptionDefinitions = Partial<Record<keyof CliOptions, OptionDefinition>>;

export type OptionType = 'string' | 'number' | 'boolean' | 'array';

/**
 * Help group names for options (pass to `option.helpGroup()`).
 * The order of keys determines section order in help output.
 */
export const optionGroups = {
  /** Primary options for a command (membership is command-specific) */
  primary: 'Options:',
  /** Git options for detecting which packages changed */
  detection: 'Change detection options:',
  /** Options for filtering/selecting which packages to operate on */
  filtering: 'Package filtering options:',
  /** Options controlling change file validation */
  validation: 'Validation options:',
  /** Options controlling how versions are bumped */
  versioning: 'Versioning options:',
  npm: 'npm options:',
  /** Less commonly used options */
  advanced: 'Advanced options:',
  /** Non-logging options shared between all/most commands */
  common: 'Common options:',
};
export type OptionGroup = keyof typeof optionGroups;

/** Definition of a single CLI option, used to build its commander `Option`. */
export interface OptionDefinition {
  /** Option description for help */
  desc: string | ((subcommand: string | undefined) => string);

  /** Help group for the option (single or command-specific). */
  group: OptionGroup | ((subcommand: string | undefined) => OptionGroup);

  /**
   * Only show the option in help for the specified commands.
   * Use `defaultCommands` for options that apply to all the "full" commands.
   */
  commands: readonly CommandName[] | ((subcommand: string | undefined) => boolean);

  /**  Single-character short flag (without dash), e.g. `b` for `--branch`. */
  short?: string;
  /**
   * Extra long-flag alias (without dashes), e.g. `config` for the `configPath` option. When set,
   * the alias is shown in help *instead of* the canonical dashed name, but the value is still
   * stored under the canonical name, and the canonical name is also accepted as a CLI option.
   */
  alias?: string;
  /**
   * Value type. `'array'` is currently always a string array.
   * `'boolean'` values get a negated `--no-` form automatically when added via `BeachballCommand`.
   * @default 'string'
   */
  type?: OptionType;
  /** Valid choices, such as for `disallowedChangeTypes` (string or array options only). */
  choices?: readonly string[];
  /** Conflicting option names */
  conflicts?: readonly (keyof CliOptions)[];
  /** Custom argument parser/validator */
  parse?: (value: unknown, previous: unknown) => unknown;
}

type OptionNoCommands = Omit<OptionDefinition, 'commands'> & Partial<OptionDefinition>;
type OptionNoCommandsGroup = Omit<OptionDefinition, 'commands' | 'group'> & Partial<OptionDefinition>;

/** Add `group` and/or `commands` to a subset of options */
export function makeOptions<K extends keyof CliOptions>(
  group: OptionGroup,
  commands: OptionDefinition['commands'],
  opts: Record<K, OptionNoCommandsGroup>
): Record<K, OptionDefinition>;
export function makeOptions<K extends keyof CliOptions>(
  commands: OptionDefinition['commands'],
  opts: Record<K, OptionNoCommands>
): Record<K, OptionDefinition>;
export function makeOptions<K extends keyof CliOptions>(
  groupOrCommands: OptionGroup | OptionDefinition['commands'],
  commandsOrOpts: Record<K, OptionNoCommands> | OptionDefinition['commands'],
  opts?: Record<K, OptionNoCommandsGroup>
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

/** All CLI options. */
export const optionDefinitions: Record<
  Exclude<keyof CliOptions, 'path' | 'command' | '_extraPositionalArgs'>,
  OptionDefinition
> = {
  configPath: {
    commands: cmd => cmd !== 'init',
    group: 'common',
    short: 'c',
    alias: 'config',
    desc: 'custom beachball config path (default: cosmiconfig standard paths)',
  },
  verbose: {
    commands: () => true,
    group: 'common',
    type: 'boolean',
    desc: 'print additional information to the console',
  },

  // git options for detecting which packages changed (and comparison)
  ...makeOptions(defaultCommands, {
    branch: { group: 'detection', short: 'b', desc: 'target branch from remote (default: the default remote branch)' },
    fromRef: {
      group: 'detection',
      alias: 'since',
      desc: cmd =>
        `consider ${cmd === 'check' || cmd === 'change' ? 'changes' : 'change files'} since this git ref (branch name, commit SHA)`,
    },
    fetch: { group: 'detection', type: 'boolean', desc: 'fetch from the remote before determining changes' },
    depth: {
      group: 'detection',
      type: 'number',
      desc: 'for shallow clones: depth of git history to consider when fetching',
    },
    disallowedChangeTypes: {
      group: 'validation',
      type: 'array',
      desc: 'change types that are not allowed',
      choices: SortedChangeTypes,
    },
  }),
  disallowDeletedChangeFiles: {
    commands: ['change', 'check'],
    group: 'validation',
    type: 'boolean',
    desc: 'verify that no change files were deleted between head and target branch',
  },
  changehint: {
    commands: ['check'],
    group: 'primary',
    desc: 'customized hint message shown when a change file is needed but missing',
  },
  changeDir: { commands: defaultCommands, group: 'advanced', desc: 'directory name or path to store change files' },

  // Versioning options (primary for `bump`, secondary for `publish`).
  // bumpDeps/prereleasePrefix are also used by bumpInMemory.
  ...makeOptions(['bump', 'publish'], {
    bumpDeps: {
      group: cmd => (cmd === 'bump' ? 'primary' : 'versioning'),
      type: 'boolean',
      desc: 'bump packages that depend on changed packages',
    },
    prereleasePrefix: {
      group: cmd => (cmd === 'bump' ? 'primary' : 'versioning'),
      desc: 'prerelease prefix for packages that will receive a prerelease bump',
    },
    keepChangeFiles: {
      group: cmd => (cmd === 'bump' ? 'primary' : 'versioning'),
      type: 'boolean',
      desc: "don't delete the change files from disk after bumping",
    },
  }),

  // Package filtering (primary for `sync`, secondary elsewhere)
  scope: {
    commands: [...defaultCommands, 'sync'],
    group: cmd => (cmd === 'sync' ? 'primary' : 'filtering'),
    type: 'array',
    desc: 'only consider package paths matching the pattern(s) (supports "!negations")',
  },

  // Change file content options (primary for the `change` command, ordered by likelihood of use)
  message: {
    short: 'm',
    commands: ['change', 'publish'],
    group: 'primary',
    desc: cmd =>
      (cmd === 'change' && 'the change description') ||
      (cmd === 'publish' && 'version bump commit description') ||
      'change description or commit description',
  },
  type: {
    commands: ['change'],
    group: 'primary',
    desc: 'type of change (instead of prompting)',
    choices: SortedChangeTypes,
  },
  package: {
    type: 'array',
    short: 'p',
    commands: ['change'],
    group: 'primary',
    conflicts: ['all'],
    desc: 'force creating a change file for the specified package(s)',
  },
  all: {
    commands: ['change', 'canary'],
    group: 'filtering',
    type: 'boolean',
    desc: cmd =>
      (cmd === 'change' && 'generate change files for all packages') ||
      (cmd === 'canary' && 'publish prerelease versions of all packages') ||
      'apply command to all packages',
  },
  commit: { commands: ['change'], group: 'primary', type: 'boolean', desc: 'commit change files after "change"' },
  dependentChangeType: {
    commands: ['change'],
    group: 'primary',
    desc: 'change type to use for dependent packages (default: patch)',
    choices: SortedChangeTypes,
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

  // Publish action options (primary for the `publish` command)
  ...makeOptions(['publish'], {
    bump: { group: 'primary', type: 'boolean', desc: 'bump versions during publish' },
    publish: { group: 'primary', type: 'boolean', desc: 'publish to the npm registry' },
    push: { group: 'primary', type: 'boolean', desc: 'push changes back to the remote git branch' },
    yes: {
      group: 'primary',
      type: 'boolean',
      short: 'y',
      desc: 'skip publish confirmation prompts (default: true in CI, false locally)',
    },
    gitTimeout: { group: 'primary', type: 'number', desc: 'timeout in ms for git push operations' },
    gitTags: { group: 'primary', type: 'boolean', desc: 'create git tags for each published package version' },
  }),

  forceVersions: {
    commands: ['sync'],
    group: 'primary',
    type: 'boolean',
    alias: 'force',
    desc: "use the version from the registry even if it's older than local",
  },
  concurrency: {
    commands: ['bump', 'publish', 'canary'],
    group: 'advanced',
    type: 'number',
    desc: 'maximum concurrency for write operations (hook calls, npm publish)',
  },
  canaryName: {
    commands: ['canary'],
    group: 'primary',
    desc: 'dist-tag and version name to use for canary publishes',
  },
};

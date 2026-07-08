export interface CommandDefinition {
  desc: string;
  /** Extra description shown in command help, appended to the main description (no newline). */
  extraDesc?: string;
  /** If true, this command runs when no command name is given (e.g. `change`). */
  isDefault?: boolean;
  /** If true, the command is omitted from the top-level help listing. */
  hidden?: boolean;
  /**
   * Mapping from positional argument syntax to description, in order specified.
   * e.g. `{ '<name>': 'the name of the config setting' }`
   */
  args?: Record<string, string>;
  /** Nested subcommands, e.g. `get`/`list` under `config`. */
  subcommands?: Record<string, CommandDefinition>;
}

/** Main subcommand names */
export type MainCommandName =
  'change' | 'check' | 'bump' | 'publish' | 'sync' | 'config' | 'init' | 'canary' | 'migrate';

/** All subcommand names including nested */
export type CommandName = MainCommandName | 'config get' | 'config list';

const changeExtra = 'Considers committed and staged changes, but not unstaged or untracked changes.';

export const commandDefinitions: Record<MainCommandName, CommandDefinition> = {
  change: {
    desc: 'Create change file(s) for this branch if needed',
    extraDesc:
      changeExtra +
      '\n\nBy default, an interactive prompt is used to choose the type and message for each changed package. ' +
      'Use --message and --type (and optionally --package) to skip the prompt. ' +
      'For help choosing a change type, see https://microsoft.github.io/beachball/concepts/change-types',
    isDefault: true,
  },
  check: { desc: 'Check whether change file(s) are needed for this branch', extraDesc: changeExtra },
  publish: { desc: 'Bump, publish to npm registry, and push updates back to the target branch' },
  bump: { desc: "Bump versions and generate changelogs, but don't commit or publish" },
  sync: {
    desc: 'Synchronize package versions from the registry with local package.json versions',
  },
  config: {
    desc: 'Get or list config settings (requires a sub-command)',
    subcommands: {
      get: {
        desc: 'Get the value of a config setting (with any overrides)',
        args: { '<name>': 'beachball config setting name' },
      },
      list: { desc: 'List all config settings (with any overrides)' },
    },
  },
  migrate: { desc: 'Help to migrate from beachball v2' },
  canary: { desc: 'Publish prerelease versions of changed or all packages without committing' },
  init: {
    desc: 'Initialize a new beachball config file in the current directory',
    hidden: true,
  },
};

const extraCommandNames = Object.keys({
  'config get': true,
  'config list': true,
} satisfies Record<Exclude<CommandName, MainCommandName>, true>);

/** All command names including nested */
export const allCommandNames = [...Object.keys(commandDefinitions), ...extraCommandNames] as readonly CommandName[];

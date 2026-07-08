export interface CommandDefinition {
  desc: string;
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

export const commandDefinitions: Record<MainCommandName, CommandDefinition> = {
  change: { desc: 'Create change files for this branch', isDefault: true },
  check: { desc: 'Check whether a change file is needed for this branch' },
  bump: { desc: "Bump versions and generate changelogs, but don't commit or publish" },
  publish: { desc: 'Bump, publish to npm registry, and push updates back to the target branch' },
  canary: { desc: 'Publish prerelease versions of changed or all packages without committing', hidden: true },
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
  init: {
    desc: 'Initialize a new beachball config file in the current directory',
    hidden: true,
  },
  migrate: {
    desc: 'Help to migrate from beachball v2',
    hidden: true,
  },
};

const extraCommandNames = Object.keys({
  'config get': true,
  'config list': true,
} satisfies Record<Exclude<CommandName, MainCommandName>, true>);

/** All command names including nested */
export const allCommandNames = [...Object.keys(commandDefinitions), ...extraCommandNames] as readonly CommandName[];

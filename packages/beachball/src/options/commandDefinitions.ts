export interface CommandDefinition {
  desc: string;
  /** If true, this command runs when no command name is given (e.g. `change`). */
  isDefault?: boolean;
  /** If true, the command is omitted from the top-level help listing. */
  hidden?: boolean;
  /**
   * Positional argument syntax for the command, e.g. `<name>` for `config get <name>`.
   * (Only used for commands/subcommands that take positional args.)
   */
  args?: string;
  /** Nested subcommands, e.g. `get`/`list` under `config`. */
  subcommands?: Record<string, CommandDefinition>;
}

/** Main subcommand names */
export type MainCommandName =
  'change' | 'check' | 'bump' | 'publish' | 'sync' | 'config' | 'init' | 'canary' | 'migrate';

/** All subcommand names including nested */
export type CommandName = MainCommandName | 'config get' | 'config list';

export const commandDefinitions: Record<MainCommandName, CommandDefinition> = {
  change: { desc: 'create change files for this branch', isDefault: true },
  check: { desc: 'check whether a change file is needed for this branch' },
  bump: { desc: "bump versions and generate changelogs, but don't commit or publish" },
  publish: { desc: 'bump, publish to npm registry, and push updates back to the target branch' },
  canary: { desc: 'publish prerelease versions of changed or all packages without committing', hidden: true },
  sync: {
    desc: 'synchronize package versions from the registry with local package.json versions',
  },
  config: {
    desc: 'get or list config settings (requires a sub-command)',
    subcommands: {
      get: { desc: 'get the value of a config setting (with any overrides)', args: '<name>' },
      list: { desc: 'list all config settings (with any overrides)' },
    },
  },
  init: {
    desc: 'initialize a new beachball config file in the current directory',
    hidden: true,
  },
  migrate: {
    desc: 'help to migrate from beachball v2',
    hidden: true,
  },
};

/** Main subcommand names */
export const mainCommandNames = Object.keys(commandDefinitions) as readonly MainCommandName[];
/** All subcommand names including nested */
export const allCommandNames: readonly CommandName[] = [...mainCommandNames, 'config get', 'config list'];

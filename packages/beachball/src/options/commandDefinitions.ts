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

export const commandDefinitions: Record<string, CommandDefinition> = {
  change: { desc: 'create change files in the change/ folder', isDefault: true },
  check: { desc: 'checks whether a change file is needed for this branch' },
  bump: { desc: 'bumps versions as well as generating changelogs' },
  publish: { desc: 'bumps, publishes to npm registry, and pushes changelogs back into the default branch' },
  sync: { desc: 'synchronize published versions of packages from the registry with local package.json versions' },
  config: {
    desc: 'get or list config settings (requires a sub-command)',
    subcommands: {
      get: { desc: 'get the value of a config setting (with any overrides)', args: '<name>' },
      list: { desc: 'list all config settings (with any overrides)' },
    },
  },
  init: { desc: 'initialize a new beachball config file in the current directory', hidden: true },
  canary: { desc: 'publish prerelease versions of changed or all packages without committing', hidden: true },
  migrate: { desc: 'help to migrate from beachball v2', hidden: true },
};

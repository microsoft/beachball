import type { CommandOptions } from 'commander';
import { BeachballOptions } from '../types/BeachballOptions';
import { validate } from '../validation/validate';
import { publish } from '../commands/publish';
import { bump } from '../commands/bump';
import { canary } from '../commands/canary';
import { init } from '../commands/init';
import { sync } from '../commands/sync';
import { change } from '../commands/change';

/** All the valid command names */
export type CommandName = 'change' | 'check' | 'bump' | 'publish' | 'sync' | 'canary' | 'init';

interface CommandMeta extends CommandOptions {
  description: string;
  action: (options: BeachballOptions) => void | Promise<void>;
}

/** All the valid CLI commands */
export const cliCommands: Record<CommandName, CommandMeta> = {
  change: {
    description: 'a tool to help create change files in the change/ folder',
    isDefault: true,
    action: async options => {
      const { isChangeNeeded } = validate(options, { allowMissingChangeFiles: true });

      if (!isChangeNeeded && !options.package) {
        console.log('No change files are needed');
        return;
      }

      await change(options);
    },
  },
  check: {
    description: 'checks whether a change file is needed for this branch',
    action: options => {
      validate(options);
      console.log('No change files are needed');
    },
  },
  bump: {
    description: 'bumps versions as well as generating changelogs (does not publish)',
    action: async options => {
      validate(options);
      await bump(options);
    },
  },
  publish: {
    description:
      'bumps, publishes to npm registry (optionally with dist-tags), and pushes changelogs back into the default branch',
    action: async options => {
      validate(options, { allowFetching: false });

      // set a default publish message
      options.message = options.message || 'applying package updates';
      await publish(options);
    },
  },
  sync: {
    description:
      'gets published versions of local packages from a registry and updates package.json files to match what is published',
    action: async options => {
      await sync(options);
    },
  },
  canary: {
    description: 'publishes a canary release',
    hidden: true,
    action: async options => {
      validate(options, { allowFetching: false });
      await canary(options);
    },
  },
  init: {
    description: 'Install beachball in a repo',
    hidden: true,
    action: async options => {
      await init(options);
    },
  },
};

const npmPublishCommands: CommandName[] = ['publish', 'canary'];

/** Categories of commands, used in option definitions to specify where they're applicable */
export const commandCategories = {
  /** commands that do npm publish (publish, canary) */
  npmPublish: npmPublishCommands,

  /** commands that bump locally */
  bump: [...npmPublishCommands, 'bump'] satisfies CommandName[],

  /** commands that do any npm operations */
  npm: [...npmPublishCommands, 'sync'] satisfies CommandName[],

  /** all the commands except init */
  most: Object.keys(cliCommands).filter(c => c !== 'init') as CommandName[],

  /** all the commands including init */
  all: Object.keys(cliCommands) as CommandName[],
};

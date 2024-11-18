import { findProjectRoot } from 'workspace-tools';
import { SortedChangeTypes } from '../changefile/changeTypes';
import { env } from '../env';
import { AuthType } from '../types/Auth';
import { CliOptions } from '../types/BeachballOptions';
import { ChangeType } from '../types/ChangeInfo';
import { CommandName, commandCategories } from './cliCommands';

interface OptionMeta<Name extends keyof CliOptions> {
  /** Use this name (instead of the config value name) for the option in the CLI */
  displayName?: string;
  short?: string;
  description: string | ((cmd: CommandName) => string);
  default?: DefaultValue<Name>;
  commands: CommandName[];
  /**
   * - `string` = string option (default)
   * - `flag` = plain flag (no extra handling)
   * - `boolean` = boolean flag with extra value handling (e.g. `--foo=true`)
   * - `boolean-negated` = boolean flag with extra value handling AND negated version (e.g. `--no-foo`)
   * - `int` = ensure value is a valid integer
   * - `multi` = allow option to be specified multiple times, but also parse comma-separated values
   *   into an array (commander doesn't do it by default)
   * @default 'string'
   */
  type?: 'string' | 'flag' | 'boolean' | 'boolean-negated' | 'int' | 'multi';
  choices?: string[];
  hide?: boolean;
}

interface OptionMetaWithDefault<Name extends keyof CliOptions> extends Omit<OptionMeta<Name>, 'default'> {
  default: DefaultValue<Name>;
}

/**
 * Default value for an option. It can either be hardcoded, or depend on the command or the values
 * of other options.
 */
type DefaultValue<Name extends keyof CliOptions> =
  | CliOptions[Name]
  | {
      /** Generic value used by `getDefaultOptions` (for tests). */
      simpleValue: CliOptions[Name];
      /** Get the value based on the current command. */
      fromCommand?: (cmd: CommandName) => CliOptions[Name];
      /**
       * Get the value based on other options. Be careful not to use circular or timing-dependent logic
       * (depending on another option without a hardcoded default).
       */
      fromOptions?: (cmd: CommandName, options: CliOptions) => CliOptions[Name];
    };

const changeTypes: ChangeType[] = [...SortedChangeTypes];
const authTypes: AuthType[] = ['authtoken', 'password'];
const accessLevels: CliOptions['access'][] = ['public', 'restricted'];

/**
 * Definitions for all the CLI options
 */
export const cliOptions: {
  [K in keyof CliOptions]: CliOptions[K] extends NonNullable<CliOptions[K]> ? OptionMetaWithDefault<K> : OptionMeta<K>;
} = {
  access: {
    description: 'access level for npm publish',
    default: 'restricted',
    choices: accessLevels,
    commands: commandCategories.npmPublish,
  },
  all: {
    description: 'bump all packages',
    default: false,
    type: 'boolean',
    commands: commandCategories.bump,
  },
  authType: {
    description: 'type of authentication to use for publishing',
    short: 'a',
    default: 'authtoken',
    choices: authTypes,
    commands: commandCategories.npm,
  },
  branch: {
    description: 'target branch from remote',
    short: 'b',
    default: 'origin/master',
    commands: commandCategories.most,
  },
  bump: {
    description: 'whether to bump versions and push changes to git remote (default true)',
    default: true,
    // TODO what did this mean??
    type: 'boolean-negated',
    commands: commandCategories.bump,
  },
  bumpDeps: {
    description: 'whether to bump dependent packages during publish',
    default: true,
    type: 'boolean-negated',
    commands: commandCategories.bump,
  },
  canaryName: {
    // TODO this default should be filled in here and not need to be repeated in the implementation,
    // but don't really want it required in the types
    description: 'canary dist-tag',
    default: 'canary',
    commands: ['canary'],
  },
  changeDir: {
    description: 'name of the directory to store change files',
    default: 'change',
    commands: commandCategories.most,
  },
  changehint: {
    description: 'hint message for when change files are not detected but required',
    default: 'Run "beachball change" to create a change file',
    commands: ['check'],
  },
  command: {
    description: 'the command to run',
    hide: true,
    default: {
      simpleValue: 'change',
      fromCommand: cmd => cmd,
    },
    commands: commandCategories.all,
  },
  commit: {
    description: 'whether to commit change files (--commit) or only stage them (--no-commit)',
    default: true,
    type: 'boolean-negated',
    commands: ['change'],
  },
  concurrency: {
    description: 'maximum concurrency for calling hooks and publishing to npm',
    default: 1,
    type: 'int',
    commands: commandCategories.bump,
  },
  configPath: {
    displayName: 'config',
    short: 'c',
    description: 'path to config file',
    commands: commandCategories.most,
  },
  defaultNpmTag: {
    description: 'default dist-tag used for npm publish',
    default: 'latest',
    commands: commandCategories.npmPublish,
  },
  depth: {
    description: 'for shallow clones only: depth of git history to fetch',
    type: 'int',
    commands: commandCategories.most,
  },
  dependentChangeType: {
    description: 'change type for dependent packages',
    choices: changeTypes,
    commands: ['change'],
  },
  disallowedChangeTypes: {
    description: 'disallowed change types',
    default: null,
    type: 'multi',
    choices: changeTypes,
    commands: commandCategories.most, // TODO is this right?
  },
  disallowDeletedChangeFiles: {
    description: 'verify no change files were deleted',
    default: false,
    type: 'boolean',
    commands: commandCategories.most,
  },
  fetch: {
    description: 'whether to fetch remote before starting',
    default: true,
    type: 'boolean-negated',
    commands: commandCategories.most,
  },
  forceVersions: {
    displayName: 'force',
    description: 'force syncing to the published version, even if older than the local version',
    type: 'flag',
    commands: ['sync'],
  },
  fromRef: {
    displayName: 'since',
    description: 'only read change files after this ref',
    commands: commandCategories.most, // TODO is this right?
  },
  gitTags: {
    description: 'whether to create git tags for published packages',
    default: true,
    type: 'boolean-negated',
    commands: ['publish'], // canary doesn't tag
  },
  gitTimeout: {
    description: 'timeout for git push (ms)',
    type: 'int',
    commands: ['publish'], // canary doesn't push to git
  },
  keepChangeFiles: {
    description: 'keep change files after bump/publish',
    type: 'flag',
    hide: true, // obscure option with unclear purpose
    commands: commandCategories.bump,
  },
  message: {
    short: 'm',
    description: cmd =>
      cmd === 'change' ? 'message to use for all change descriptions' : 'custom publish message for the checkin',
    default: {
      simpleValue: '',
      fromCommand: cmd => (cmd === 'change' ? '' : 'applying package updates'),
    },
    commands: ['change', ...commandCategories.bump], // TODO is this right?
  },
  new: {
    description: 'publishes new packages if not in the registry',
    default: false,
    type: 'flag',
    // this is rarely needed (see BeachballOptions docs), so showing it in --help is more likely
    // to beconfusing than helpful
    hide: true,
    commands: ['publish'],
  },
  package: {
    description: 'create a change file for package(s) regardless of diffs',
    short: 'p',
    type: 'multi',
    commands: ['change'],
  },
  path: {
    description: 'directory to run beachball in (default: project root or cwd)',
    default: {
      simpleValue: '',
      fromOptions: () => {
        try {
          return findProjectRoot(process.cwd());
        } catch (err) {
          return process.cwd();
        }
      },
    },
    commands: commandCategories.all, // this one works for init
  },
  prereleasePrefix: {
    description: 'prefix for prerelease versions',
    commands: commandCategories.bump,
  },
  publish: {
    description: 'whether to publish to npm registry',
    default: true,
    type: 'boolean-negated',
    commands: ['publish'],
  },
  push: {
    description: 'whether to push changes back to git remote',
    default: true,
    type: 'boolean-negated',
    commands: ['publish'],
  },
  registry: {
    description: 'custom npm registry',
    default: 'https://registry.npmjs.org/',
    commands: commandCategories.npm,
  },
  retries: {
    description: 'number of retries for package publish',
    default: 3,
    type: 'int',
    commands: commandCategories.npmPublish,
  },
  scope: {
    description: 'filters paths beachball uses to find packages',
    type: 'multi',
    commands: commandCategories.most, // TODO is this right?
  },
  tag: {
    short: 't',
    description: cmd => (cmd === 'sync' ? 'sync the version to this dist-tag' : 'dist-tag for npm publishes'),
    default: {
      simpleValue: '',
      fromOptions: (cmd, options) => (cmd === 'canary' ? options.canaryName || 'canary' : ''),
    },
    commands: commandCategories.npm,
  },
  timeout: {
    description: 'timeout in ms for npm commands (other than install)',
    type: 'int',
    commands: commandCategories.npm,
  },
  token: {
    description: 'npm token to use for authentication',
    short: 'n',
    commands: commandCategories.npm,
  },
  type: {
    description: 'change type for all modified packages',
    choices: changeTypes,
    commands: ['change'],
  },
  verbose: {
    description: 'enable verbose logging',
    type: 'flag',
    commands: commandCategories.most,
  },
  yes: {
    description: 'skip interactive prompts during publish',
    default: !!env.isCI,
    type: 'boolean',
    commands: commandCategories.npmPublish,
  },
};

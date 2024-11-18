// import { Command, InvalidArgumentError, Option } from 'commander';
// import { CliOptions } from '../types/BeachballOptions';
// import { getDefaultRemoteBranch, findProjectRoot } from 'workspace-tools';
// import { AuthType } from '../types/Auth';
// import { ChangeType } from '../types/ChangeInfo';

// // TODO consistent defaults handling
// // const defaults = getDefaultOptions();

// type CommandName = 'change' | 'check' | 'bump' | 'publish' | 'sync' | 'canary';
// const publishCommands: CommandName[] = ['publish', 'canary'];
// const bumpCommands: CommandName[] = [...publishCommands, 'bump'];
// const npmCommands: CommandName[] = [...publishCommands, 'sync'];
// const changeTypes: ChangeType[] = ['none', 'prerelease', 'patch', 'minor', 'major'];

// const authTypes: AuthType[] = ['authtoken', 'password'];
// const accessLevels: CliOptions['access'][] = ['public', 'restricted'];

// // TODO add command
// // TODO remapping
// // type RemappedOptNames = 'config' | 'force';
// const remappedOpts: Record<string, keyof CliOptions> = {
//   config: 'configPath',
//   force: 'forceVersions',
//   since: 'fromRef',
// };

// // function isAllowed(cmd: CommandName, allowed: CommandName[]): true | never {
// //   if (!allowed.includes(cmd)) {
// //     throw new Error(`Command "${cmd}" is not allowed for option`);
// //   }
// //   return true;
// // }

// const opts: Record<
//   keyof Omit<CliOptions, 'command' | 'help' | 'version'>,
//   (cmd: CommandName) => Option | Option[]
//   // {
//   //   name: string;
//   //   description: string;
//   //   extraProcessing?: 'boolean' | 'boolean-negated' | 'multi-value' | 'int'
//   //   choices?: string[];
//   //   hide?: boolean;
//   //   allowed?: CommandName[];
//   //   remap?: RemappedOptNames;
//   // }
// > = {
//   access: () => new Option('--access [access]', 'access level for npm publish').choices(accessLevels),
//   all: () => booleanOption('--all', 'Bump all packages'),
//   authType: () =>
//     optionWithCamelCase(`-a, --auth-type <type>`, 'type of authentication to use for publishing').map(opt =>
//       opt.choices(authTypes)
//     ),
//   branch: () => new Option(`-b, --branch <branch>`, 'target branch from remote'),
//   bump: () =>
//     booleanOptionWithNegation('--bump', 'whether to bump versions and push changes to git remote (default true)'),
//   bumpDeps: () => booleanOptionWithNegation('--bump-deps', 'whether to bump dependent packages during publish'),
//   canaryName: () => optionWithCamelCase('--canary-name <name>', 'canary dist-tag').map(opt => opt.default('canary')),
//   changehint: () =>
//     new Option('--changehint <hint>', 'Hint message for when change files are not detected but required'),
//   commit: () => [
//     ...booleanOption('--commit', 'whether to commit change files (default true)'),
//     new Option('--no-commit', 'only stage change files (do not commit)'),
//   ],
//   configPath: () => new Option(`-c, --config <path>`, 'path to config file'),
//   depth: () => new Option('--depth <depth>', 'depth of git history to fetch').argParser(parseIntValue),
//   dependentChangeType: () =>
//     optionWithCamelCase('--dependent-change-type <type>', 'change type for dependent packages').map(opt =>
//       opt.choices(changeTypes)
//     ),
//   disallowedChangeTypes: () =>
//     optionWithCamelCase('--disallowed-change-types <types...>', 'disallowed change types').map(opt =>
//       opt.choices(changeTypes)
//     ),
//   disallowDeletedChangeFiles: () =>
//     booleanOption('--disallow-deleted-change-files', 'verify no change files were deleted'),
//   fetch: () => booleanOptionWithNegation('--fetch', 'whether to fetch remote before starting (default true)'),
//   forceVersions: () => new Option('--force', "force updating local version from registry even if it's newer"),
//   fromRef: () => new Option('--since <ref>', 'only read change files after this ref').hideHelp(),
//   gitTags: () =>
//     booleanOptionWithNegation('--git-tags', 'whether to create git tags for published packages (default true)'),
//   gitTimeout: () =>
//     optionWithCamelCase('--git-timeout <ms>', 'timeout for git commands').map(opt => opt.argParser(parseIntValue)),
//   keepChangeFiles: () => new Option('--keep-change-files', 'keep change files after bump/publish').hideHelp(),
//   message: cmd =>
//     new Option(
//       '-m, --message <message>',
//       cmd === 'change' ? 'message to use for all change descriptions' : 'custom publish message for the checkin'
//     ),
//   // TODO pretty sure it publishes new packages regardless
//   new: () => new Option('--new', 'publishes new packages if not in the registry').hideHelp(),
//   package: () =>
//     new Option('-p, --package <package...>', 'create a change file for package(s) regardless of diffs').argParser(
//       parseMulti
//     ),
//   path: () => new Option('-p, --path <path>', 'directory to run beachball in (default: cwd)'),
//   prereleasePrefix: () => optionWithCamelCase('--prerelease-prefix <prefix>', 'prefix for prerelease versions'),
//   publish: () => booleanOptionWithNegation('--publish', 'whether to publish to npm registry (default true)'),
//   push: () => booleanOptionWithNegation('--push', 'whether to push changes back to git remote (default true)'),
//   registry: () => new Option('-r, --registry <registry>', 'custom npm registry'),
//   retries: () => new Option('--retries <retries>', 'number of retries for package publish').argParser(parseIntValue),
//   scope: () => new Option('--scope <scope...>', 'filters paths beachball uses to find packages').argParser(parseMulti),
//   tag: cmd =>
//     new Option('-t, --tag <tag>', cmd === 'sync' ? 'sync the version to this dist-tag' : 'dist-tag for npm publishes'),
//   timeout: () => new Option('--timeout <ms>', 'timeout for npm commands (other than install)').argParser(parseIntValue),
//   token: () => new Option('-n, --token <token>', 'npm token to use for authentication'),
//   type: () => new Option('--type <type>', 'change type for all modified packages').choices(changeTypes),
//   verbose: () => new Option('--verbose', 'add verbose logging'),
//   yes: () => booleanOption('--yes', 'skip interactive prompts during publish (default true)'),
// };

// function parseIntValue(value: string) {
//   const num = parseInt(value);
//   if (isNaN(num)) {
//     throw new InvalidArgumentError('Not a number');
//   }
//   return num;
// }

// function parseMulti(value: string, valid?: string[]) {
//   const values = value.split(',');
//   if (valid) {
//     for (const val of values) {
//       if (!valid.includes(val)) {
//         throw new InvalidArgumentError(`Invalid value "${val}"`);
//       }
//     }
//   }
//   return values;
// }

// /**
//  * Get a boolean flag option which optionally accepts a value `'true' | 'false'`, along with
//  * a camel case version if needed (hidden from help).
//  */
// function booleanOption(flags: string, description: string) {
//   return optionWithCamelCase(`${flags} [value]`, description).map(opt =>
//     opt.choices(['true', 'false']).argParser(v => v === 'true')
//   );
// }

// /**
//  * Returns positive and negative versions of a boolean option, along with a camel case positive
//  * version if needed. The positive version(s) optionally accept a value `'true' | 'false'`
//  * and the camel case version is hidden from help.
//  */
// function booleanOptionWithNegation(flags: string, description: string) {
//   // Commander doesn't automatically handle these variations
//   return [
//     // --opt, --opt=true, --opt=false, --opt true, --opt false
//     ...booleanOption(flags, description),
//     // --no-opt
//     new Option(
//       flags.replace(/.*?--/, '--no-'),
//       description.replace(/^(whether to)?/, 'do not').replace(' (default true)', '')
//     ),
//   ];
// }

// /** Returns a normal version of an option plus a camel-cased alias version if needed (hidden from help) */
// function optionWithCamelCase(flags: string, description: string) {
//   const opts = [new Option(flags, description)];
//   if (/(?<!-|^)-[a-z]/.test(flags)) {
//     const camelizedFlags = flags.replace(/.*?--/, '--').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
//     opts.push(new Option(camelizedFlags, description).hideHelp());
//   }
//   return opts;
// }

// class BeachballCommand extends Command {
//   /** Create a command with the beachball options that always apply */
//   createCommand(name: CommandName): Command {
//     return new BeachballCommand(name)
//       .addOptions(opts.configPath(name))
//       .addOptions(opts.branch(name))
//       .addOptions(opts.path(name));
//   }

//   addOptions(optOrOpts: Option | Option[]) {
//     const opts = Array.isArray(optOrOpts) ? optOrOpts : [optOrOpts];
//     opts.forEach(opt => this.addOption(opt));
//     return this;
//   }
// }

// const program = new BeachballCommand('beachball');

// // TODO options
// const changeCmd = program
//   .createCommand('change')
//   .addHelpText('after', 'a tool to help create change files in the change/ folder');

// const checkCmd = program
//   .createCommand('check')
//   .addHelpText('after', 'checks whether a change file is needed for this branch');

// const bumpCmd = program
//   .createCommand('bump')
//   .addHelpText('after', 'bumps versions as well as generating changelogs (does not publish)');

// const publishCmd = program
//   .createCommand('publish')
//   .addHelpText(
//     'after',
//     'bumps, publishes to npm registry (optionally does dist-tags), and pushes changelogs back into the default branch'
//   );

// const syncCmd = program
//   .createCommand('sync')
//   .addHelpText(
//     'after',
//     'gets published versions of local packages from a registry and updates package.json files to match what is published'
//   );

// const canaryCmd = program.createCommand('canary').addHelpText('after', 'TODO');

// program
//   .addCommand(changeCmd, { isDefault: true })
//   .addCommand(checkCmd)
//   .addCommand(bumpCmd)
//   .addCommand(publishCmd)
//   .addCommand(syncCmd)
//   .addCommand(canaryCmd, { hidden: true });

// let cachedCliOptions: CliOptions;

// export function getCliOptions(argv: string[]): CliOptions {
//   // Special case caching to process.argv which should be immutable
//   if (argv === process.argv) {
//     if (process.env.BEACHBALL_DISABLE_CACHE || !cachedCliOptions) {
//       cachedCliOptions = getCliOptionsUncached(process.argv);
//     }
//     return cachedCliOptions;
//   } else {
//     return getCliOptionsUncached(argv);
//   }
// }

// function getCliOptionsUncached(argv: string[]): CliOptions {
//   // Be careful not to mutate the input argv
//   const trimmedArgv = [...argv].splice(2);

//   const args = parser(trimmedArgv, {
//     string: ['branch', 'tag', 'message', 'package', 'since', 'dependent-change-type', 'config'],
//     array: ['scope', 'disallowed-change-types'],
//     boolean: ['git-tags', 'keep-change-files', 'force', 'disallow-deleted-change-files', 'no-commit', 'fetch'],
//     number: ['depth'],
//     alias: {
//       authType: ['a'],
//       branch: ['b'],
//       config: ['c'],
//       tag: ['t'],
//       registry: ['r'],
//       message: ['m'],
//       token: ['n'],
//       help: ['h', '?'],
//       yes: ['y'],
//       package: ['p'],
//       version: ['v'],
//     },
//   });

//   const { _, ...restArgs } = args;
//   let cwd: string;
//   try {
//     cwd = findProjectRoot(process.cwd());
//   } catch (err) {
//     cwd = process.cwd();
//   }
//   const cliOptions = {
//     ...(_.length > 0 && { command: _[0] }),
//     ...(restArgs as any),
//     path: cwd,
//     fromRef: args.since,
//     keepChangeFiles: args['keep-change-files'],
//     disallowDeletedChangeFiles: args['disallow-deleted-change-files'],
//     forceVersions: args.force,
//     configPath: args.config,
//   } as CliOptions;

//   const disallowedChangeTypesArgs = args['disallowed-change-types'];
//   if (disallowedChangeTypesArgs) {
//     cliOptions.disallowedChangeTypes = disallowedChangeTypesArgs;
//   }

//   if (args.branch) {
//     cliOptions.branch =
//       args.branch.indexOf('/') > -1
//         ? args.branch
//         : getDefaultRemoteBranch({ branch: args.branch, verbose: args.verbose, cwd });
//   }

//   if (cliOptions.command === 'canary') {
//     cliOptions.tag = cliOptions.canaryName || 'canary';
//   }

//   return cliOptions;
// }
export {};

import fs from 'fs';
import { Command, CommanderError, Option, InvalidArgumentError, type OutputConfiguration } from 'commander';
import { fetchReleases } from './fetchReleases.ts';
import { renderChangelog } from './renderChangelog.ts';
import { resolveRepoFromPackage } from './resolveRepoFromPackage.ts';
import { resolveToken } from './resolveToken.ts';
import { ChangelogError, type RawCliOptions, type ProperChangelogOptions, type RepoId } from './types.ts';

export interface CliContext {
  argv: string[];
  env: NodeJS.ProcessEnv;
  /** Commander error handler */
  exitOverride?: (err: CommanderError) => never | void;
  /** Commander error logging handler */
  writeErr?: OutputConfiguration['writeErr'];
  log: (message: string) => void;
  warn: (message: string) => void;
  writeFile: (file: string, content: string) => void;
}

/**
 * Parse the CLI arguments (`process.argv` by default), fetch the repo from `--package` if needed,
 * and get the default token if needed.
 *
 * By default this will exit the program if an argument is invalid.
 */
export async function _parseArgs(
  context: Pick<CliContext, 'argv' | 'env' | 'exitOverride' | 'writeErr' | 'warn'>
): Promise<ProperChangelogOptions> {
  const program = new Command()
    .name('proper-changelog')
    .description("Generate a single markdown changelog from a GitHub repository's releases.")
    .addOption(
      new Option('--repo <owner/repo>', 'GitHub repository to read releases from (use this OR --package)')
        .argParser((value): RepoId => {
          const match = value.match(/^([^/\s]+)\/([^/\s]+)$/);
          if (!match) {
            throw new InvalidArgumentError(`Expected "owner/repo" but got "${value}".`);
          }
          return { owner: match[1], repo: match[2] };
        })
        .conflicts('package')
    )
    .addOption(
      new Option(
        '--package <name>',
        'npm package whose GitHub repository should be used (use this OR --repo)'
      ).conflicts('repo')
    )
    .addOption(
      new Option('-o, --out <file>', 'output file name (default: CHANGELOG-<package-or-repo>.md)').conflicts('stdout')
    )
    .addOption(new Option('--stdout', 'write the changelog to stdout instead of a file').conflicts('out'))
    .option('--token <token>', 'GitHub token (falls back to GITHUB_TOKEN/GH_TOKEN, then `gh auth token`)')
    .option('--include-prereleases', 'include prerelease releases (drafts are always excluded)')
    .option('--from <tag>', 'include releases up to and including this tag (based on date, not semver)')
    .option('--to <tag>', 'include releases down to and including this tag (based on date, not semver)')
    .option('--limit <n>', 'maximum number of releases to include', value => {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new InvalidArgumentError(`Expected a positive integer but got "${value}".`);
      }
      return parsed;
    })
    .option('--filter <pattern>', 'only include releases whose tag matches this substring or /regex/')
    .option('--since <date>', 'only include releases published after this date (e.g. 2024-01-01)', value => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        throw new InvalidArgumentError(`Expected a date but got "${value}".`);
      }
      return date;
    })
    .allowExcessArguments(false);

  context.exitOverride && program.exitOverride(context.exitOverride);
  context.writeErr && program.configureOutput({ writeErr: context.writeErr });

  const rawOptions = program.parse(context.argv ?? process.argv).opts<RawCliOptions>();

  let repo = rawOptions.repo;
  if (rawOptions.package) {
    repo = await resolveRepoFromPackage(rawOptions.package);
  } else if (!repo) {
    throw new ChangelogError('Exactly one of --repo or --package is required.');
  }

  const token = await resolveToken(rawOptions.token, context.env);
  if (!token) {
    context.warn(
      'Warning: no GitHub token found (checked --token, GITHUB_TOKEN/GH_TOKEN, and `gh auth token`). ' +
        'Requests will be unauthenticated and may be rate-limited.'
    );
  }

  return { ...rawOptions, repo, token };
}

/** Generate the changelog and write it to a file or stdout. */
export async function _generateChangelog(options: ProperChangelogOptions, context: CliContext): Promise<void> {
  const { repo } = options;

  const releases = await fetchReleases(repo, options.token);
  if (!releases.length) {
    context.warn(`No releases found for ${repo.owner}/${repo.repo}`);
    return;
  }

  const changelog = renderChangelog(releases, options);

  if (options.stdout) {
    context.log(changelog);
    return;
  }

  // Strip a leading npm scope and replace path separators so the result is a safe single filename.
  const changelogName = (options.package ?? repo.repo).replace(/^@/, '').replace(/\//g, '-');
  const outFile = options.out ?? `CHANGELOG-${changelogName}.md`;
  context.writeFile(outFile, changelog);
  context.log(`Wrote changelog to ${outFile}`);
}

/** Run the CLI and handle top-level errors. Intended to be called from the bin script. */
export function cli(): void {
  (async () => {
    const context: CliContext = {
      argv: process.argv,
      env: process.env,
      log: message => console.log(message),
      warn: message => console.warn(message),
      writeFile: (file, content) => fs.writeFileSync(file, content, 'utf8'),
    };
    const options = await _parseArgs(context);
    await _generateChangelog(options, context);
  })().catch((err: unknown) => {
    if (err instanceof CommanderError || err instanceof ChangelogError) {
      console.error(err.message);
    } else {
      console.error(err instanceof Error ? err.stack || err.message : String(err));
    }
    // eslint-disable-next-line no-restricted-properties -- central handler
    process.exit(1);
  });
}

import { Command, InvalidArgumentError, Option } from 'commander';
import { resolveRepoFromPackage } from './resolveRepoFromPackage.ts';
import { resolveToken } from './resolveToken.ts';
import { type CliContext, type CliOptions, type ProperChangelogOptions, type RepoId, ChangelogError } from './types.ts';

/**
 * Parse the CLI arguments (`process.argv` by default), fetch the repo from `--package` if needed,
 * and get the default token if needed.
 *
 * By default this will exit the program if an argument is invalid.
 */
export async function parseArgs(
  context: Pick<CliContext, 'argv' | 'env' | 'exitOverride' | 'writeErr' | 'warn'>
): Promise<ProperChangelogOptions> {
  const program = new Command()
    .name('proper-changelog')
    .description("Generate a single markdown changelog from a GitHub repository's releases.")
    .addOption(
      new Option('--repo <owner/repo>', 'GitHub repository to read releases from (use this OR --package)')
        .argParser(parseRepo)
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
    .option('--limit <n>', 'maximum number of releases to include', parseLimit)
    .option('--filter <pattern>', 'only include releases whose tag matches this substring or /regex/', parseFilter)
    .option('--since <date>', 'only include releases published after this date (e.g. 2024-01-01)', parseSince)
    .allowExcessArguments(false);

  context.exitOverride && program.exitOverride(context.exitOverride);
  context.writeErr && program.configureOutput({ writeErr: context.writeErr });

  const rawOptions = program.parse(context.argv ?? process.argv).opts<CliOptions>();

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

/** Parse a `--repo` value in `owner/repo` form. */
function parseRepo(value: string): RepoId {
  const match = value.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!match) {
    throw new InvalidArgumentError(`Expected "owner/repo" but got "${value}".`);
  }
  return { owner: match[1], repo: match[2] };
}

/** Parse a `--limit` value as a positive integer. */
function parseLimit(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError(`Expected a positive integer but got "${value}".`);
  }
  return parsed;
}

/** Parse a `--since` value as a date. */
function parseSince(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidArgumentError(`Expected a date but got "${value}".`);
  }
  return date;
}

/**
 * Parse a `--filter` value. A value wrapped in slashes (optionally with trailing regex flags,
 * e.g. `/^v1\./i`) is converted to a `RegExp`; any other value is returned as-is for a
 * case-insensitive substring match.
 */
function parseFilter(value: string): string | RegExp {
  const regexMatch = value.match(/^\/(.*)\/([a-z]*)$/s);
  if (!regexMatch) {
    return value;
  }
  try {
    return new RegExp(regexMatch[1], regexMatch[2]);
  } catch (error) {
    throw new InvalidArgumentError(`Invalid regular expression "${value}": ${(error as Error).message}`);
  }
}

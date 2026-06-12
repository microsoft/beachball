import { writeFile } from 'fs/promises';
import { Command, Option, InvalidArgumentError } from 'commander';
import { fetchReleases } from './fetchReleases.ts';
import { renderChangelog } from './renderChangelog.ts';
import { resolveRepoFromPackage } from './resolveRepoFromPackage.ts';
import { resolveToken } from './resolveToken.ts';
import type { ProperChangelogOptions, RepoId } from './types.ts';

/** Parse an `owner/repo` string into a {@link RepoId}. */
export function parseRepo(value: string): RepoId {
  const match = value.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!match) {
    throw new InvalidArgumentError(`Expected "owner/repo" but got "${value}".`);
  }
  return { owner: match[1], repo: match[2] };
}

/** Parse a non-negative integer option value. */
function parsePositiveInt(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new InvalidArgumentError(`Expected a non-negative integer but got "${value}".`);
  }
  return parsed;
}

/** Validate a date option value (any format parseable by `new Date()`). */
function parseDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidArgumentError(`Expected a date but got "${value}".`);
  }
  return date;
}

interface RawCliOptions {
  repo?: RepoId;
  package?: string;
  out?: string;
  stdout?: boolean;
  token?: string;
  includePrereleases?: boolean;
  from?: string;
  to?: string;
  limit?: number;
  filter?: string;
  since?: Date;
}

/** Build the commander program. Exported for testing. */
export function createProgram(): Command {
  const program = new Command();
  program
    .name('proper-changelog')
    .description('Generate a single markdown changelog from a GitHub repository\u2019s releases.')
    .addOption(
      new Option('--repo <owner/repo>', 'GitHub repository to read releases from')
        .argParser(parseRepo)
        .conflicts('package')
    )
    .addOption(new Option('--package <name>', 'npm package whose GitHub repository should be used').conflicts('repo'))
    .addOption(
      new Option('-o, --out <file>', 'output file name (default: CHANGELOG-<package-or-repo>.md)').conflicts('stdout')
    )
    .addOption(new Option('--stdout', 'write the changelog to stdout instead of a file').conflicts('out'))
    .option('--token <token>', 'GitHub token (falls back to GITHUB_TOKEN/GH_TOKEN, then `gh auth token`)')
    .option('--include-prereleases', 'include prerelease releases (drafts are always excluded)')
    .option('--from <tag>', 'include releases up to and including this tag (based on date, not semver)')
    .option('--to <tag>', 'include releases down to and including this tag (based on date, not semver)')
    .option('--limit <n>', 'maximum number of releases to include', parsePositiveInt)
    .option('--filter <pattern>', 'only include releases whose tag matches this substring or /regex/')
    .option('--since <date>', 'only include releases published after this date (e.g. 2024-01-01)', parseDate)
    .allowExcessArguments(false);
  return program;
}

/** Resolve the target repository from either `--repo` or `--package`. */
async function resolveRepo(raw: RawCliOptions): Promise<RepoId> {
  if (raw.repo) {
    return raw.repo;
  }
  if (raw.package) {
    return resolveRepoFromPackage(raw.package);
  }
  throw new Error('Exactly one of --repo or --package is required.');
}

/** Generate the changelog and write it to a file or stdout based on the parsed options. */
export async function run(
  raw: RawCliOptions,
  deps: {
    log?: (message: string) => void;
    warn?: (message: string) => void;
    write?: (file: string, content: string) => Promise<void>;
  } = {}
): Promise<void> {
  const log = deps.log ?? ((message: string) => console.log(message));
  const warn = deps.warn ?? ((message: string) => console.warn(message));
  const write = deps.write ?? ((file: string, content: string) => writeFile(file, content, 'utf8'));

  const repo = await resolveRepo(raw);

  const token = await resolveToken(raw.token);
  if (!token) {
    warn(
      'Warning: no GitHub token found (checked --token, GITHUB_TOKEN/GH_TOKEN, and `gh auth token`). ' +
        'Requests will be unauthenticated and may be rate-limited.'
    );
  }

  const options: ProperChangelogOptions = {
    repo,
    packageName: raw.package,
    token,
    includePrereleases: raw.includePrereleases,
    from: raw.from,
    to: raw.to,
    limit: raw.limit,
    filter: raw.filter,
    since: raw.since,
  };

  const releases = await fetchReleases(repo, token);
  const changelog = renderChangelog(releases, options);

  if (raw.stdout) {
    log(changelog);
    return;
  }

  const outFile = raw.out ?? `CHANGELOG-${defaultBaseName(raw.package, repo)}.md`;
  await write(outFile, changelog);
  warn(`Wrote changelog to ${outFile}`);
}

/** Derive the default changelog file base name from the package name (if given) or repo name. */
export function defaultBaseName(packageName: string | undefined, repo: RepoId): string {
  const base = packageName ?? repo.repo;
  // Strip a leading npm scope and replace path separators so the result is a safe single filename.
  return base.replace(/^@/, '').replace(/\//g, '-');
}

/** Run the CLI and handle top-level errors. Intended to be called from the bin script. */
export function cli(argv: string[] = process.argv): void {
  (async () => {
    const program = createProgram();
    program.parse(argv);
    await run(program.opts<RawCliOptions>());
  })().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

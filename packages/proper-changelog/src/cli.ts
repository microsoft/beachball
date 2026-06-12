import { writeFile } from 'fs/promises';
import { Command, Option, InvalidArgumentError } from 'commander';
import { fetchReleases } from './fetchReleases.ts';
import { renderChangelog } from './renderChangelog.ts';
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

interface RawCliOptions {
  repo: RepoId;
  out?: string;
  stdout?: boolean;
  token?: string;
  includePrereleases?: boolean;
  from?: string;
  to?: string;
  limit?: number;
}

/** Build the commander program. Exported for testing. */
export function createProgram(): Command {
  const program = new Command();
  program
    .name('proper-changelog')
    .description('Generate a single markdown changelog from a GitHub repository\u2019s releases.')
    .requiredOption('--repo <owner/repo>', 'GitHub repository to read releases from', parseRepo)
    .addOption(new Option('-o, --out <file>', 'output file name (default: <repo>-changelog.md)').conflicts('stdout'))
    .addOption(new Option('--stdout', 'write the changelog to stdout instead of a file').conflicts('out'))
    .option('--token <token>', 'GitHub token (falls back to GITHUB_TOKEN/GH_TOKEN, then `gh auth token`)')
    .option('--include-prereleases', 'include prerelease releases (drafts are always excluded)')
    .option('--from <tag>', 'include releases up to and including this tag')
    .option('--to <tag>', 'include releases down to and including this tag')
    .option('--limit <n>', 'maximum number of releases to include', parsePositiveInt)
    .allowExcessArguments(false);
  return program;
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

  const token = await resolveToken(raw.token);
  if (!token) {
    warn(
      'Warning: no GitHub token found (checked --token, GITHUB_TOKEN/GH_TOKEN, and `gh auth token`). ' +
        'Requests will be unauthenticated and may be rate-limited.'
    );
  }

  const options: ProperChangelogOptions = {
    repo: raw.repo,
    token,
    includePrereleases: raw.includePrereleases,
    from: raw.from,
    to: raw.to,
    limit: raw.limit,
  };

  const releases = await fetchReleases(raw.repo, token);
  const changelog = renderChangelog(releases, options);

  if (raw.stdout) {
    log(changelog);
    return;
  }

  const outFile = raw.out ?? `${raw.repo.repo}-changelog.md`;
  await write(outFile, changelog);
  warn(`Wrote changelog to ${outFile}`);
}

/** CLI entry point: parse argv and run, setting a non-zero exit code on failure. */
export async function main(argv: string[]): Promise<void> {
  const program = createProgram();
  program.parse(argv);
  await run(program.opts<RawCliOptions>());
}

/** Run the CLI and handle top-level errors. Intended to be called from the bin script. */
export function cli(argv: string[] = process.argv): void {
  main(argv).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

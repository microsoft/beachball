import fs from 'fs';
import { CommanderError } from 'commander';
import { fetchReleases } from './fetchReleases.ts';
import { renderChangelog } from './renderChangelog.ts';
import { ChangelogError, type CliContext, type ProperChangelogOptions } from './types.ts';
import { parseArgs } from './parseArgs.ts';

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
    const options = await parseArgs(context);
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

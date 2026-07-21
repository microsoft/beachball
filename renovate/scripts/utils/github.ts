import path from 'path';
import { getEnv } from './getEnv.ts';

export const defaultRepo = 'microsoft/beachball';
export const defaultBranch = 'main';
export const isGithub = !!process.env.CI;
/** Branch name if running on github */
export const githubBranchName = getEnv('GITHUB_HEAD_REF', isGithub);

/**
 * In CI, log an error with the github workflow command format so it shows up in the summary
 * and possibly pointing to the specific file. Logs normally in local runs.
 * @param err Error
 * @param file Source file. If provided with no extension, ".json" will be appended.
 * @see {@link https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions}
 */
export function logError(err: unknown, file?: string): void {
  logOther('error', (err as Error).stack || String(err), file);
}

/**
 * In CI, log a message with the github workflow command format so it shows up in the summary
 * and possibly pointing to the specific file. Logs normally in local runs.
 * @param file Source file. If provided with no extension, ".json" will be appended.
 * @see {@link https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions}
 */
export function logOther(level: 'error' | 'warning' | 'notice', text: string, file?: string): void {
  file = file && !path.extname(file) ? `${file}.json` : file;
  const method = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
  method(isGithub ? `::${level} ${file ? ` file=${file}` : ''}::${text}` : text);
}

/**
 * In CI, start a log group using github workflow commands. Logs normally in local runs.
 */
export function logGroup(name: string): void {
  console.log(isGithub ? `::group::${name}` : `${name}\n`);
}

/**
 * In CI, end a log group using github workflow commands. Logs an empty line in local runs.
 */
export function logEndGroup(): void {
  console.log(isGithub ? '::endgroup::\n' : '');
}

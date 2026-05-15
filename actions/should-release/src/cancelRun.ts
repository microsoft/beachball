import * as core from '@actions/core';
import * as github from '@actions/github';
import { logGithubRequestError } from './logGithubRequestError.js';

/**
 * Cancel this workflow run.
 */
export async function cancelRun(token: string): Promise<void> {
  core.info('Canceling this workflow run');

  try {
    const octokit = github.getOctokit(token, { log: console });
    await octokit.rest.actions.cancelWorkflowRun({
      ...github.context.repo,
      run_id: github.context.runId,
    });
  } catch (err) {
    logGithubRequestError(err, `Canceling workflow run ${github.context.runId}`);
    process.exit(1);
  }
}

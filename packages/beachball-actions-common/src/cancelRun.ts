import * as core from '@actions/core';
import * as github from '@actions/github';
import { logGithubRequestError } from './logGithubRequestError.js';

/**
 * Cancel this workflow run.
 */
export async function cancelRun(token: string): Promise<void> {
  core.info('Canceling this workflow run');

  const workflowRun = Number(process.env.GITHUB_RUN_ID);
  try {
    const octokit = github.getOctokit(token, { log: console });
    await octokit.rest.actions.cancelWorkflowRun({
      ...github.context.repo,
      run_id: workflowRun,
    });
  } catch (err) {
    logGithubRequestError(err, `canceling workflow run ${workflowRun}`);
    process.exit(1);
  }
}

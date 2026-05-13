import * as core from '@actions/core';
import * as github from '@actions/github';
import { logGithubRequestError } from './logGithubRequestError.js';

type Octokit = ReturnType<typeof github.getOctokit>;
type WorkflowRunsResult = Awaited<
  ReturnType<Octokit['rest']['actions']['listWorkflowRuns']>
>['data'];

/**
 * Check for newer pending runs of this workflow against the current branch.
 * Assumes a required `token` input for the action.
 */
export async function checkForNewerRuns(token: string): Promise<boolean> {
  if (process.env.GITHUB_REF_TYPE !== 'branch') {
    core.setFailed('This action is only supported for runs against branches.');
    process.exit(1);
  }

  const octokit = github.getOctokit(token, { log: console });

  const branchName = process.env.GITHUB_REF_NAME!;
  const runId = Number(process.env.GITHUB_RUN_ID!);
  let workflowId: number;

  try {
    workflowId = (
      await octokit.rest.actions.getWorkflowRun({
        ...github.context.repo,
        run_id: runId,
      })
    ).data.workflow_id;
  } catch (err) {
    logGithubRequestError(err, `info about workflow run "${runId}"`);
    process.exit(1);
  }

  let thisBranchRuns: WorkflowRunsResult;
  try {
    thisBranchRuns = (
      await octokit.rest.actions.listWorkflowRuns({
        ...github.context.repo,
        workflow_id: workflowId,
        status: 'queued',
        branch: branchName,
      })
    ).data;
  } catch (err) {
    logGithubRequestError(err, `runs of workflow "${workflowId}" for branch "${branchName}"`);
    process.exit(1);
  }

  // At some point, the API started returning 1 for total_count but an empty array for workflow_runs,
  // possibly when only the second stage of the current job is queued?
  const runCount = thisBranchRuns.workflow_runs.length;
  core.info(
    `There ${
      runCount === 1 ? 'is 1 newer run' : `are ${runCount || 'no'} newer runs`
    } pending for ${branchName}.`,
  );
  if (runCount) {
    for (const run of thisBranchRuns.workflow_runs) {
      core.info(`- ${run.id}, queued at ${run.created_at} ${run.html_url}`);
    }
  }

  return runCount > 0;
}

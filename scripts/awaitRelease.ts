#!/usr/bin/env node

//
// Gates the build pipeline on the ESRP release outcome.
// It's meant to be run in ADO pipelines only, and relies on system environment variables.
//
// Inputs:
// - AUTH_TOKEN: System.AccessToken
// - ESRP_PIPELINE_ID: ID of the release pipeline (definitionId in ADO)
// - PUBLISH_PIPELINE_ALIAS: Alias of this build pipeline as referenced in release.yml's `resources.pipelines`
//

import { adoFail, fetchWithRetry, sleep } from './helpers.ts';

// Verify each required env input is set (builtins like SYSTEM_* and BUILD_BUILDID are agent-provided).
const missing = ['AUTH_TOKEN', 'ESRP_PIPELINE_ID', 'PUBLISH_PIPELINE_ALIAS'].filter(v => !process.env[v]);
if (missing.length) {
  adoFail(`Required env input(s) not set: ${missing.join(' ')}`);
}
const {
  AUTH_TOKEN,
  ESRP_PIPELINE_ID: esrpPipelineId,
  PUBLISH_PIPELINE_ALIAS: publishPipelineAlias,
  SYSTEM_COLLECTIONURI,
  SYSTEM_TEAMPROJECT,
  BUILD_BUILDID,
} = process.env as Record<string, string>;
const apiReleaseRuns = `${SYSTEM_COLLECTIONURI}${SYSTEM_TEAMPROJECT}/_apis/pipelines/${esrpPipelineId}/runs`;

/** A single ADO pipeline run, as returned by the runs REST API. */
interface PipelineRun {
  /** The run's unique id. */
  id: number;
  /** Run lifecycle state, e.g. `inProgress` or `completed`. */
  state?: string;
  /** Run outcome once completed, e.g. `succeeded` or `failed`. */
  result?: string;
  /** Pipeline resources, including the source runs keyed by alias. */
  resources?: {
    pipelines?: { [alias: string]: { runID?: number } };
  };
}

/**
 * GET an ADO REST URL, adding auth and the api-version query param automatically.
 * Retries up to 3 times with 1s backoff on failure.
 */
async function apiGet<T>(url: string): Promise<T> {
  return fetchWithRetry(`${url}?api-version=7.1`, { authHeader: `Bearer ${AUTH_TOKEN}` });
}

/** Poll for the ESRP release run and gate on its outcome. */
async function main(): Promise<void> {
  // 1. Find the release run triggered by THIS build run (poll until it appears).
  //    The completion trigger records this run's id under resources.pipelines.<alias>.
  //    Polls every 30s for up to 60 tries (~30 minutes) before giving up.
  let found: number | undefined;
  for (let i = 1; i <= 60; i++) {
    const runs = await apiGet<{ value: PipelineRun[] }>(apiReleaseRuns);
    for (const { id } of runs.value) {
      const run = await apiGet<PipelineRun>(`${apiReleaseRuns}/${id}`);
      const src = run.resources?.pipelines?.[publishPipelineAlias]?.runID;
      if (String(src) === BUILD_BUILDID) {
        found = id;
        break;
      }
    }
    if (found) break;
    console.log(`release run not queued yet, retry ${i}...`);
    await sleep(30);
  }
  if (!found) {
    adoFail(`No release run for build run ${BUILD_BUILDID}`);
  }
  console.log(`Found release run ${found}`);

  // 2. Poll until it completes, then gate on its result.
  //    Polls every 30s with no timeout (the ADO job timeout bounds the total wait).
  let result = '';
  while (true) {
    const run = await apiGet<PipelineRun>(`${apiReleaseRuns}/${found}`);
    const state = run.state;
    result = run.result || '';
    console.log(`state=${state} result=${result}`);
    if (state === 'completed') break;
    await sleep(30);
  }
  if (result !== 'succeeded') {
    adoFail(`Release result: ${result}`);
  }
}

main().catch(err => {
  adoFail(err instanceof Error ? err.message : String(err));
});

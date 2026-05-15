import * as core from '@actions/core';
// This dep is implicit--it must use the version from @actions/github so the instanceof check works
import { RequestError } from '@octokit/request-error';

export function logGithubRequestError(error: unknown, description: string, warnOnly?: boolean): void {
  const log = warnOnly ? core.warning : core.setFailed;
  if (error instanceof RequestError) {
    log(`${description} from ${error.request.url} failed with code ${error.status}: ${error.message}`);
  } else {
    log(`${description} failed: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
  }
}

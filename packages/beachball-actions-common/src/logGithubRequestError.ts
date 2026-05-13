import * as core from '@actions/core';
import { RequestError } from '@octokit/request-error';

export function logGithubRequestError(error: unknown, description: string, warnOnly?: boolean) {
  const log = warnOnly ? core.warning : core.setFailed;
  if (error instanceof RequestError) {
    log(
      `Getting ${description} from "${error.request.url}" failed with code ${error.status}, ${error.message}`,
    );
  } else {
    log(
      `Error getting ${description}: ${
        error instanceof Error ? error.message : JSON.stringify(error)
      }`,
    );
  }
}

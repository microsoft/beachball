import type { ReleaseRequestMessage } from '../models/types.ts';
import { getAadToken, type GetAadTokenParams } from '../utils/getAadToken.ts';
import { getReleaseDetails, pollRelease, submitRelease } from '../utils/releaseHttp.ts';

/**
 * Create a release request and poll for its completion (up to 60 minutes).
 */
export async function createRelease(
  params: GetAadTokenParams & {
    releaseRequest: ReleaseRequestMessage;
  }
): Promise<void> {
  const { releaseRequest, clientId, ...authParams } = params;

  // get authentication token from azure ad
  const bearerToken = (await getAadToken({ clientId, ...authParams })).token;

  const releaseResponse = await submitRelease({ clientId, bearerToken, releaseRequest });
  if (!releaseResponse) {
    console.error('Failed to create release request (see above)');
    // eslint-disable-next-line no-restricted-properties
    process.exit(1);
  }

  console.log('ReleaseSubmitResponse:' + JSON.stringify(releaseResponse, null, 2));

  if (!releaseResponse.operationId) {
    console.error('Release response is missing operationId');
    // eslint-disable-next-line no-restricted-properties
    process.exit(1);
  }

  // poll for release completion
  await pollRelease({
    clientId,
    bearerToken,
    releaseId: releaseResponse.operationId,
    timeoutInSeconds: 60 * 60,
    pollIntervalInSeconds: 30,
  });

  const releaseDetails = await getReleaseDetails({
    clientId,
    bearerToken,
    releaseId: releaseResponse.operationId,
  });
  if (!releaseDetails) {
    console.error('Failed to get release details (see above)');
    // eslint-disable-next-line no-restricted-properties
    process.exit(1);
  }

  console.log('ReleaseDetailsResponse:' + JSON.stringify(releaseDetails, null, 2));
}

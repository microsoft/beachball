import {
  type ReleaseRequestMessage,
  type ReleaseSubmitResponse,
  type ReleaseResultMessage,
  type ReleaseDetailsMessage,
  StatusCode,
} from '../models/types.ts';
import { retry } from './retry.ts';

export interface ReleaseHttpParams {
  /** ESRP onboarded AAD app client ID */
  clientId: string;
  /** Bearer token for authentication as the AAD app */
  bearerToken: string;
}

const esrpBaseUrl = 'https://api.esrp.microsoft.com/api/v3/releaseservices/clients/';
// const esrpBaseUrl = 'https://ppe.api.esrp.microsoft.com/api/v3/releaseservices/clients/';

const submitUrl = (params: { clientId: string }) => `${esrpBaseUrl}${params.clientId}/workflows/release/operations`;

const getStatusUrl = (params: { clientId: string; releaseId: string }) =>
  `${esrpBaseUrl}${params.clientId}/workflows/release/operations/grs/${params.releaseId}`;

const getDetailsUrl = (params: { clientId: string; releaseId: string }) =>
  `${esrpBaseUrl}${params.clientId}/workflows/release/operations/grd/${params.releaseId}`;

export function submitRelease(
  params: ReleaseHttpParams & {
    releaseRequest: ReleaseRequestMessage;
  }
): Promise<ReleaseSubmitResponse> {
  const { clientId, bearerToken, releaseRequest } = params;

  return doHttpRequest<ReleaseSubmitResponse>({
    operation: 'submit release request',
    apiUrl: submitUrl({ clientId }),
    bearerToken,
    method: 'POST',
    body: releaseRequest,
  });
}

export function getReleaseStatus(params: {
  clientId: string;
  bearerToken: string;
  releaseId: string;
}): Promise<ReleaseResultMessage> {
  const { clientId, bearerToken, releaseId } = params;

  return doHttpRequest<ReleaseResultMessage>({
    operation: 'get release status',
    apiUrl: getStatusUrl({ clientId, releaseId }),
    bearerToken,
    method: 'GET',
  });
}

export function getReleaseDetails(params: ReleaseHttpParams & { releaseId: string }): Promise<ReleaseDetailsMessage> {
  const { clientId, bearerToken, releaseId } = params;

  return doHttpRequest<ReleaseDetailsMessage>({
    operation: 'get release details',
    apiUrl: getDetailsUrl({ clientId, releaseId }),
    bearerToken,
    method: 'GET',
  });
}

export async function pollRelease(
  params: ReleaseHttpParams & {
    releaseId: string;
    timeoutInSeconds: number;
    pollIntervalInSeconds: number;
  }
): Promise<void> {
  const { clientId, bearerToken, releaseId, timeoutInSeconds, pollIntervalInSeconds } = params;

  const startTime = Date.now();
  let releaseStatus = null;

  while ((Date.now() - startTime) / 1000 < timeoutInSeconds) {
    try {
      releaseStatus = await getReleaseStatus({ clientId, bearerToken, releaseId });
    } catch (err) {
      console.warn(err);
      console.warn('will retry until timeout is reached');
    }

    if (!releaseStatus) {
      // continue
    } else if (releaseStatus.status === StatusCode.Inprogress) {
      console.log(`Polling for release completion in ${pollIntervalInSeconds} seconds...`);
      await new Promise(resolve => setTimeout(resolve, pollIntervalInSeconds * 1000));
    } else {
      break;
    }
  }

  console.log('ReleaseStatusResponse:' + JSON.stringify(releaseStatus, null, 2));
}

async function doHttpRequest<TResult>(
  params: Pick<ReleaseHttpParams, 'bearerToken'> & {
    operation: string;
    apiUrl: string;
    method: 'GET' | 'POST';
    body?: object;
  }
): Promise<TResult> {
  const { apiUrl, bearerToken, method, operation } = params;

  const body = params.body && JSON.stringify(params.body);

  let response: Response;
  try {
    response = await retry(() =>
      fetch(apiUrl, {
        method,
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          ...(body && { 'Content-Type': 'application/json' }),
        },
        ...(body && { body }),
      })
    );
  } catch (ex) {
    const message = ex instanceof Error ? ex.message : String(ex);
    throw new Error(`Failed to ${operation}: ${message}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to ${operation} with status ${response.status}: ${errorText}`);
  }

  try {
    return (await response.json()) as TResult;
  } catch (ex) {
    const message = ex instanceof Error ? ex.message : String(ex);
    throw new Error(`Failed to ${operation}: ${message}`);
  }
}

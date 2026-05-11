import type {
  ReleaseRequestMessage,
  ReleaseSubmitResponse,
  ReleaseResultMessage,
  ReleaseDetailsMessage,
} from '../models/types.ts';

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

/**
 * Submit a release request.
 * Throws an `Error` (not `ReleaseError`) if the request fails or the response can't be parsed.
 */
export function submitRelease(
  params: ReleaseHttpParams & { releaseRequest: ReleaseRequestMessage }
): Promise<ReleaseSubmitResponse> {
  const { clientId, bearerToken, releaseRequest } = params;

  return doHttpRequest<ReleaseSubmitResponse>({
    apiUrl: submitUrl({ clientId }),
    bearerToken,
    method: 'POST',
    body: releaseRequest,
  });
}

/**
 * Get the status of a release request.
 * Throws an `Error` (not `ReleaseError`) if the request fails or the response can't be parsed.
 */
export function getReleaseStatus(params: {
  clientId: string;
  bearerToken: string;
  releaseId: string;
}): Promise<ReleaseResultMessage> {
  const { clientId, bearerToken, releaseId } = params;

  return doHttpRequest<ReleaseResultMessage>({
    apiUrl: getStatusUrl({ clientId, releaseId }),
    bearerToken,
    method: 'GET',
  });
}

/**
 * Get the details of a release request.
 * Throws an `Error` (not `ReleaseError`) if the request fails or the response can't be parsed.
 */
export function getReleaseDetails(params: ReleaseHttpParams & { releaseId: string }): Promise<ReleaseDetailsMessage> {
  const { clientId, bearerToken, releaseId } = params;

  return doHttpRequest<ReleaseDetailsMessage>({
    apiUrl: getDetailsUrl({ clientId, releaseId }),
    bearerToken,
    method: 'GET',
  });
}

async function doHttpRequest<TResult>(
  params: Pick<ReleaseHttpParams, 'bearerToken'> & {
    apiUrl: string;
    method: 'GET' | 'POST';
    body?: object;
  }
): Promise<TResult> {
  const { apiUrl, bearerToken, method } = params;

  const body = params.body && JSON.stringify(params.body);

  let response: Response | undefined;
  let lastError: string;
  const maxRetries = 10;
  let run = 1;

  while (!response) {
    try {
      response = await fetch(apiUrl, {
        method,
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          ...(body && { 'Content-Type': 'application/json' }),
        },
        ...(body && { body }),
      });
    } catch (err) {
      lastError = (err as Error).message || String(err);
      if (
        !/fetch failed|terminated|aborted|timeout|TimeoutError|Timeout Error|RestError|Client network socket disconnected|socket hang up|ECONNRESET/i.test(
          (err as Error).message || ''
        )
      ) {
        throw new Error(`Request to ${apiUrl} failed: ${lastError}`);
      }

      if (run === maxRetries) {
        throw new Error(`Request to ${apiUrl} failed after ${maxRetries} attempts. Last error: ${lastError}`);
      }

      // maximum delay is ~3 seconds
      const millis = Math.floor(Math.random() * 200 + 50 * Math.pow(1.5, run));
      await new Promise(c => setTimeout(c, millis));
      run++;
    }
  }

  const responseText = await response.text();
  if (!response.ok) {
    // Intentionally not a ReleaseError so caller can add more context
    throw new Error(`Request to ${apiUrl} failed with status ${response.status}:\n${responseText}`);
  }

  try {
    return JSON.parse(responseText) as TResult;
  } catch {
    throw new Error(`Request to ${apiUrl} succeeded but did not return valid JSON. Received:\n${responseText}`);
  }
}

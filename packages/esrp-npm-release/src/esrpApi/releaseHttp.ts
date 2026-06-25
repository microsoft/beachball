import type {
  ReleaseRequestMessage,
  ReleaseSubmitResponse,
  ReleaseResultMessage,
  ReleaseDetailsMessage,
} from '../types/api.ts';
import { ReleaseError } from '../utils/ReleaseError.ts';

export interface ReleaseHttpParams {
  /** ESRP onboarded AAD app client ID */
  clientId: string;
  /** Bearer token for authentication as the AAD app */
  bearerToken: string;
  /** Release correlation ID */
  releaseId: string;
}

const esrpApiDomain = 'api.esrp.microsoft.com';
export const esrpApiScope = `https://msazurecloud.onmicrosoft.com/${esrpApiDomain}/`;

const esrpBaseUrl = `https://${esrpApiDomain}/api/v3/releaseservices/clients/`;
// const esrpBaseUrl = 'https://ppe.api.esrp.microsoft.com/api/v3/releaseservices/clients/';

/**
 * Submit a release request.
 * Throws a `ReleaseError` if the request fails or the response can't be parsed.
 */
export async function submitRelease(
  params: Omit<ReleaseHttpParams, 'releaseId'> & { releaseRequest: ReleaseRequestMessage }
): Promise<ReleaseSubmitResponse & Required<Pick<ReleaseSubmitResponse, 'operationId'>>> {
  const { clientId, bearerToken, releaseRequest } = params;

  let response: ReleaseSubmitResponse;
  try {
    response = await doHttpRequest<ReleaseSubmitResponse>({
      apiUrl: `${esrpBaseUrl}${clientId}/workflows/release/operations`,
      bearerToken,
      method: 'POST',
      body: releaseRequest,
    });
  } catch (err) {
    throw new ReleaseError(`Failed to submit release`, { cause: err });
  }

  if (!response.operationId) {
    // probably impossible?
    throw new ReleaseError('Missing operationId on submitReleaseResult');
  }

  return response as ReleaseSubmitResponse & Required<Pick<ReleaseSubmitResponse, 'operationId'>>;
}

/**
 * Get the status of a release request.
 * Throws a `ReleaseError` if the request fails or the response can't be parsed.
 */
export async function getReleaseStatus(params: ReleaseHttpParams): Promise<ReleaseResultMessage> {
  const { clientId, bearerToken, releaseId } = params;

  try {
    return await doHttpRequest<ReleaseResultMessage>({
      apiUrl: `${esrpBaseUrl}${clientId}/workflows/release/operations/grs/${releaseId}`,
      bearerToken,
      method: 'GET',
    });
  } catch (err) {
    throw new ReleaseError(`Failed to get release status`, { cause: err });
  }
}

/**
 * Get the details of a release request.
 * Throws an `Error` (not `ReleaseError`) if the request fails or the response can't be parsed.
 */
export function getReleaseDetails(params: ReleaseHttpParams): Promise<ReleaseDetailsMessage> {
  const { clientId, bearerToken, releaseId } = params;

  return doHttpRequest<ReleaseDetailsMessage>({
    apiUrl: `${esrpBaseUrl}${clientId}/workflows/release/operations/grd/${releaseId}`,
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

  const maxRetries = 10;
  let lastError = '';
  let responseText = '';

  for (let run = 1; run <= maxRetries; run++) {
    let response: Response | undefined;
    try {
      // start the request - resolves when headers are received, and rejects on initial network errors
      response = await fetch(apiUrl, {
        method,
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          ...(body && { 'Content-Type': 'application/json' }),
        },
        ...(body && { body }),
        signal: AbortSignal.timeout(60_000),
      });
      // wait for the whole response body
      responseText = await response.text();
      if (response.ok) {
        break;
      }
    } catch (err) {
      const message = (err as Error).message || String(err);
      // retry on transient errors, throw otherwise
      if (
        !/fetch failed|terminated|aborted|timeout|TimeoutError|Timeout Error|RestError|Client network socket disconnected|socket hang up|ECONNRESET/i.test(
          message
        )
      ) {
        // Intentionally not a ReleaseError so caller can add more context
        throw new Error(`Request to ${apiUrl} failed: ${message}`);
      }
      lastError = message;
    }

    if (response) {
      const status = response.status;
      // ignore transient errors: 408 Request Timeout, 429 Too Many Requests, and any 5xx
      if (!(status === 408 || status === 429 || (status >= 500 && status < 600))) {
        // Intentionally not a ReleaseError so caller can add more context
        throw new Error(`Request to ${apiUrl} failed with status ${status}:\n${responseText}`);
      } else {
        lastError = `status ${status}: ${responseText}`;
      }
    }

    if (run === maxRetries) {
      throw new Error(`Request to ${apiUrl} failed after ${maxRetries} attempts. Last error:\n${lastError}`);
    }

    // schedule a retry (maximum delay is ~3 seconds)
    const millis = Math.floor(Math.random() * 200 + 50 * Math.pow(1.5, run));
    await new Promise(c => setTimeout(c, millis));
  }

  try {
    return JSON.parse(responseText) as TResult;
  } catch {
    throw new Error(`Request to ${apiUrl} succeeded but did not return valid JSON. Received:\n${responseText}`);
  }
}

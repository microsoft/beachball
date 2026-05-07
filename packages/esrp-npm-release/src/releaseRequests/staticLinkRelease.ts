import type { JwsTokenParams } from '../utils/generateJwsToken.ts';
import {
  createReleaseRequest,
  type AccessPermissionsInfoParams,
  type CreateReleaseRequestMessageParams,
  type GeneratedReleaseRequestMessage,
} from './baseRelease.ts';

export interface StaticLinkReleaseRequestParams extends Omit<
  CreateReleaseRequestMessageParams,
  'accessPermissionsInfo'
> {
  accessPermissionsInfo: Required<AccessPermissionsInfoParams>;
  /** @default 'sw electronic' */
  releaseContentType?: string;
}

export function createStaticLinkReleaseRequest(
  params: StaticLinkReleaseRequestParams,
  signingParams?: JwsTokenParams
): GeneratedReleaseRequestMessage {
  return createReleaseRequest(params, signingParams, request => {
    request.routingInfo = {
      intent: 'filedownloadlinkgeneration',
    };
    request.releaseInfo.properties = {
      ReleaseContentType: params.releaseContentType ?? 'sw electronic',
    };
  });
}

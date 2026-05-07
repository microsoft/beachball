import type { JwsTokenParams } from '../utils/generateJwsToken.ts';
import {
  createReleaseRequest,
  type CreateReleaseRequestMessageParams,
  type GeneratedReleaseRequestMessage,
} from './baseRelease.ts';

export interface CreateNpmReleaseRequestMessageParams extends Omit<
  CreateReleaseRequestMessageParams,
  'accessPermissionsInfo'
> {
  /** @default 'latest' */
  npmTag?: string;
}

export function createNpmReleaseRequest(
  params: CreateNpmReleaseRequestMessageParams,
  signingParams?: JwsTokenParams
): GeneratedReleaseRequestMessage {
  return createReleaseRequest(
    { ...params, accessPermissionsInfo: { mainPublisher: 'ESRPRELPACMAN' } },
    signingParams,
    request => {
      request.routingInfo = {
        intent: 'packagedistribution',
        contentType: 'npm',
        // contentOrigin: 'azeus',
        productState: params.npmTag ?? 'latest',
      };
      request.releaseInfo.properties = {
        ReleaseContentType: 'npm',
        IsRsm: 'false',
      };
      request.releaseInfo.isRevision = false;
    }
  );
}

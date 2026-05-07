import type { JwsTokenParams } from '../utils/generateJwsToken.ts';
import {
  createReleaseRequest,
  type CreateReleaseRequestMessageParams,
  type GeneratedReleaseRequestMessage,
} from './baseRelease.ts';

export function createComplianceReleaseRequest(
  params: CreateReleaseRequestMessageParams,
  signingParams?: JwsTokenParams
): GeneratedReleaseRequestMessage {
  return createReleaseRequest(params, signingParams, request => {
    request.routingInfo = {
      intent: 'Product Release', //this will be available after onboarding is completed
    };
    request.releaseInfo.properties = {
      ReleaseContentType: 'sw electronic', //update this after onboarding is complete
    };
  });
}

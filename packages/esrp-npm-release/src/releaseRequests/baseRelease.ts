import { randomUUID } from 'crypto';
import { createReleaseFileInfo, type CreateReleaseFileInfoParams } from '../models/releaseFileInfo.ts';
import type { ProductInfo, ReleaseRequestMessage } from '../models/types.ts';
import { generateJwsToken, type JwsTokenParams } from '../utils/generateJwsToken.ts';

export interface AccessPermissionsInfoParams {
  /**
   * @example 'ESRPRelTest'
   * @example 'ESRPRELPACMAN'
   */
  mainPublisher: string;
  /**
   * only for static link releases?
   * @example ['CBDSTEST']
   */
  allDownloadEntities?: string[];
}

export interface CreateReleaseRequestMessageParams extends CreateReleaseFileInfoParams {
  correlationId?: string;
  /** email of the DRI for the team creating this release */
  driEmail: string[];
  /** created by email */
  createdBy: string;
  /** owner emails */
  owners: string[];
  /** approver emails (all non-mandatory and auto-approved) */
  approvers: string[];
  /** your release title */
  releaseTitle: string;
  productInfo: ProductInfo;
  accessPermissionsInfo: AccessPermissionsInfoParams;
}

export type GeneratedReleaseRequestMessage = ReleaseRequestMessage &
  Required<
    Pick<
      ReleaseRequestMessage,
      | 'customerCorrelationId'
      | 'esrpCorrelationId'
      | 'driEmail'
      | 'createdBy'
      | 'owners'
      | 'approvers'
      | 'accessPermissionsInfo'
      | 'productInfo'
      | 'releaseInfo'
    >
  >;

/**
 * Create a release request. If `signingParams` are provided, `jwsToken` will be generated.
 * @param params Main params
 * @param signingParams JWS token params
 * @param customizeRequest Add custom properties for the release request type
 * @returns Generated release request message
 */
export function createReleaseRequest(
  params: CreateReleaseRequestMessageParams,
  signingParams: JwsTokenParams | undefined,
  customizeRequest: (releaseRequest: GeneratedReleaseRequestMessage) => void
): GeneratedReleaseRequestMessage {
  const { accessPermissionsInfo } = params;
  const correlationId = params.correlationId ?? randomUUID();

  const request: GeneratedReleaseRequestMessage = {
    customerCorrelationId: correlationId,
    esrpCorrelationId: correlationId,
    driEmail: params.driEmail,
    createdBy: { userPrincipalName: params.createdBy },
    owners: params.owners.map(email => ({ owner: { userPrincipalName: email } })),
    approvers: params.approvers.map(email => ({
      approver: { userPrincipalName: email },
      isAutoApproved: true,
      isMandatory: false,
    })),
    accessPermissionsInfo: {
      mainPublisher: accessPermissionsInfo.mainPublisher,
      ...(accessPermissionsInfo.allDownloadEntities && {
        channelDownloadEntityDetails: {
          AllDownloadEntities: accessPermissionsInfo.allDownloadEntities,
        },
      }),
    },
    productInfo: params.productInfo,
    releaseInfo: {
      title: params.releaseTitle,
      minimumNumberOfApprovers: 1,
    },
    files: createReleaseFileInfo(params),
  };

  customizeRequest(request);

  if (signingParams) {
    request.jwsToken = generateJwsToken({
      ...signingParams,
      releaseRequest: request,
    });
  }

  return request;
}

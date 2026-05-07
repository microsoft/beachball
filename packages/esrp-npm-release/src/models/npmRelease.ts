import type { ProductInfo, ReleaseRequestMessage } from './types.ts';

export type GeneratedReleaseRequestMessage = ReleaseRequestMessage &
  Required<
    Pick<
      ReleaseRequestMessage,
      'driEmail' | 'createdBy' | 'owners' | 'approvers' | 'accessPermissionsInfo' | 'productInfo' | 'releaseInfo'
    >
  >;

export interface CreateNpmReleaseRequestMessageParams {
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
  /** @default 'latest' */
  npmTag?: string;
}

export function createNpmReleaseRequest(params: CreateNpmReleaseRequestMessageParams): GeneratedReleaseRequestMessage {
  return {
    driEmail: params.driEmail,
    createdBy: { userPrincipalName: params.createdBy },
    owners: params.owners.map(email => ({ owner: { userPrincipalName: email } })),
    approvers: params.approvers.map(email => ({
      approver: { userPrincipalName: email },
      isAutoApproved: true,
      isMandatory: false,
    })),
    accessPermissionsInfo: {
      mainPublisher: 'ESRPRELPACMAN',
    },
    productInfo: params.productInfo,
    releaseInfo: {
      title: params.releaseTitle,
      minimumNumberOfApprovers: 1,
      isRevision: false,
      properties: {
        ReleaseContentType: 'npm',
        IsRsm: 'false',
      },
    },
    routingInfo: {
      intent: 'packagedistribution',
      contentType: 'npm',
      productState: params.npmTag ?? 'latest',
    },
  };
}

import fs from 'fs';
import path from 'path';
import { generateJwsToken } from '../auth/generateJwsToken.ts';
import { ReleaseError } from '../utils/ReleaseError.ts';
import { hashFileStream } from '../utils/hashFileStream.ts';
import { FileHashType, type ProductInfo, type ReleaseRequestMessage } from '../types/api.ts';

export type GeneratedReleaseRequestMessage = ReleaseRequestMessage &
  Required<
    Pick<
      ReleaseRequestMessage,
      | 'driEmail'
      | 'createdBy'
      | 'owners'
      | 'approvers'
      | 'accessPermissionsInfo'
      | 'productInfo'
      | 'releaseInfo'
      | 'files'
      | 'jwsToken'
    >
  >;

export interface CreateNpmReleaseRequestMessageParams {
  correlationId: string;
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
  productInfo: Required<ProductInfo>;
  npmTag?: string;
  file: {
    /** Local file path */
    path: string;
    /** SAS URL for the staged blob */
    sasBlobUrl: string;
  };
  requestSigningCertificates: string[];
  requestSigningKey: string;
}

/**
 * Create a release request. Handles hashing the file, constructing the message, and JWS signing.
 * Throws `ReleaseError` on any failure.
 */
export async function createNpmReleaseRequest(
  params: CreateNpmReleaseRequestMessageParams
): Promise<GeneratedReleaseRequestMessage> {
  const { file } = params;

  let size: number;
  let hash: Buffer;
  try {
    size = fs.statSync(file.path).size;
    // Hash the file with a stream--most package tarballs are small, but some are not
    hash = await hashFileStream('sha256', file.path);
  } catch (err) {
    throw new ReleaseError(`Failed to stat or hash file ${file.path}`, { cause: err });
  }

  const message: Omit<GeneratedReleaseRequestMessage, 'jwsToken'> = {
    esrpCorrelationId: params.correlationId,
    customerCorrelationId: params.correlationId,
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
      // Don't default to "latest" here in case the package specifies the tag in publishConfig
      ...(params.npmTag && { productState: params.npmTag }),
    },
    files: [
      {
        name: path.basename(file.path),
        tenantFileLocation: file.sasBlobUrl,
        tenantFileLocationType: 'AzureBlob',
        sourceLocation: { type: 'azureBlob', blobUrl: file.sasBlobUrl },
        hashType: FileHashType.sha256,
        hash: Array.from(hash),
        sizeInBytes: size,
      },
    ],
  };

  try {
    const jwsToken = generateJwsToken({
      releaseRequest: message,
      certificates: params.requestSigningCertificates,
      privateKey: params.requestSigningKey,
    });
    return { ...message, jwsToken };
  } catch (err) {
    throw new ReleaseError(`Failed to generate JWS token for release request`, { cause: err });
  }
}

export function redactReleaseRequest<TMessage extends Pick<ReleaseRequestMessage, 'files' | 'jwsToken'>>(
  message: TMessage
): TMessage {
  message = structuredClone(message);
  if (message.jwsToken) message.jwsToken = '***';
  message.files = message.files?.map(f => ({
    ...f,
    tenantFileLocation: f.tenantFileLocation.replace(/\?.*$/, '?***'),
    sourceLocation: {
      ...f.sourceLocation,
      blobUrl: f.sourceLocation?.blobUrl?.replace(/\?.*$/, '?***'),
    },
  }));
  return message;
}

import type { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import type { CreateNpmReleaseRequestMessageParams } from './models/npmRelease.ts';
import type { Logger } from './utils/Logger.ts';

export interface ReleaseFileParams {
  logger: Logger;

  /** ESRP Release Service client ID */
  clientId: string;
  /** ESRP Release Service tenant ID */
  tenantId: string;
  /** ESRP Auth cert PFX content */
  authCertificatePfx: string;
  /** ESRP JWS request signing cert PFX content */
  requestSigningCertificatePfx: string;

  /** Azure blob storage client for staging artifact files */
  stagingBlobServiceClient: BlobServiceClient;

  /** Info for creating the release request */
  releaseRequestParams: Omit<CreateNpmReleaseRequestMessageParams, 'correlationId'>;
  /** Local file path to upload */
  filePath: string;
}

export interface CreateESRPReleaseServiceParams extends Pick<
  ReleaseFileParams,
  'logger' | 'tenantId' | 'clientId' | 'authCertificatePfx' | 'requestSigningCertificatePfx' | 'releaseRequestParams'
> {
  stagingContainerClient: ContainerClient;
  stagingSasToken: string;
}

export interface ESRPReleaseServiceParams extends Pick<
  CreateESRPReleaseServiceParams,
  | 'releaseRequestParams'
  | 'logger'
  | 'clientId'
  | 'stagingContainerClient'
  | 'stagingSasToken'
  | 'requestSigningCertificatePfx'
> {
  accessToken: string;
}

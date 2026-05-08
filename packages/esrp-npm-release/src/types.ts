import type { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import type { CreateNpmReleaseRequestMessageParams } from './models/npmRelease.ts';

export interface ReleaseFileParams {
  log: (...args: unknown[]) => void;

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
  releaseRequestParams: CreateNpmReleaseRequestMessageParams;
  /** Version to use for the release. For npm, it's arbitrary (doesn't change package versions). */
  version: string;
  /** Local file path to upload */
  filePath: string;
}

export interface CreateESRPReleaseServiceParams extends Pick<
  ReleaseFileParams,
  'log' | 'tenantId' | 'clientId' | 'authCertificatePfx' | 'requestSigningCertificatePfx' | 'releaseRequestParams'
> {
  stagingContainerClient: ContainerClient;
  stagingSasToken: string;
}

export interface ESRPReleaseServiceParams extends Pick<
  CreateESRPReleaseServiceParams,
  | 'releaseRequestParams'
  | 'log'
  | 'clientId'
  | 'stagingContainerClient'
  | 'stagingSasToken'
  | 'requestSigningCertificatePfx'
> {
  accessToken: string;
  // requestSigningCertificates: string[];
  // requestSigningKey: string;
}

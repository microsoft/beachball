import type { ContainerClient } from '@azure/storage-blob';
import type { CreateNpmReleaseRequestMessageParams } from './models/npmRelease.ts';
import type { AccessToken } from './utils/getAadToken';

export interface ReleaseFileParams {
  log: (...args: unknown[]) => void;

  /** ESRP Release Service client ID */
  clientId: string;
  /** ESRP Release Service tenant ID */
  tenantId: string;
  /** Auth cert PFX content, probably from an environment variable */
  authCertificatePfx: string;
  /** JWS request signing cert PFX content, probably from an environment variable */
  requestSigningCertificatePfx: string;

  publishAuthToken: AccessToken;
  /** Storage account name for staging artifact files */
  storageAccountName: string;
  /** Container name in `storageAccountName` */
  containerName: string;

  releaseRequestParams: CreateNpmReleaseRequestMessageParams;
  filePath: string;
  /** Version to use for the release. For npm, it's arbitrary (doesn't change package versions). */
  version: string;
}

export interface CreateESRPReleaseServiceParams extends Pick<
  ReleaseFileParams,
  'log' | 'tenantId' | 'clientId' | 'authCertificatePfx' | 'requestSigningCertificatePfx' | 'releaseRequestParams'
> {
  containerClient: ContainerClient;
  stagingSasToken: string;
}

export interface ESRPReleaseServiceParams extends Pick<
  CreateESRPReleaseServiceParams,
  'releaseRequestParams' | 'log' | 'clientId' | 'containerClient' | 'stagingSasToken'
> {
  accessToken: string;
  requestSigningCertificates: string[];
  requestSigningKey: string;
}

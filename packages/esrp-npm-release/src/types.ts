import type { ContainerClient } from '@azure/storage-blob';
import type { GeneratedReleaseRequestMessage } from './releaseRequests/baseRelease';
import type { AccessToken } from './utils/getAadToken';

/** currently implemented release types */
export type ReleaseType = 'staticLink';

export type ReleaseResult = {
  type: 'staticLink';
  downloadUrl: string;
};

export interface ESRPReleaseWorkerData {
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

  releaseType: ReleaseType;
  baseReleaseRequest: GeneratedReleaseRequestMessage;
  artifactName: string;
  artifactFilePath: string;
  /** Version to use for the release. For npm, it's arbitrary (doesn't change package versions). */
  version: string;
  /** Friendly file name prefix for the release. Defaults to `version`. */
  friendlyFileNamePrefix: string | undefined;
}

export interface CreateESRPReleaseServiceParams extends Pick<
  ESRPReleaseWorkerData,
  'tenantId' | 'clientId' | 'authCertificatePfx' | 'requestSigningCertificatePfx' | 'baseReleaseRequest' | 'releaseType'
> {
  log: (...args: unknown[]) => void;
  // /** ESRP Release Service client ID */
  // clientId: string;
  containerClient: ContainerClient;
  stagingSasToken: string;
}

export interface ESRPReleaseServiceParams extends Pick<
  CreateESRPReleaseServiceParams,
  'baseReleaseRequest' | 'releaseType' | 'log' | 'clientId' | 'containerClient' | 'stagingSasToken'
> {
  accessToken: string;
  requestSigningCertificates: string[];
  requestSigningKey: string;
}

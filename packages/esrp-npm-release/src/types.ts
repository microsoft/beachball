import type { ContainerClient } from '@azure/storage-blob';
import type { GeneratedReleaseRequestMessage } from './releaseRequests/baseRelease';
import type { AccessToken } from './utils/getAadToken';

export interface ESRPReleaseServiceParams {
  getBaseReleaseRequest: () => GeneratedReleaseRequestMessage;
  log: (...args: unknown[]) => void;
  /** ESRP Release Service client ID */
  clientId: string;
  accessToken: string;
  requestSigningCertificates: string[];
  requestSigningKey: string;
  containerClient: ContainerClient;
  stagingSasToken: string;
}

export interface CreateESRPReleaseServiceParams extends Omit<
  ESRPReleaseServiceParams,
  'accessToken' | 'requestSigningCertificates' | 'requestSigningKey'
> {
  /** ESRP Release Service tenant ID */
  tenantId: string;
  /** Auth cert PFX content, probably from an environment variable */
  authCertificatePfx: string;
  /** JWS request signing cert PFX content, probably from an environment variable */
  requestSigningCertificatePfx: string;
}

export interface WorkerData extends Pick<
  CreateESRPReleaseServiceParams,
  'clientId' | 'tenantId' | 'authCertificatePfx' | 'requestSigningCertificatePfx'
> {
  artifactName: string;
  artifactFilePath: string;
  publishAuthToken: AccessToken;
  storageAccountName: string;
  version: string;
}

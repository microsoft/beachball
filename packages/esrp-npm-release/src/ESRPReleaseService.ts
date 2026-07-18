import {
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  type BlobServiceClient,
  type BlockBlobClient,
  type ContainerClient,
  type UserDelegationKey,
} from '@azure/storage-blob';
import { randomUUID } from 'crypto';
import { getAadToken, type AccessToken } from './auth/getAadToken.ts';
import { getKeyAndCertificatesFromPFX } from './auth/signing.ts';
import {
  createNpmReleaseRequest,
  redactReleaseRequest,
  type CreateNpmReleaseRequestMessageParams,
} from './esrpApi/npmRelease.ts';
import { esrpApiScope, getReleaseDetails, getReleaseStatus, submitRelease } from './esrpApi/releaseHttp.ts';
import type { ReleaseResultMessage } from './types/api.ts';
import type { EsrpEnvOptions } from './types/EnvOptions.ts';
import type { Logger } from './utils/Logger.ts';
import { ReleaseError } from './utils/ReleaseError.ts';

interface CreateESRPReleaseServiceParams extends Pick<
  EsrpEnvOptions,
  'clientId' | 'tenantId' | 'authCertificatePfx' | 'requestSigningCertificatePfx'
> {
  logger: Logger;
  /** Azure blob storage client for staging artifact files */
  stagingBlobServiceClient: BlobServiceClient;
}

export interface CreateReleaseParams {
  /** Local zip file path to upload (probably `{zipsDir}/layer-{num}-{timestamp}.zip`) */
  filePath: string;
  /** Repository name only (no organization), used as blob path prefix */
  repoName: string;
  /** Info for creating the release request */
  releaseRequestParams: Omit<
    CreateNpmReleaseRequestMessageParams,
    'correlationId' | 'file' | 'requestSigningCertificates' | 'requestSigningKey'
  >;
}

const stagingContainerName = 'staging';

/**
 * Orchestrates ESRP Release API operations for one or more files.
 * Handles AAD authentication, blob staging, SAS token generation, JWS signing, release submission,
 * and polling for completion.
 *
 * Based on https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/common/publish.ts
 * called by https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/product-publish.yml#L106
 *
 * (The original implementation has an additional step of acquiring a lease on the staging blob to
 * prevent issues with multiple concurrent runs, but this is not an anticipated scenario for npm.)
 */
export class ESRPReleaseService {
  /**
   * Construct a service instance, ensuring the staging container exists upfront.
   * AAD and SAS tokens are acquired per release (in `createRelease`) in case prior releases are slow
   * (unclear if this would be an issue in practice).
   */
  public static async create(params: CreateESRPReleaseServiceParams): Promise<ESRPReleaseService> {
    const { logger } = params;
    let stagingContainerClient: ContainerClient;
    try {
      logger.log(`Getting client and ensuring staging container "${stagingContainerName}" exists`);
      stagingContainerClient = params.stagingBlobServiceClient.getContainerClient(stagingContainerName);
      // this async operation can't be done in the constructor
      await stagingContainerClient.createIfNotExists();
    } catch (err) {
      throw new ReleaseError(`Error ensuring staging container "${stagingContainerName}" exists`, { cause: err });
    }
    return new ESRPReleaseService({ ...params, stagingContainerClient });
  }

  readonly #logger: Logger;
  readonly #clientId: string;
  readonly #tenantId: string;
  readonly #authCertificatePfx: string;
  readonly #requestSigningCertificates: string[];
  readonly #requestSigningKey: string;
  readonly #stagingBlobServiceClient: BlobServiceClient;
  readonly #stagingContainerClient: ContainerClient;

  private constructor(params: CreateESRPReleaseServiceParams & { stagingContainerClient: ContainerClient }) {
    this.#logger = params.logger;
    this.#clientId = params.clientId;
    this.#tenantId = params.tenantId;
    this.#authCertificatePfx = params.authCertificatePfx;
    this.#stagingBlobServiceClient = params.stagingBlobServiceClient;
    this.#stagingContainerClient = params.stagingContainerClient;
    try {
      this.#logger.log('Extracting request signing key and certificates from PFX');
      const { key, certificates } = getKeyAndCertificatesFromPFX(params.requestSigningCertificatePfx, this.#logger);
      this.#requestSigningKey = key;
      this.#requestSigningCertificates = certificates;
    } catch (err) {
      throw new ReleaseError(`Error extracting request signing key and certificates from PFX`, { cause: err });
    }
  }

  /**
   * Release a single file via ESRP and poll for its completion. Throws if not successful.
   *
   * Steps:
   * 1. Acquire a fresh AAD access token and SAS token (re-acquired per release because
   *    previous releases may have been slow enough that prior tokens are near expiry)
   * 2. Upload the file to the staging container under `{repoName}/{correlationId}`
   * 3. Submit the release request and poll until completion
   * 4. Delete the staged blob
   *
   * The recommended bicep template includes a lifecycle management policy to clean up blobs
   * after a given window (3 days as of writing).
   */
  public async createRelease(params: CreateReleaseParams): Promise<void> {
    const { filePath, releaseRequestParams, repoName } = params;

    // Acquire fresh credentials for each release in case earlier slow operations caused
    // the previously-acquired tokens to expire.
    this.#logger.log('Acquiring fresh credentials for release');
    // Get the credentials upfront, so we fail before uploading if there are any issues
    const stagingBlobUserKey = await this.#getStagingBlobUserKey();
    const esrpAccessToken = await this.#getEsrpAccessToken();

    const correlationId = randomUUID();
    const blobName = `${repoName}/${correlationId}`;
    let blobClient: BlockBlobClient;
    try {
      blobClient = this.#stagingContainerClient.getBlockBlobClient(blobName);
    } catch (err) {
      throw new ReleaseError(`Error initializing blob client for staging upload`, { cause: err });
    }

    try {
      this.#logger.log(`Uploading ${filePath} to ${blobClient.url}`);
      await blobClient.uploadFile(filePath).catch(err => {
        throw new ReleaseError(`Error uploading file to staging storage`, { cause: err });
      });

      await this.#submitAndPollRelease({
        filePath,
        correlationId,
        sasBlobUrl: `${blobClient.url}?${this.#generateBlobSas(blobName, stagingBlobUserKey)}`,
        releaseRequestParams,
        esrpAccessToken,
      });
    } finally {
      this.#logger.log(`Deleting blob ${blobClient.url}`);
      try {
        await blobClient.delete();
      } catch (err) {
        this.#logger.warn(`Failed to delete blob:`, err);
      }
    }
  }

  /** Acquire a user delegation key for a single release. */
  async #getStagingBlobUserKey(): Promise<UserDelegationKey> {
    try {
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      this.#logger.log(
        `Requesting user delegation key for staging storage account "${this.#stagingBlobServiceClient.accountName}"`
      );
      return await this.#stagingBlobServiceClient.getUserDelegationKey(
        new Date(now - oneHour),
        new Date(now + oneHour)
      );
    } catch (err) {
      throw new ReleaseError(`Error acquiring user delegation key for staging blob access`, { cause: err });
    }
  }

  /** Get an access token for the ESRP API */
  async #getEsrpAccessToken(): Promise<AccessToken> {
    const scope = `${esrpApiScope}.default`;
    this.#logger.log(`Acquiring AAD access token for ESRP API (scope: ${scope})`);
    return await getAadToken({
      scopes: [scope],
      clientId: this.#clientId,
      tenantId: this.#tenantId,
      auth: { certPfxContent: this.#authCertificatePfx },
      logger: this.#logger,
    }).catch(err => {
      throw new ReleaseError(`Error acquiring access token for ESRP API`, { cause: err });
    });
  }

  /** Generate a SAS token scoped to a single blob (read-only). */
  #generateBlobSas(blobName: string, stagingBlobUserKey: UserDelegationKey): string {
    this.#logger.log(`Generating SAS token for staging blob "${blobName}"`);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    return generateBlobSASQueryParameters(
      {
        containerName: stagingContainerName,
        blobName,
        permissions: BlobSASPermissions.from({ read: true }),
        startsOn: new Date(now - oneHour),
        expiresOn: new Date(now + oneHour),
      },
      stagingBlobUserKey,
      this.#stagingBlobServiceClient.accountName
    ).toString();
  }

  /** Create the release request, submit it to the ESRP API, and poll for completion. */
  async #submitAndPollRelease(
    params: Omit<CreateReleaseParams, 'repoName'> & {
      correlationId: string;
      sasBlobUrl: string;
      esrpAccessToken: AccessToken;
    }
  ): Promise<void> {
    const { filePath, correlationId, sasBlobUrl, releaseRequestParams } = params;
    let { esrpAccessToken } = params;

    this.#logger.log(`Preparing to submit release`);

    const request = await createNpmReleaseRequest({
      ...releaseRequestParams,
      correlationId,
      requestSigningCertificates: this.#requestSigningCertificates,
      requestSigningKey: this.#requestSigningKey,
      file: { path: filePath, sasBlobUrl },
    });

    this.#logger.log(`Sending request to ESRP API: ${JSON.stringify(redactReleaseRequest(request), null, 2)}`);

    const submitReleaseResult = await submitRelease({
      clientId: this.#clientId,
      bearerToken: esrpAccessToken.token,
      releaseRequest: request,
    });

    this.#logger.log(`Successfully submitted release ${submitReleaseResult.operationId}. Polling for completion...`);

    // Poll every 5 seconds, wait 60 minutes max -> poll 60/5*60=720 times
    let releaseStatus: ReleaseResultMessage | undefined;
    let lastLoggedStatus: string | undefined;
    for (let i = 0; i < 720; i++) {
      await new Promise(c => setTimeout(c, 5000));

      // AAD client-credential tokens are typically valid for ~1 hour. Since polling can run
      // for up to 60 minutes (and was preceded by upload + submit), the original token can
      // expire mid-poll. Refresh proactively when within 5 minutes of expiry.
      esrpAccessToken = await this.#refreshEsrpAccessTokenIfNeeded(esrpAccessToken);

      releaseStatus = await getReleaseStatus({
        clientId: this.#clientId,
        bearerToken: esrpAccessToken.token,
        releaseId: submitReleaseResult.operationId,
      });

      // Log only on status changes to avoid spamming the log on every poll
      if (releaseStatus.status !== lastLoggedStatus) {
        this.#logger.log(`Release status: "${releaseStatus.status}"`);
        lastLoggedStatus = releaseStatus.status;
      }

      if (this.#checkReleaseStatus(releaseStatus, submitReleaseResult.operationId)) {
        break;
      }
    }

    if (releaseStatus?.status !== 'pass') {
      throw new ReleaseError(
        `Timed out waiting for release. Most recent status API response: ${JSON.stringify(releaseStatus, null, 2)}`
      );
    }

    // Packages are already published at this point. Fetching details is diagnostic only —
    // if it fails, log a warning so the caller can still mark the layer published.
    this.#logger.log(`Release ${submitReleaseResult.operationId} passed; fetching release details`);
    try {
      const releaseDetails = await getReleaseDetails({
        clientId: this.#clientId,
        bearerToken: esrpAccessToken.token,
        releaseId: submitReleaseResult.operationId,
      });
      this.#logger.log('Release details:', JSON.stringify(redactReleaseRequest(releaseDetails), null, 2));
    } catch (err) {
      this.#logger.warn(
        `Release ${submitReleaseResult.operationId} succeeded but fetching details failed; ` +
          `continuing so the layer can be marked published:`,
        err
      );
    }
  }

  /**
   * AAD client-credential tokens are typically valid for ~1 hour. Since polling can run
   * for up to 60 minutes (and was preceded by upload + submit), the original token can
   * expire mid-poll. Refresh proactively when within 5 minutes of expiry.
   */
  async #refreshEsrpAccessTokenIfNeeded(esrpAccessToken: AccessToken): Promise<AccessToken> {
    const { expiresOnTimestamp, refreshAfterTimestamp } = esrpAccessToken;
    const refreshAt = refreshAfterTimestamp ?? expiresOnTimestamp - 5 * 60 * 1000;
    if (Date.now() >= refreshAt) {
      this.#logger.log('AAD access token near expiry, refreshing');
      return await this.#getEsrpAccessToken();
    }
    return esrpAccessToken;
  }

  /**
   * Returns true if the release status is 'pass', or false if in progress.
   * Throws `ReleaseError` on issues.
   */
  #checkReleaseStatus(releaseStatus: ReleaseResultMessage, releaseId: string): boolean {
    const releaseStr = JSON.stringify(releaseStatus, null, 2);
    const fullStatusApiResponse = `Full status API response: ${releaseStr}`;

    if (releaseStatus.status === 'pass') {
      this.#logger.log(`Release ${releaseId} passed. Last status details: ${releaseStr}`);
      return true;
    }

    // Check for a 404 on publish and give a specific error
    const errorDetails = (releaseStatus.errorInfo || releaseStatus.errorinfo)?.details?.errors;
    if (errorDetails && /^404.*?PUT.*?registry\.npmjs\.org/.test(errorDetails)) {
      throw new ReleaseError(
        `Release failed with 404 on npm publish: ${errorDetails}\nThis usually indicates an auth issue, ` +
          `such as expired credentials or missing permissions. Please contact the ESRP team for help.\n\n` +
          fullStatusApiResponse
      );
    }
    // TODO: mismatch with values included in provided types
    if ((releaseStatus.status as unknown) === 'aborted' || releaseStatus.status === 'cancelled') {
      throw new ReleaseError(`Release was aborted. ${fullStatusApiResponse}`);
    }
    if (releaseStatus.status !== 'inprogress') {
      throw new ReleaseError(`Unexpected release status "${releaseStatus.status}". ${fullStatusApiResponse}`);
    }
    return false;
  }
}

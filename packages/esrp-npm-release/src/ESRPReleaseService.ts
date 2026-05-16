import {
  type BlobServiceClient,
  type BlockBlobClient,
  type ContainerClient,
  type UserDelegationKey,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import { randomUUID } from 'crypto';
import {
  createNpmReleaseRequest,
  redactReleaseRequest,
  type CreateNpmReleaseRequestMessageParams,
} from './models/npmRelease.ts';
import type { ReleaseResultMessage, ReleaseSubmitResponse } from './models/types.ts';
import { getAadToken, type AccessToken } from './utils/getAadToken.ts';
import type { Logger } from './utils/Logger.ts';
import { ReleaseError } from './utils/ReleaseError.ts';
import { esrpApiEndpoint, getReleaseDetails, getReleaseStatus, submitRelease } from './utils/releaseHttp.ts';
import { getKeyAndCertificatesFromPFX } from './utils/signing.ts';

interface PerReleaseCredentials {
  esrpAccessToken: AccessToken;
  userDelegationKey: UserDelegationKey;
}

interface CreateESRPReleaseServiceParams {
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
}

interface ESRPReleaseServiceParams extends CreateESRPReleaseServiceParams {
  stagingContainerClient: ContainerClient;
}

export interface CreateReleaseParams {
  /** Local file path to upload */
  filePath: string;
  stagingBlobPathPrefix: string;
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

  private constructor(params: ESRPReleaseServiceParams) {
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
   * 2. Upload the file to the staging container
   * 3. Submit the release request and poll until completion
   * 4. Delete the staged blob
   *
   * The recommended bicep template includes a lifecycle management policy to clean up blobs
   * after a given window (3 days as of writing).
   */
  public async createRelease(params: CreateReleaseParams): Promise<void> {
    const { filePath, releaseRequestParams, stagingBlobPathPrefix } = params;

    // Acquire fresh credentials for each release in case earlier slow operations caused
    // the previously-acquired AAD/SAS tokens to expire.
    this.#logger.log('Acquiring fresh credentials for release');
    const credentials = await this.#acquireCredentials();

    const correlationId = randomUUID();
    const blobName = `${stagingBlobPathPrefix}/${correlationId}`;
    let blobClient: BlockBlobClient;
    try {
      blobClient = this.#stagingContainerClient.getBlockBlobClient(blobName);
    } catch (err) {
      throw new ReleaseError(`Error initializing blob client for staging upload`, { cause: err });
    }

    // filePath is <layerNum>-<timestamp>.zip
    this.#logger.log(`Uploading ${filePath} to ${blobClient.url}`);
    await blobClient.uploadFile(filePath).catch(err => {
      throw new ReleaseError(`Error uploading file to staging storage`, { cause: err });
    });

    try {
      await this.#submitAndPollRelease({
        filePath,
        correlationId,
        sasBlobUrl: `${blobClient.url}?${this.#generateBlobSas(blobName, credentials.userDelegationKey)}`,
        releaseRequestParams,
        credentials,
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

  /** Acquire a fresh AAD token and user delegation key for a single release. */
  async #acquireCredentials(): Promise<PerReleaseCredentials> {
    const esrpAccessToken = await this.#getEsrpAccessToken();

    let userDelegationKey: UserDelegationKey;
    try {
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      this.#logger.log(
        `Requesting user delegation key for staging storage account "${this.#stagingBlobServiceClient.accountName}"`
      );
      userDelegationKey = await this.#stagingBlobServiceClient.getUserDelegationKey(
        new Date(now - oneHour),
        new Date(now + oneHour)
      );
    } catch (err) {
      throw new ReleaseError(`Error generating SAS token for staging blob access`, { cause: err });
    }

    return { esrpAccessToken, userDelegationKey };
  }

  async #getEsrpAccessToken(): Promise<AccessToken> {
    this.#logger.log(`Acquiring AAD access token for ESRP API at ${esrpApiEndpoint}`);
    return await getAadToken({
      scopes: [`${esrpApiEndpoint}.default`],
      clientId: this.#clientId,
      tenantId: this.#tenantId,
      auth: { certPfxContent: this.#authCertificatePfx },
      logger: this.#logger,
    }).catch(err => {
      throw new ReleaseError(`Error acquiring access token for ESRP API`, { cause: err });
    });
  }

  /**
   * Generate a SAS token scoped to a single blob (read-only). Scoping to the specific blob
   * (rather than the container) limits the blast radius if the SAS URL leaks: only this
   * release's zip is readable, not every blob staged in the container.
   */
  #generateBlobSas(blobName: string, userDelegationKey: UserDelegationKey): string {
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
      userDelegationKey,
      this.#stagingBlobServiceClient.accountName
    ).toString();
  }

  async #submitAndPollRelease(
    params: Omit<CreateReleaseParams, 'stagingBlobPathPrefix'> & {
      correlationId: string;
      sasBlobUrl: string;
      credentials: PerReleaseCredentials;
    }
  ): Promise<void> {
    const { credentials } = params;

    const submitReleaseResult = await this.#submitRelease(params);
    if (!submitReleaseResult.operationId) {
      // probably impossible?
      throw new ReleaseError('Missing operationId on submitReleaseResult');
    }

    this.#logger.log(`Successfully submitted release ${submitReleaseResult.operationId}. Polling for completion...`);

    // Poll every 5 seconds, wait 60 minutes max -> poll 60/5*60=720 times
    let releaseStatus: ReleaseResultMessage | undefined;
    let lastLoggedStatus: string | undefined;
    for (let i = 0; i < 720; i++) {
      await new Promise(c => setTimeout(c, 5000));

      // AAD client-credential tokens are typically valid for ~1 hour. Since polling can run
      // for up to 60 minutes (and was preceded by upload + submit), the original token can
      // expire mid-poll. Refresh proactively when within 5 minutes of expiry.
      await this.#refreshEsrpAccessTokenIfNeeded(credentials);

      releaseStatus = await getReleaseStatus({
        clientId: this.#clientId,
        bearerToken: credentials.esrpAccessToken.token,
        releaseId: submitReleaseResult.operationId,
      }).catch(err => {
        throw new ReleaseError(`Failed to get release status`, { cause: err });
      });

      // Log only on status changes to avoid spamming the log on every poll
      if (releaseStatus.status !== lastLoggedStatus) {
        this.#logger.log(`Release status: "${releaseStatus.status}"`);
        lastLoggedStatus = releaseStatus.status;
      }

      const releaseStr = JSON.stringify(releaseStatus, null, 2);
      if (releaseStatus.status === 'pass') {
        this.#logger.log(`Release ${submitReleaseResult.operationId} passed. Last status details: ${releaseStr}`);
        break;
      }
      // TODO: mismatch with values included in provided types
      if ((releaseStatus.status as unknown) === 'aborted' || releaseStatus.status === 'cancelled') {
        throw new ReleaseError(`Release was aborted. Full status API response: ${releaseStr}`);
      }
      if (releaseStatus.status !== 'inprogress') {
        throw new ReleaseError(
          `Unexpected release status "${releaseStatus.status}". Full status API response: ${releaseStr}`
        );
      }
    }

    if (releaseStatus?.status !== 'pass') {
      throw new ReleaseError(
        `Timed out waiting for release. Most recent status API response: ${JSON.stringify(releaseStatus, null, 2)}`
      );
    }

    // Packages are already published at this point. Fetching details is diagnostic only —
    // if it fails, log a warning so the caller can still mark the layer published, otherwise
    // a retry would attempt to republish versions that already exist on npm.
    this.#logger.log(`Release ${submitReleaseResult.operationId} passed; fetching release details`);
    try {
      const releaseDetails = await getReleaseDetails({
        clientId: this.#clientId,
        bearerToken: credentials.esrpAccessToken.token,
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
   * Create and submit a release request.
   * (This should internally catch any errors and re-throw an appropriate `ReleaseError`.)
   */
  async #submitRelease(
    params: Omit<CreateReleaseParams, 'stagingBlobPathPrefix'> & {
      correlationId: string;
      sasBlobUrl: string;
      credentials: PerReleaseCredentials;
    }
  ): Promise<ReleaseSubmitResponse> {
    const { filePath, correlationId, sasBlobUrl, releaseRequestParams, credentials } = params;

    this.#logger.log(`Preparing to submit release`);

    const request = await createNpmReleaseRequest({
      ...releaseRequestParams,
      correlationId,
      requestSigningCertificates: this.#requestSigningCertificates,
      requestSigningKey: this.#requestSigningKey,
      file: {
        path: filePath,
        sasBlobUrl,
      },
    });

    this.#logger.log(`Sending request to ESRP API: ${JSON.stringify(redactReleaseRequest(request), null, 2)}`);

    return await submitRelease({
      clientId: this.#clientId,
      bearerToken: credentials.esrpAccessToken.token,
      releaseRequest: request,
    }).catch(err => {
      throw new ReleaseError(`Failed to submit release`, { cause: err });
    });
  }

  async #refreshEsrpAccessTokenIfNeeded(credentials: PerReleaseCredentials): Promise<void> {
    const { expiresOnTimestamp, refreshAfterTimestamp } = credentials.esrpAccessToken;
    // Refresh 5 minutes before expiry so the next API call doesn't race the boundary.
    const refreshAt = refreshAfterTimestamp ?? expiresOnTimestamp - 5 * 60 * 1000;
    if (Date.now() >= refreshAt) {
      this.#logger.log('AAD access token near expiry, refreshing');
      credentials.esrpAccessToken = await this.#getEsrpAccessToken();
    }
  }
}

import type { BlockBlobClient, ContainerClient } from '@azure/storage-blob';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { createNpmReleaseRequest } from './models/npmRelease.ts';
import { FileHashType, type ReleaseResultMessage, type ReleaseSubmitResponse } from './models/types.ts';
import type { CreateESRPReleaseServiceParams, ESRPReleaseServiceParams } from './types.ts';
import { generateJwsToken } from './utils/generateJwsToken.ts';
import { esrpApiEndpoint, getAadToken } from './utils/getAadToken.ts';
import { getReleaseDetails, getReleaseStatus, submitRelease } from './utils/releaseHttp.ts';
import { getKeyAndCertificatesFromPFX, hashFileStream } from './utils/signing.ts';
import { ReleaseError } from './utils/ReleaseError.ts';
import type { Logger } from './utils/Logger.ts';

interface CreateReleaseParams {
  filePath: string;
  friendlyFileName: string;
}

export class ESRPReleaseService {
  static async create(params: CreateESRPReleaseServiceParams): Promise<ESRPReleaseService> {
    const { authCertificatePfx, tenantId, ...thruParams } = params;

    const accessToken = await getAadToken({
      endpoint: esrpApiEndpoint,
      clientId: params.clientId,
      tenantId,
      auth: { certPfxContent: authCertificatePfx },
    }).catch(err => {
      throw new ReleaseError(`Error acquiring access token for ESRP API`, { cause: err });
    });

    return new ESRPReleaseService({ accessToken: accessToken.token, ...thruParams });
  }

  readonly #releaseRequestParams: ESRPReleaseServiceParams['releaseRequestParams'];
  readonly #logger: Logger;
  readonly #clientId: string;
  readonly #accessToken: string;
  readonly #requestSigningCertificates: string[];
  readonly #requestSigningKey: string;
  readonly #stagingContainerClient: ContainerClient;
  readonly #stagingSasToken: string;

  private constructor(params: ESRPReleaseServiceParams) {
    this.#releaseRequestParams = params.releaseRequestParams;
    this.#logger = params.logger;
    this.#clientId = params.clientId;
    this.#accessToken = params.accessToken;
    this.#stagingContainerClient = params.stagingContainerClient;
    this.#stagingSasToken = params.stagingSasToken;
    // TODO refactor to do this once and pass in memory
    const { key, certificates } = getKeyAndCertificatesFromPFX(params.requestSigningCertificatePfx);
    this.#requestSigningKey = key;
    this.#requestSigningCertificates = certificates;
  }

  /**
   * Create a release and poll for its completion.
   * Throws if not successful.
   */
  async createRelease(params: CreateReleaseParams): Promise<void> {
    const { filePath } = params;
    const correlationId = randomUUID();
    let blobClient: BlockBlobClient;
    try {
      blobClient = this.#stagingContainerClient.getBlockBlobClient(correlationId);
    } catch (err) {
      throw new ReleaseError(`Error initializing blob client for staging upload`, { cause: err });
    }

    this.#logger.log(`Uploading ${filePath} to ${blobClient.url}`);
    await blobClient.uploadFile(filePath).catch(err => {
      throw new ReleaseError(`Error uploading file to staging storage`, { cause: err });
    });
    this.#logger.log('Uploaded blob successfully');

    try {
      await this.#submitAndPollRelease({ ...params, correlationId, blobUrl: blobClient.url });
    } finally {
      this.#logger.log(`Deleting blob ${blobClient.url}`);
      try {
        await blobClient.delete();
        this.#logger.log('Deleted blob successfully');
      } catch (err) {
        this.#logger.warn(`Failed to delete blob:`, err);
      }
    }
  }

  async #submitAndPollRelease(params: CreateReleaseParams & { correlationId: string; blobUrl: string }): Promise<void> {
    const { filePath, friendlyFileName, correlationId, blobUrl } = params;

    this.#logger.log(`Submitting release: ${filePath}`);

    const submitReleaseResult = await this.#submitRelease({
      filePath,
      friendlyFileName,
      correlationId,
      blobClientUrl: blobUrl,
    });
    if (!submitReleaseResult.operationId) {
      // probably impossible?
      throw new ReleaseError('Missing operationId on submitReleaseResult');
    }

    this.#logger.log(`Successfully submitted release ${submitReleaseResult.operationId}. Polling for completion...`);

    // Poll every 5 seconds, wait 60 minutes max -> poll 60/5*60=720 times
    let releaseStatus: ReleaseResultMessage | undefined;
    for (let i = 0; i < 720; i++) {
      await new Promise(c => setTimeout(c, 5000));
      releaseStatus = await getReleaseStatus({
        clientId: this.#clientId,
        bearerToken: this.#accessToken,
        releaseId: submitReleaseResult.operationId,
      }).catch(err => {
        throw new ReleaseError(`Failed to get release status`, { cause: err });
      });

      if (releaseStatus.status === 'pass') {
        break;
      }
      // TODO: mismatch with values included in provided types
      if ((releaseStatus.status as unknown) === 'aborted' || releaseStatus.status === 'cancelled') {
        throw new ReleaseError(
          `Release was aborted. Full status API response: ${JSON.stringify(releaseStatus, null, 2)}`
        );
      }
      if (releaseStatus.status !== 'inprogress') {
        throw new ReleaseError(
          `Unexpected release status "${releaseStatus.status}". Full status API response: ${JSON.stringify(releaseStatus, null, 2)}`
        );
      }
    }

    if (releaseStatus?.status !== 'pass') {
      throw new ReleaseError(
        `Timed out waiting for release. Most recent status API response: ${JSON.stringify(releaseStatus, null, 2)}`
      );
    }

    const releaseDetails = await getReleaseDetails({
      clientId: this.#clientId,
      bearerToken: this.#accessToken,
      releaseId: submitReleaseResult.operationId,
    }).catch(err => {
      throw new ReleaseError('Release appeared to succeed, but there was an error getting release details', {
        cause: err,
      });
    });

    this.#logger.log('Release details:', JSON.stringify(releaseDetails, null, 2));
  }

  /**
   * Create and submit a release request.
   * (This should internally catch any errors and and re-throw an appropriate `ReleaseError`.)
   */
  async #submitRelease(
    params: CreateReleaseParams & { correlationId: string; blobClientUrl: string }
  ): Promise<ReleaseSubmitResponse> {
    const { filePath, friendlyFileName, correlationId, blobClientUrl } = params;

    let size: number;
    let hash: Buffer;
    try {
      size = fs.statSync(filePath).size;
      // Hash the file with a stream--most package tarballs are small, but some are not
      hash = await hashFileStream('sha256', filePath);
    } catch (err) {
      throw new ReleaseError(`Failed to stat or hash file ${filePath}`, { cause: err });
    }
    const blobUrl = `${blobClientUrl}?${this.#stagingSasToken}`;

    const message = createNpmReleaseRequest({
      ...this.#releaseRequestParams,
      correlationId,
    });
    message.files = [
      {
        name: path.basename(filePath),
        friendlyFileName,
        tenantFileLocation: blobUrl,
        tenantFileLocationType: 'AzureBlob',
        sourceLocation: { type: 'azureBlob', blobUrl },
        hashType: FileHashType.sha256,
        hash: Array.from(hash) as unknown as string,
        sizeInBytes: size,
      },
    ];

    try {
      message.jwsToken = generateJwsToken({
        releaseRequest: message,
        certificates: this.#requestSigningCertificates,
        privateKey: this.#requestSigningKey,
      });
    } catch (err) {
      throw new ReleaseError(`Failed to generate JWS token for release request`, { cause: err });
    }

    return await submitRelease({
      clientId: this.#clientId,
      bearerToken: this.#accessToken,
      releaseRequest: message,
    }).catch(err => {
      throw new ReleaseError(`Failed to submit release`, { cause: err });
    });
  }
}

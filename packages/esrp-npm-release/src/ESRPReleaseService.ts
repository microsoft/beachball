import type { ContainerClient } from '@azure/storage-blob';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { FileHashType, type ReleaseSubmitResponse } from './models/types.ts';
import { getCertificatesFromPFX, getKeyFromPFX, hashFileStream } from './utils/signing.ts';
import { getReleaseDetails, getReleaseStatus, submitRelease } from './utils/releaseHttp.ts';
import { generateJwsToken } from './utils/generateJwsToken.ts';
import { createNpmReleaseRequest, type CreateNpmReleaseRequestMessageParams } from './models/npmRelease.ts';
import { esrpApiEndpoint, getAadToken } from './utils/getAadToken.ts';
import type { CreateESRPReleaseServiceParams, ESRPReleaseServiceParams } from './types.ts';

interface CreateReleaseParams {
  version: string;
  filePath: string;
  friendlyFileName: string;
}

export class ESRPReleaseService {
  static async create(params: CreateESRPReleaseServiceParams): Promise<ESRPReleaseService> {
    const {
      authCertificatePfx,
      requestSigningCertificatePfx,
      tenantId,
      clientId,
      stagingContainerClient,
      stagingSasToken,
      ...thruParams
    } = params;

    const requestSigningKey = getKeyFromPFX(requestSigningCertificatePfx);
    const requestSigningCertificates = getCertificatesFromPFX(requestSigningCertificatePfx);

    const accessToken = await getAadToken({
      endpoint: esrpApiEndpoint,
      clientId,
      tenantId,
      auth: { certPfxContent: authCertificatePfx },
    });

    return new ESRPReleaseService({
      clientId,
      accessToken: accessToken.token,
      requestSigningCertificates,
      requestSigningKey,
      stagingContainerClient,
      stagingSasToken,
      ...thruParams,
    });
  }

  readonly #releaseRequestParams: CreateNpmReleaseRequestMessageParams;
  readonly #log: (...args: unknown[]) => void;
  readonly #clientId: string;
  readonly #accessToken: string;
  readonly #requestSigningCertificates: string[];
  readonly #requestSigningKey: string;
  readonly #stagingContainerClient: ContainerClient;
  readonly #stagingSasToken: string;

  private constructor(params: ESRPReleaseServiceParams) {
    this.#releaseRequestParams = params.releaseRequestParams;
    this.#log = params.log;
    this.#clientId = params.clientId;
    this.#accessToken = params.accessToken;
    this.#requestSigningCertificates = params.requestSigningCertificates;
    this.#requestSigningKey = params.requestSigningKey;
    this.#stagingContainerClient = params.stagingContainerClient;
    this.#stagingSasToken = params.stagingSasToken;
  }

  /**
   * Create a release and poll for its completion.
   * Throws if not successful.
   */
  async createRelease(params: CreateReleaseParams): Promise<void> {
    const { version, filePath, friendlyFileName } = params;
    const correlationId = randomUUID();
    const blobClient = this.#stagingContainerClient.getBlockBlobClient(correlationId);

    this.#log(`Uploading ${filePath} to ${blobClient.url}`);
    await blobClient.uploadFile(filePath);
    this.#log('Uploaded blob successfully');

    try {
      this.#log(`Submitting release for ${version}: ${filePath}`);
      const submitReleaseResult = await this.#submitRelease({
        version,
        filePath,
        friendlyFileName,
        correlationId,
        blobClientUrl: blobClient.url,
      });

      if (!submitReleaseResult.operationId) {
        // appears to be impossible?
        throw new Error('Missing operationId on submitReleaseResult');
      }

      this.#log(`Successfully submitted release ${submitReleaseResult.operationId}. Polling for completion...`);

      // Poll every 5 seconds, wait 60 minutes max -> poll 60/5*60=720 times
      for (let i = 0; i < 720; i++) {
        await new Promise(c => setTimeout(c, 5000));
        const releaseStatus = await getReleaseStatus({
          clientId: this.#clientId,
          bearerToken: this.#accessToken,
          releaseId: submitReleaseResult.operationId,
        });

        if (releaseStatus.status === 'pass') {
          break;
          // TODO: mismatch with values included in provided types
        } else if ((releaseStatus.status as unknown) === 'aborted' || releaseStatus.status === 'cancelled') {
          this.#log(JSON.stringify(releaseStatus));
          throw new Error(`Release was aborted`);
        } else if (releaseStatus.status !== 'inprogress') {
          this.#log(JSON.stringify(releaseStatus));
          throw new Error(`Unknown error when polling for release`);
        }
      }

      const releaseDetails = await getReleaseDetails({
        clientId: this.#clientId,
        bearerToken: this.#accessToken,
        releaseId: submitReleaseResult.operationId,
      });

      if (releaseDetails.status !== 'pass') {
        throw new Error(`Timed out waiting for release: ${JSON.stringify(releaseDetails)}`);
      }

      this.#log('Release details:', JSON.stringify(releaseDetails, null, 2));
    } finally {
      this.#log(`Deleting blob ${blobClient.url}`);
      await blobClient.delete();
      this.#log('Deleted blob successfully');
    }
  }

  async #submitRelease(
    params: CreateReleaseParams & { correlationId: string; blobClientUrl: string }
  ): Promise<ReleaseSubmitResponse> {
    const { version, filePath, friendlyFileName, correlationId, blobClientUrl } = params;

    const size = fs.statSync(filePath).size;
    const hash = await hashFileStream('sha256', filePath);
    const blobUrl = `${blobClientUrl}?${this.#stagingSasToken}`;

    const message = createNpmReleaseRequest(this.#releaseRequestParams);
    message.esrpCorrelationId = correlationId;
    message.customerCorrelationId = correlationId;
    message.productInfo.version = version;
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

    message.jwsToken = generateJwsToken({
      releaseRequest: message,
      certificates: this.#requestSigningCertificates,
      privateKey: this.#requestSigningKey,
    });

    return await submitRelease({
      clientId: this.#clientId,
      bearerToken: this.#accessToken,
      releaseRequest: message,
    });
  }
}

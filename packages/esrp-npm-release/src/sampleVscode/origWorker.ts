/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import fs from 'fs';
import path from 'path';
import type { Readable } from 'stream';
import crypto from 'crypto';
import cp from 'child_process';
import os from 'os';
import { workerData } from 'node:worker_threads';
import { ConfidentialClientApplication } from '@azure/msal-node';
import {
  type BlobClient,
  type BlockBlobClient,
  type ContainerClient,
  BlobServiceClient,
  ContainerSASPermissions,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import jws from 'jws';
import { clearInterval, setInterval } from 'node:timers';
import type {
  FileHashType,
  ReleaseDetailsMessage,
  ReleaseRequestMessage,
  ReleaseResultMessage,
  ReleaseSubmitResponse,
} from '../models/types.ts';
import { env } from './common.ts';
import { retry } from '../utils/retry.ts';
import type { Artifact } from './common.ts';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const { artifact, artifactFilePath } = workerData;
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
await processArtifact(artifact, artifactFilePath);

function hashStream(hashName: string, stream: Readable): Promise<Buffer> {
  return new Promise<Buffer>((c, e) => {
    const shasum = crypto.createHash(hashName);

    stream
      .on('data', shasum.update.bind(shasum))
      .on('error', e)
      .on('close', () => c(shasum.digest()));
  });
}

/**
 * Convert a certificate from PEM format (base64 text with header/footer) into the raw
 * DER binary format.
 */
function pemToDer(input: string): Buffer {
  return Buffer.from(input.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, ''), 'base64');
}

/** Get the thumbprint of a certificate with the specified algorithm */
function getThumbprint(certPem: string, algorithm: 'sha1' | 'sha256'): Buffer {
  const certDer = pemToDer(certPem);
  return crypto.createHash(algorithm).update(certDer).digest();
}

function getKeyFromPFX(pfx: string): string {
  const pfxCertificatePath = path.join(os.tmpdir(), 'cert.pfx');
  const pemKeyPath = path.join(os.tmpdir(), 'key.pem');

  try {
    const pfxCertificate = Buffer.from(pfx, 'base64');
    fs.writeFileSync(pfxCertificatePath, pfxCertificate);
    cp.execSync(`openssl pkcs12 -in "${pfxCertificatePath}" -nocerts -nodes -out "${pemKeyPath}" -passin pass:`);
    const raw = fs.readFileSync(pemKeyPath, 'utf-8');
    const result = raw.match(/-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/g)![0];
    return result;
  } finally {
    fs.rmSync(pfxCertificatePath, { force: true });
    fs.rmSync(pemKeyPath, { force: true });
  }
}

function getCertificatesFromPFX(pfx: string): string[] {
  const pfxCertificatePath = path.join(os.tmpdir(), 'cert.pfx');
  const pemCertificatePath = path.join(os.tmpdir(), 'cert.pem');

  try {
    const pfxCertificate = Buffer.from(pfx, 'base64');
    fs.writeFileSync(pfxCertificatePath, pfxCertificate);
    cp.execSync(`openssl pkcs12 -in "${pfxCertificatePath}" -nokeys -out "${pemCertificatePath}" -passin pass:`);
    const raw = fs.readFileSync(pemCertificatePath, 'utf-8');
    const matches = raw.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
    return matches ? matches.reverse() : [];
  } finally {
    fs.rmSync(pfxCertificatePath, { force: true });
    fs.rmSync(pemCertificatePath, { force: true });
  }
}

class ESRPReleaseService {
  static async create(params: {
    log: (...args: unknown[]) => void;
    tenantId: string;
    clientId: string;
    authCertificatePfx: string;
    requestSigningCertificatePfx: string;
    containerClient: ContainerClient;
    stagingSasToken: string;
  }) {
    const {
      log,
      tenantId,
      clientId,
      authCertificatePfx,
      requestSigningCertificatePfx,
      containerClient,
      stagingSasToken,
    } = params;
    const authKey = getKeyFromPFX(authCertificatePfx);
    const authCertificate = getCertificatesFromPFX(authCertificatePfx)[0];
    const requestSigningKey = getKeyFromPFX(requestSigningCertificatePfx);
    const requestSigningCertificates = getCertificatesFromPFX(requestSigningCertificatePfx);

    const app = new ConfidentialClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        clientCertificate: {
          thumbprintSha256: getThumbprint(authCertificate, 'sha256').toString('hex'),
          privateKey: authKey,
          x5c: authCertificate,
        },
      },
    });

    const response = await app.acquireTokenByClientCredential({
      scopes: ['https://api.esrp.microsoft.com/.default'],
    });

    return new ESRPReleaseService({
      log,
      clientId,
      accessToken: response!.accessToken,
      requestSigningCertificates,
      requestSigningKey,
      containerClient,
      stagingSasToken,
    });
  }

  private static API_URL = 'https://api.esrp.microsoft.com/api/v3/releaseservices/clients/';

  private readonly log: (...args: unknown[]) => void;
  private readonly clientId: string;
  private readonly accessToken: string;
  private readonly requestSigningCertificates: string[];
  private readonly requestSigningKey: string;
  private readonly containerClient: ContainerClient;
  private readonly stagingSasToken: string;

  private constructor(params: {
    log: (...args: unknown[]) => void;
    clientId: string;
    accessToken: string;
    requestSigningCertificates: string[];
    requestSigningKey: string;
    containerClient: ContainerClient;
    stagingSasToken: string;
  }) {
    const {
      log,
      clientId,
      accessToken,
      requestSigningCertificates,
      requestSigningKey,
      containerClient,
      stagingSasToken,
    } = params;
    this.log = log;
    this.clientId = clientId;
    this.accessToken = accessToken;
    this.requestSigningCertificates = requestSigningCertificates;
    this.requestSigningKey = requestSigningKey;
    this.containerClient = containerClient;
    this.stagingSasToken = stagingSasToken;
  }

  async createRelease(version: string, filePath: string, friendlyFileName: string) {
    const correlationId = crypto.randomUUID();
    const blobClient = this.containerClient.getBlockBlobClient(correlationId);

    this.log(`Uploading ${filePath} to ${blobClient.url}`);
    await blobClient.uploadFile(filePath);
    this.log('Uploaded blob successfully');

    try {
      this.log(`Submitting release for ${version}: ${filePath}`);
      const submitReleaseResult = await this.submitRelease(
        version,
        filePath,
        friendlyFileName,
        correlationId,
        blobClient
      );

      this.log(`Successfully submitted release ${submitReleaseResult.operationId}. Polling for completion...`);

      // Poll every 5 seconds, wait 60 minutes max -> poll 60/5*60=720 times
      for (let i = 0; i < 720; i++) {
        await new Promise(c => setTimeout(c, 5000));
        const releaseStatus = await this.getReleaseStatus(submitReleaseResult.operationId!);

        if (releaseStatus.status === 'pass') {
          break;
        } else if ((releaseStatus.status as any) === 'aborted' || releaseStatus.status === 'cancelled') {
          this.log(JSON.stringify(releaseStatus));
          throw new Error(`Release was aborted`);
        } else if (releaseStatus.status !== 'inprogress') {
          this.log(JSON.stringify(releaseStatus));
          throw new Error(`Unknown error when polling for release`);
        }
      }

      const releaseDetails = await this.getReleaseDetails(submitReleaseResult.operationId!);

      if (releaseDetails.status !== 'pass') {
        throw new Error(`Timed out waiting for release: ${JSON.stringify(releaseDetails)}`);
      }

      this.log('Successfully created release:', releaseDetails.files![0].fileDownloadDetails![0].downloadUrl);
      return releaseDetails.files![0].fileDownloadDetails![0].downloadUrl;
    } finally {
      this.log(`Deleting blob ${blobClient.url}`);
      await blobClient.delete();
      this.log('Deleted blob successfully');
    }
  }

  private async submitRelease(
    version: string,
    filePath: string,
    friendlyFileName: string,
    correlationId: string,
    blobClient: BlobClient
  ): Promise<ReleaseSubmitResponse> {
    const size = fs.statSync(filePath).size;
    const hash = await hashStream('sha256', fs.createReadStream(filePath));
    const blobUrl = `${blobClient.url}?${this.stagingSasToken}`;

    const message: ReleaseRequestMessage = {
      customerCorrelationId: correlationId,
      esrpCorrelationId: correlationId,
      driEmail: ['joao.moreno@microsoft.com'],
      createdBy: { userPrincipalName: 'jomo@microsoft.com' },
      owners: [{ owner: { userPrincipalName: 'jomo@microsoft.com' } }],
      approvers: [
        {
          approver: { userPrincipalName: 'jomo@microsoft.com' },
          isAutoApproved: true,
          isMandatory: false,
        },
      ],
      releaseInfo: {
        title: 'VS Code',
        properties: {
          ReleaseContentType: 'InstallPackage',
        },
        minimumNumberOfApprovers: 1,
      },
      productInfo: {
        name: 'VS Code',
        version,
        description: 'VS Code',
      },
      accessPermissionsInfo: {
        mainPublisher: 'VSCode',
        channelDownloadEntityDetails: {
          AllDownloadEntities: ['VSCode'],
        },
      },
      routingInfo: {
        intent: 'filedownloadlinkgeneration',
      },
      files: [
        {
          name: path.basename(filePath),
          friendlyFileName,
          tenantFileLocation: blobUrl,
          tenantFileLocationType: 'AzureBlob',
          sourceLocation: {
            type: 'azureBlob',
            blobUrl,
          },
          hashType: 'sha256' as unknown as FileHashType,
          hash: Array.from(hash) as unknown as string,
          sizeInBytes: size,
        },
      ],
    };

    message.jwsToken = await this.generateJwsToken(message);

    const res = await fetch(`${ESRPReleaseService.API_URL}${this.clientId}/workflows/release/operations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to submit release: ${res.statusText}\n${text}`);
    }

    return (await res.json()) as ReleaseSubmitResponse;
  }

  private async getReleaseStatus(releaseId: string): Promise<ReleaseResultMessage> {
    const url = `${ESRPReleaseService.API_URL}${this.clientId}/workflows/release/operations/grs/${releaseId}`;

    const res = await retry(() =>
      fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to get release status: ${res.statusText}\n${text}`);
    }

    return (await res.json()) as ReleaseResultMessage;
  }

  private async getReleaseDetails(releaseId: string): Promise<ReleaseDetailsMessage> {
    const url = `${ESRPReleaseService.API_URL}${this.clientId}/workflows/release/operations/grd/${releaseId}`;

    const res = await retry(() =>
      fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to get release status: ${res.statusText}\n${text}`);
    }

    return (await res.json()) as ReleaseDetailsMessage;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async generateJwsToken(message: ReleaseRequestMessage): Promise<string> {
    // Create header with properly typed properties, then override x5c with the non-standard string format
    const header: jws.Header = {
      alg: 'RS256',
      crit: ['exp', 'x5t'],
      // Release service uses ticks, not seconds :roll_eyes: (https://stackoverflow.com/a/7968483)
      exp: (Date.now() + 6 * 60 * 1000) * 10000 + 621355968000000000,
      // Release service uses hex format, not base64url :roll_eyes:
      x5t: getThumbprint(this.requestSigningCertificates[0], 'sha1').toString('hex'),
    };

    // The Release service expects x5c as a '.' separated string, not the standard array format
    (header as Record<string, unknown>)['x5c'] = this.requestSigningCertificates
      .map(c => pemToDer(c).toString('base64url'))
      .join('.');

    return jws.sign({
      header,
      payload: message,
      privateKey: this.requestSigningKey,
    });
  }
}

async function withLease<T>(client: BlockBlobClient, fn: () => Promise<T>) {
  const lease = client.getBlobLeaseClient();

  for (let i = 0; i < 360; i++) {
    // Try to get lease for 30 minutes
    try {
      await client.uploadData(new ArrayBuffer()); // blob needs to exist for lease to be acquired
      await lease.acquireLease(60);

      try {
        const abortController = new AbortController();
        const refresher = new Promise<void>((c, e) => {
          abortController.signal.onabort = () => {
            clearInterval(interval);
            c();
          };

          const interval = setInterval(() => {
            lease.renewLease().catch(err => {
              clearInterval(interval);
              e(new Error('Failed to renew lease ' + err));
            });
          }, 30_000);
        });

        const result = await Promise.race([fn(), refresher]);
        abortController.abort();
        return result;
      } finally {
        await lease.releaseLease();
      }
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if ((err as any).statusCode !== 409 && (err as any).statusCode !== 412) {
        throw err;
      }

      await new Promise(c => setTimeout(c, 5000));
    }
  }

  throw new Error('Failed to acquire lease on blob after 30 minutes');
}

async function processArtifact(art: Artifact, filePath: string) {
  const log = (...args: unknown[]) => console.log(`[${art.name}]`, ...args);
  const match = /^vscode_(?<product>[^_]+)_(?<os>[^_]+)(?:_legacy)?_(?<arch>[^_]+)_(?<unprocessedType>[^_]+)$/.exec(
    art.name
  );

  if (!match) {
    throw new Error(`Invalid artifact name: ${art.name}`);
  }

  const quality = env.VSCODE_QUALITY;
  const version = env.BUILD_SOURCEVERSION;
  const friendlyFileName = `${quality}/${version}/${path.basename(filePath)}`;

  const blobServiceClient = new BlobServiceClient(
    `https://${env.VSCODE_STAGING_BLOB_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/`,
    // eslint-disable-next-line
    { getToken: async () => JSON.parse(env.PUBLISH_AUTH_TOKENS).blobServiceAccessToken }
  );
  const leasesContainerClient = blobServiceClient.getContainerClient('leases');
  await leasesContainerClient.createIfNotExists();
  const leaseBlobClient = leasesContainerClient.getBlockBlobClient(friendlyFileName);

  log(`Acquiring lease for: ${friendlyFileName}`);

  await withLease(leaseBlobClient, async () => {
    log(`Successfully acquired lease for: ${friendlyFileName}`);

    const url = `${env.PRSS_CDN_URL}/${friendlyFileName}`;
    const res = await retry(() => fetch(url));

    if (res.status === 200) {
      log(`Already released and provisioned: ${url}`);
    } else {
      const stagingContainerClient = blobServiceClient.getContainerClient('staging');
      await stagingContainerClient.createIfNotExists();

      const now = new Date().valueOf();
      const oneHour = 60 * 60 * 1000;
      const oneHourAgo = new Date(now - oneHour);
      const oneHourFromNow = new Date(now + oneHour);
      const userDelegationKey = await blobServiceClient.getUserDelegationKey(oneHourAgo, oneHourFromNow);
      const sasOptions = {
        containerName: 'staging',
        permissions: ContainerSASPermissions.from({ read: true }),
        startsOn: oneHourAgo,
        expiresOn: oneHourFromNow,
      };
      const stagingSasToken = generateBlobSASQueryParameters(
        sasOptions,
        userDelegationKey,
        env.VSCODE_STAGING_BLOB_STORAGE_ACCOUNT_NAME
      ).toString();

      const releaseService = await ESRPReleaseService.create({
        log,
        tenantId: env.RELEASE_TENANT_ID,
        clientId: env.RELEASE_CLIENT_ID,
        authCertificatePfx: env.RELEASE_AUTH_CERT,
        requestSigningCertificatePfx: env.RELEASE_REQUEST_SIGNING_CERT,
        containerClient: stagingContainerClient,
        stagingSasToken,
      });

      await releaseService.createRelease(version, filePath, friendlyFileName);
    }
  });

  log(`Successfully released lease for: ${friendlyFileName}`);
}

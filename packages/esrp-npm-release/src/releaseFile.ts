// Orchestrates the release of a single layer's zip file through the ESRP Release API.
// Handles blob storage staging, lease-based concurrency control, SAS token generation,
// and delegates the actual ESRP API calls to ESRPReleaseService.
//
// Based on the worker part of https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/common/publish.ts
// called by https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/product-publish.yml#L106
import {
  BlobServiceClient,
  ContainerSASPermissions,
  generateBlobSASQueryParameters,
  type BlockBlobClient,
} from '@azure/storage-blob';
import { clearInterval, setInterval } from 'node:timers';
import path from 'path';
import { ESRPReleaseService } from './ESRPReleaseService.ts';
import type { ReleaseFileParams } from './types.ts';

const leasesContainerName = 'leases';
const stagingContainerName = 'staging';

/**
 * Release a single file (zip of .tgz packages for one layer) via ESRP.
 *
 * Steps:
 * 1. Create a "leases" container and acquire a blob lease to prevent concurrent releases
 *    of the same file (important when multiple pipeline jobs could overlap)
 * 2. Generate a short-lived SAS token for the "staging" container so ESRP can read the blob
 * 3. Authenticate with ESRP using the auth certificate and create an ESRPReleaseService
 * 4. Upload the file, submit the release request, and poll until completion
 * 5. Release the lease when done
 */
export async function releaseFile(params: ReleaseFileParams): Promise<void> {
  const { log, filePath, stagingStorageAccountName, version } = params;

  const friendlyFileName = `${version}/${path.basename(filePath)}`;

  const blobServiceClient = new BlobServiceClient(`https://${stagingStorageAccountName}.blob.core.windows.net/`, {
    getToken: () => Promise.resolve(params.stagingAuthToken),
  });
  const leasesContainerClient = blobServiceClient.getContainerClient(leasesContainerName);
  await leasesContainerClient.createIfNotExists();
  const leaseBlobClient = leasesContainerClient.getBlockBlobClient(friendlyFileName);

  log(`Acquiring lease for: ${friendlyFileName}`);

  await withLease(leaseBlobClient, async () => {
    log(`Successfully acquired lease for: ${friendlyFileName}`);

    const stagingContainerClient = blobServiceClient.getContainerClient(stagingContainerName);
    await stagingContainerClient.createIfNotExists();

    const now = new Date().valueOf();
    const oneHour = 60 * 60 * 1000;
    const oneHourAgo = new Date(now - oneHour);
    const oneHourFromNow = new Date(now + oneHour);
    const userDelegationKey = await blobServiceClient.getUserDelegationKey(oneHourAgo, oneHourFromNow);
    const stagingSasToken = generateBlobSASQueryParameters(
      {
        containerName: stagingContainerName,
        permissions: ContainerSASPermissions.from({ read: true }),
        startsOn: oneHourAgo,
        expiresOn: oneHourFromNow,
      },
      userDelegationKey,
      stagingStorageAccountName
    ).toString();

    const releaseService = await ESRPReleaseService.create({
      releaseRequestParams: params.releaseRequestParams,
      log,
      tenantId: params.tenantId,
      clientId: params.clientId,
      authCertificatePfx: params.authCertificatePfx,
      requestSigningCertificatePfx: params.requestSigningCertificatePfx,
      stagingContainerClient: stagingContainerClient,
      stagingSasToken,
    });

    // This will either succeed or throw
    await releaseService.createRelease({ version, filePath: filePath, friendlyFileName });
  });
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
        const refresher = new Promise<void>((resolve, reject) => {
          abortController.signal.onabort = () => {
            clearInterval(interval);
            resolve();
          };

          const interval = setInterval(() => {
            lease.renewLease().catch(err => {
              clearInterval(interval);
              reject(new Error('Failed to renew lease ' + err));
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
      const maybeStatus = (err as { statusCode?: number }).statusCode;
      if (maybeStatus !== 409 && maybeStatus !== 412) {
        throw err;
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  throw new Error('Failed to acquire lease on blob after 30 minutes');
}

// based on the worker part of https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/common/publish.ts
// called by https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/product-publish.yml#L106
import {
  BlobServiceClient,
  ContainerSASPermissions,
  generateBlobSASQueryParameters,
  type BlockBlobClient,
} from '@azure/storage-blob';
import { clearInterval, setInterval } from 'node:timers';
import { workerData } from 'node:worker_threads';
import path from 'path';
import { ESRPReleaseService } from './ESRPReleaseService.ts';
import type { ESRPReleaseWorkerData } from './types.ts';
import { createLog } from './utils/createLog.ts';

await processArtifact(workerData as ESRPReleaseWorkerData);

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

async function processArtifact(params: ESRPReleaseWorkerData) {
  const { artifactName, artifactFilePath, storageAccountName, version } = params;

  const log = createLog(artifactName);

  const friendlyFileName = `${params.friendlyFileNamePrefix ?? version}/${path.basename(artifactFilePath)}`;

  const blobServiceClient = new BlobServiceClient(`https://${storageAccountName}.blob.core.windows.net/`, {
    getToken: () => Promise.resolve(params.publishAuthToken),
  });
  const leasesContainerClient = blobServiceClient.getContainerClient('leases');
  await leasesContainerClient.createIfNotExists();
  const leaseBlobClient = leasesContainerClient.getBlockBlobClient(friendlyFileName);

  log(`Acquiring lease for: ${friendlyFileName}`);

  await withLease(leaseBlobClient, async () => {
    log(`Successfully acquired lease for: ${friendlyFileName}`);

    const stagingContainerClient = blobServiceClient.getContainerClient(params.containerName);
    await stagingContainerClient.createIfNotExists();

    const now = new Date().valueOf();
    const oneHour = 60 * 60 * 1000;
    const oneHourAgo = new Date(now - oneHour);
    const oneHourFromNow = new Date(now + oneHour);
    const userDelegationKey = await blobServiceClient.getUserDelegationKey(oneHourAgo, oneHourFromNow);
    const stagingSasToken = generateBlobSASQueryParameters(
      {
        containerName: params.containerName,
        permissions: ContainerSASPermissions.from({ read: true }),
        startsOn: oneHourAgo,
        expiresOn: oneHourFromNow,
      },
      userDelegationKey,
      storageAccountName
    ).toString();

    const releaseService = await ESRPReleaseService.create({
      baseReleaseRequest: params.baseReleaseRequest,
      releaseType: params.releaseType,
      log,
      tenantId: params.tenantId,
      clientId: params.clientId,
      authCertificatePfx: params.authCertificatePfx,
      requestSigningCertificatePfx: params.requestSigningCertificatePfx,
      containerClient: stagingContainerClient,
      stagingSasToken,
    });

    await releaseService.createRelease({ version, filePath: artifactFilePath, friendlyFileName });
  });

  log(`Successfully released lease for: ${friendlyFileName}`);
}

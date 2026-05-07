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
import { createStaticLinkReleaseRequest } from './releaseRequests/staticLinkRelease.ts';
import type { WorkerData } from './types.ts';
import { createLog } from './utils/createLog.ts';

const vscodeEmail = 'example@microsoft.com';
const vscodeRequestBase = () =>
  createStaticLinkReleaseRequest({
    driEmail: [vscodeEmail],
    createdBy: vscodeEmail,
    owners: [vscodeEmail],
    approvers: [vscodeEmail],
    releaseTitle: 'VS Code',
    releaseContentType: 'InstallPackage',
    productInfo: { name: 'VS Code', description: 'VS Code' },
    accessPermissionsInfo: {
      mainPublisher: 'VSCode',
      allDownloadEntities: ['VSCode'],
    },
    files: [],
  });

await processArtifact(workerData as WorkerData);

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

async function processArtifact(
  // Pick<
  //   CreateESRPReleaseServiceParams,
  //   'tenantId' | 'clientId' | 'authCertificatePfx' | 'requestSigningCertificatePfx'
  // > &
  params: WorkerData
) {
  const { artifactName, artifactFilePath, storageAccountName, version } = params;

  const log = createLog(artifactName);

  // const match =
  //   /^vscode_(?<product>[^_]+)_(?<os>[^_]+)(?:_legacy)?_(?<arch>[^_]+)_(?<unprocessedType>[^_]+)$/.exec(
  //     artifact.name,
  //   );
  // if (!match) {
  //   throw new Error(`Invalid artifact name: ${artifact.name}`);
  // }

  // vscode which has multiple build "quality" variants (e.g. "insiders") prepends that
  const friendlyFileName = `${version}/${path.basename(artifactFilePath)}`;

  const blobServiceClient = new BlobServiceClient(`https://${storageAccountName}.blob.core.windows.net/`, {
    getToken: () => Promise.resolve(params.publishAuthToken),
  });
  const leasesContainerClient = blobServiceClient.getContainerClient('leases');
  await leasesContainerClient.createIfNotExists();
  const leaseBlobClient = leasesContainerClient.getBlockBlobClient(friendlyFileName);

  log(`Acquiring lease for: ${friendlyFileName}`);

  await withLease(leaseBlobClient, async () => {
    log(`Successfully acquired lease for: ${friendlyFileName}`);

    const stagingContainerClient = blobServiceClient.getContainerClient('staging');
    await stagingContainerClient.createIfNotExists();

    const now = new Date().valueOf();
    const oneHour = 60 * 60 * 1000;
    const oneHourAgo = new Date(now - oneHour);
    const oneHourFromNow = new Date(now + oneHour);
    const userDelegationKey = await blobServiceClient.getUserDelegationKey(oneHourAgo, oneHourFromNow);
    const stagingSasToken = generateBlobSASQueryParameters(
      {
        containerName: 'staging',
        permissions: ContainerSASPermissions.from({ read: true }),
        startsOn: oneHourAgo,
        expiresOn: oneHourFromNow,
      },
      userDelegationKey,
      storageAccountName
    ).toString();

    const releaseService = await ESRPReleaseService.create({
      getBaseReleaseRequest: vscodeRequestBase,
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

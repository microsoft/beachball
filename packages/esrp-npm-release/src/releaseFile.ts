// Orchestrates the release of a single layer's zip file through the ESRP Release API.
// Handles blob staging, SAS token generation, and delegates the actual ESRP API calls to ESRPReleaseService.
//
// Based on the worker part of https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/common/publish.ts
// called by https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/product-publish.yml#L106
//
// The original implementation has an additional step of acquiring a lease on the blob to prevent
// issues with multiple concurrent runs, but this is less likely to be important for anticipated
// scenarios with npm releases.
import { ContainerSASPermissions, generateBlobSASQueryParameters } from '@azure/storage-blob';
import path from 'path';
import { ESRPReleaseService } from './ESRPReleaseService.ts';
import type { ReleaseFileParams } from './types.ts';
import { ReleaseError } from './utils/ReleaseError.ts';

const stagingContainerName = 'staging';

/**
 * Release a single file (zip of .tgz packages for one layer) via ESRP.
 *
 * Steps:
 * 1. Generate a short-lived SAS token for the "staging" container so ESRP can read the blob
 * 2. Authenticate with ESRP using the auth certificate and create an ESRPReleaseService
 * 3. Upload the file, submit the release request, and poll until completion
 */
export async function releaseFile(params: ReleaseFileParams): Promise<void> {
  const { filePath, stagingBlobServiceClient } = params;

  const friendlyFileName = `${params.releaseRequestParams.productInfo.version}/${path.basename(filePath)}`;

  const stagingContainerClient = stagingBlobServiceClient.getContainerClient(stagingContainerName);
  await stagingContainerClient.createIfNotExists();

  let stagingSasToken: string;
  try {
    const now = new Date().valueOf();
    const oneHour = 60 * 60 * 1000;
    const oneHourAgo = new Date(now - oneHour);
    const oneHourFromNow = new Date(now + oneHour);
    const userDelegationKey = await stagingBlobServiceClient.getUserDelegationKey(oneHourAgo, oneHourFromNow);
    stagingSasToken = generateBlobSASQueryParameters(
      {
        containerName: stagingContainerName,
        permissions: ContainerSASPermissions.from({ read: true }),
        startsOn: oneHourAgo,
        expiresOn: oneHourFromNow,
      },
      userDelegationKey,
      stagingBlobServiceClient.accountName
    ).toString();
  } catch (err) {
    throw new ReleaseError(`Error generating SAS token for staging blob access`, { cause: err });
  }

  const releaseService = await ESRPReleaseService.create({ ...params, stagingContainerClient, stagingSasToken });

  // This will either succeed or throw
  await releaseService.createRelease({ filePath, friendlyFileName });
}

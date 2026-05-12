// Entry point for the ESRP npm release tool.
// Reads packed packages (produced by `beachball publish --pack-to-path <path>`),
// zips each layer, and publishes them to npmjs.com via the ESRP Release API in dependency order.
//
// Based on the non-worker part of https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/common/publish.ts
// called by https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/product-publish.yml#L106

import { BlobServiceClient } from '@azure/storage-blob';
import fs from 'fs';
import path from 'path';
import yazl from 'yazl';
import { ESRPReleaseService } from './ESRPReleaseService.ts';
import { ReleaseState } from './ReleaseState.ts';
import { getAadToken } from './utils/getAadToken.ts';
import { ReleaseError } from './utils/ReleaseError.ts';
import { Logger } from './utils/Logger.ts';

const logger = new Logger();

function getEnvOptions() {
  const missingEnv: string[] = [];

  function getEnv(name: string, defaultValue?: string): string {
    const result = process.env[name];
    if (typeof result === 'string') return result;
    if (defaultValue !== undefined) return defaultValue;
    // collect all errors and throw at the end
    missingEnv.push(name);
    return '';
  }

  // ESRP_USER serves as a fallback default for the contact email fields below
  const defaultUser = getEnv('ESRP_USER', '') || undefined;

  const env = {
    /** Path to the directory of packed .tgz files organized into numbered layer subdirectories */
    packedPackagesPath: getEnv('PACKED_PACKAGES_PATH'),
    esrp: {
      // Release metadata
      productName: getEnv('ESRP_PRODUCT_NAME'),
      // default to '' so it doesn't throw, but skip if unspecified so ESRP will read publishConfig
      npmTag: getEnv('ESRP_NPM_TAG', '') || undefined,
      createdBy: getEnv('ESRP_CREATED_BY', defaultUser),
      driEmail: [getEnv('ESRP_DRI_EMAIL', defaultUser)],
      owners: getEnv('ESRP_OWNERS', defaultUser).split(','),
      approvers: getEnv('ESRP_APPROVERS', defaultUser).split(','),

      /** Production tenant ID used for your ESRP app registration */
      tenantId: getEnv('ESRP_TENANT_ID'),
      /** Client ID used for your ESRP app registration in a production tenant */
      clientId: getEnv('ESRP_CLIENT_ID'),

      /** Base64-encoded PFX certificate used for authenticating to ESRP AAD */
      authCertificatePfx: getEnv('ESRP_AUTH_CERT'),
      /** Base64-encoded PFX certificate used for signing JWS tokens in release requests */
      requestSigningCertificatePfx: getEnv('ESRP_REQUEST_SIGNING_CERT'),
    },
    /** info for temporarily uploading packages to a storage account in your team's subscription */
    staging: {
      storageAccountName: getEnv('STAGING_STORAGE_ACCOUNT_NAME'),

      // Secrets: credentials for storage account access
      clientId: getEnv('STAGING_CLIENT_ID'),
      idToken: getEnv('STAGING_ID_TOKEN'),
      tenantId: getEnv('STAGING_TENANT_ID'),
    },
    /** Predefined ADO pipeline variables (set automatically by the agent) */
    // https://learn.microsoft.com/en-us/azure/devops/pipelines/build/variables?view=azure-devops&tabs=yaml
    ado: {
      agentTempDirectory: getEnv('AGENT_TEMPDIRECTORY'),
      /** git commit of the source */
      buildSourceVersion: getEnv('BUILD_SOURCEVERSION'),
      /** Repository name (for GitHub-connected repos this is "org/repo"; bare name for ADO Repos) */
      buildRepositoryName: getEnv('BUILD_REPOSITORY_NAME'),
    },
  };

  if (missingEnv.length) {
    throw new ReleaseError(`Missing required environment variables: ${missingEnv.join(', ')}`);
  }
  return env;
}

async function main() {
  const env = getEnvOptions();

  let stagingBlobServiceClient: BlobServiceClient;
  try {
    const storageUrl = `https://${env.staging.storageAccountName}.blob.core.windows.net/`;
    logger.log(`Initializing BlobServiceClient for staging storage account at ${storageUrl}`);
    stagingBlobServiceClient = new BlobServiceClient(storageUrl, {
      // In the vscode example, the pipeline acquires the staging token in a previous step and stores it in
      // PUBLISH_AUTH_TOKENS env, but that appears to only be necessary since multiple steps need the token
      getToken: () => {
        logger.log(`Acquiring AAD token for staging storage account "${env.staging.storageAccountName}"`);
        return getAadToken({
          endpoint: storageUrl,
          tenantId: env.staging.tenantId,
          clientId: env.staging.clientId,
          auth: { idToken: env.staging.idToken },
        }).catch((err: ReleaseError) => {
          // unclear how this will propagate, so go ahead and log and re-throw a generic message
          logger.error(
            `Error acquiring token for staging storage account "${env.staging.storageAccountName}":\n${err.getMessageWithCause()}`
          );
          throw new ReleaseError('Error acquiring token (see above)', { alreadyLogged: true });
        });
      },
    });
  } catch (err) {
    throw new ReleaseError(
      `Failed to initialize BlobServiceClient for staging storage account "${env.staging.storageAccountName}"`,
      { cause: err }
    );
  }

  // Strip any "org/" prefix so only the repo name is used in the staging blob paths.
  const repoName = env.ado.buildRepositoryName.split('/').slice(-1)[0];

  logger.log(`Loading release state for repo "${repoName}" at source version ${env.ado.buildSourceVersion}`);
  const state = await ReleaseState.create({
    blobServiceClient: stagingBlobServiceClient,
    repoName,
    sourceVersion: env.ado.buildSourceVersion,
  });
  logger.log(`Release state loaded: ${state.publishedCount} layer(s) already published`);

  // Construct the release service once. It re-acquires AAD/SAS tokens per release internally
  // since releasing each layer can take a long time (potentially exceeding token lifetimes).
  logger.log('Initializing ESRP release service');
  const releaseService = await ESRPReleaseService.create({
    logger,
    clientId: env.esrp.clientId,
    tenantId: env.esrp.tenantId,
    authCertificatePfx: env.esrp.authCertificatePfx,
    requestSigningCertificatePfx: env.esrp.requestSigningCertificatePfx,
    stagingBlobServiceClient,
  });

  const zipsDir = path.join(env.ado.agentTempDirectory, 'npm-zips');
  logger.log(`Creating temp directory for zipped packages at ${zipsDir}`);
  fs.mkdirSync(zipsDir, { recursive: true });

  logger.log(`Reading packed packages from ${env.packedPackagesPath}`);
  const layers = fs
    .readdirSync(env.packedPackagesPath)
    .sort()
    .filter(name => fs.statSync(path.join(env.packedPackagesPath, name)).isDirectory());
  logger.log(`Found ${layers.length} layer(s) to release`);

  for (const layerNum of layers) {
    if (state.hasPublished(layerNum)) {
      logger.log(`✅ layer ${layerNum} (already published)`);
      continue;
    }

    const layerPrefix = 'layer-' + layerNum;
    logger.startGroup(layerPrefix, `Starting release for layer ${layerNum} of ${layers.length}`);

    const layerDir = path.join(env.packedPackagesPath, layerNum);
    const zipPath = path.join(zipsDir, `${layerPrefix}-${Date.now()}.zip`);

    logger.log(`Zipping layer contents to ${zipPath}`);
    const zipfile = new yazl.ZipFile();
    await new Promise<void>((resolve, reject) => {
      zipfile.outputStream.on('error', reject);
      zipfile.outputStream.pipe(fs.createWriteStream(zipPath)).on('close', resolve).on('error', reject);

      for (const file of fs.readdirSync(layerDir)) {
        if (file.endsWith('.tgz')) {
          logger.log(`- ${file}`);
          zipfile.addFile(path.join(layerDir, file), file);
        }
      }
      zipfile.end();
    }).catch(err => {
      throw new ReleaseError(`Error creating zip file for layer ${layerNum}`, { cause: err });
    });

    logger.log(`Submitting release for layer ${layerNum} via ESRP`);
    await releaseService.createRelease({
      filePath: zipPath,
      stagingBlobPathPrefix: repoName,
      releaseRequestParams: {
        createdBy: env.esrp.createdBy,
        driEmail: env.esrp.driEmail,
        owners: env.esrp.owners,
        approvers: env.esrp.approvers,
        productInfo: {
          name: env.esrp.productName,
          // This is an arbitrary string, not used as the published version
          version: `${env.ado.buildSourceVersion}-${layerNum}`,
          description: `${env.esrp.productName} packages - ${layerNum}`,
        },
        releaseTitle: env.esrp.productName,
        npmTag: env.esrp.npmTag,
      },
    });
    logger.log(`Release for layer ${layerNum} completed successfully`);

    logger.log(`Marking layer ${layerNum} as published in release state`);
    await state.markPublished(layerNum);

    logger.endGroup();
    logger.log(`✅ layer ${layerNum}`);
  }

  logger.log(`All ${state.publishedCount} artifacts published!`);
}

await main().catch(err => {
  if (err instanceof ReleaseError && err.alreadyLogged) {
    // Error details were already printed -- just exit
  } else if (err instanceof ReleaseError) {
    // Expected error, not yet logged -- print the message and cause message (no stack trace)
    logger.error(err.getMessageWithCause());
  } else {
    // Unexpected error -- print full details including stack
    logger.error('Unexpected error while running release!');
    logger.error((err as Error)?.stack || err);
  }
  // eslint-disable-next-line no-restricted-properties
  process.exit(1);
});

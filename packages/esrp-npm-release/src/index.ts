// Entry point for the ESRP npm release tool.
// Reads packed packages (produced by `beachball publish --pack-to-path --pack-style layer`),
// zips each layer, and publishes them to npmjs.com via the ESRP Release API in dependency order.
//
// Based on the non-worker part of https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/common/publish.ts
// called by https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/product-publish.yml#L106

import { BlobServiceClient } from '@azure/storage-blob';
import fs from 'fs';
import path from 'path';
import yazl from 'yazl';
import { releaseFile } from './releaseFile.ts';
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
    missingEnv.push(name);
    return ''; // return '' for now and throw later
  }

  // ESRP_USER serves as a fallback default for the contact email fields below
  const defaultUser = getEnv('ESRP_USER', '') || undefined;

  const env = {
    // Path to the directory of packed .tgz files organized into numbered layer subdirectories
    packedPackagesPath: getEnv('PACKED_PACKAGES_PATH'),
    esrp: {
      // Release metadata
      productName: getEnv('ESRP_PRODUCT_NAME'),
      npmTag: getEnv('ESRP_NPM_TAG', '') || undefined,
      createdBy: getEnv('ESRP_CREATED_BY', defaultUser),
      driEmail: [getEnv('ESRP_DRI_EMAIL', defaultUser)],
      owners: getEnv('ESRP_OWNERS', defaultUser).split(','),
      approvers: getEnv('ESRP_APPROVERS', defaultUser).split(','),

      /** Production tenant ID used for your ESRP app registration */
      tenantId: getEnv('ESRP_TENANT_ID'),
      /** Client ID used for your ESRP app registration in a production tenant */
      clientId: getEnv('ESRP_CLIENT_ID'),

      // Certificate secrets (base64-encoded PFX): auth cert authenticates to ESRP AAD,
      // request signing cert signs the JWS token included in each release request
      authCertificatePfx: getEnv('ESRP_AUTH_CERT'),
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
    stagingBlobServiceClient = new BlobServiceClient(storageUrl, {
      // In the vscode example, the pipeline acquires the staging token in a previous step and stores it in
      // PUBLISH_AUTH_TOKENS env, but that appears to only be necessary since multiple steps need the token
      getToken: () =>
        getAadToken({
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
        }),
    });
  } catch (err) {
    throw new ReleaseError(
      `Failed to initialize BlobServiceClient for staging storage account "${env.staging.storageAccountName}"`,
      { cause: err }
    );
  }

  const state = await ReleaseState.create(stagingBlobServiceClient, env.ado.buildSourceVersion);

  const zipsDir = path.join(env.ado.agentTempDirectory, 'npm-zips');
  fs.mkdirSync(zipsDir, { recursive: true });

  const layers = fs.readdirSync(env.packedPackagesPath).sort();

  for (const layerNum of layers) {
    if (state.hasPublished(layerNum)) {
      logger.log(`✅ layer ${layerNum} (already published)`);
      continue;
    }

    const layerPrefix = 'layer-' + layerNum;
    logger.startGroup(layerPrefix, `Starting release for layer ${layerNum} of ${layers.length}`);

    // This is an arbitrary string, not used as the published version
    const layerVersion = `${env.ado.buildSourceVersion}-${layerNum}`;

    const layerDir = path.join(env.packedPackagesPath, layerNum);

    logger.log('Zipping layer contents');
    const zipPath = path.join(zipsDir, `${layerPrefix}-${Date.now()}.zip`);

    const zipfile = new yazl.ZipFile();
    await new Promise<void>((resolve, reject) => {
      zipfile.outputStream.on('error', reject);
      zipfile.outputStream.pipe(fs.createWriteStream(zipPath)).on('close', resolve).on('error', reject);
      for (const file of fs.readdirSync(layerDir)) {
        if (file.endsWith('.tgz')) {
          zipfile.addFile(path.join(layerDir, file), file);
        }
      }
      zipfile.end();
    }).catch(err => {
      throw new ReleaseError(`Error creating zip file for layer ${layerNum}`, { cause: err });
    });
    logger.log('done');

    await releaseFile({
      logger,
      filePath: zipPath,
      stagingBlobServiceClient,
      authCertificatePfx: env.esrp.authCertificatePfx,
      requestSigningCertificatePfx: env.esrp.requestSigningCertificatePfx,
      clientId: env.esrp.clientId,
      tenantId: env.esrp.tenantId,
      releaseRequestParams: {
        createdBy: env.esrp.createdBy,
        driEmail: env.esrp.driEmail,
        owners: env.esrp.owners,
        approvers: env.esrp.approvers,
        productInfo: {
          name: env.esrp.productName,
          version: layerVersion,
          description: `${env.esrp.productName} packages - ${layerNum}`,
        },
        releaseTitle: env.esrp.productName,
        npmTag: env.esrp.npmTag,
      },
    });

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

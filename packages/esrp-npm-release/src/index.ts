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

/**
 * Get an environment variable and throw if it's missing. Built-ins reference:
 * https://learn.microsoft.com/en-us/azure/devops/pipelines/build/variables?view=azure-devops&tabs=yaml
 */
function getEnv(name: string, defaultValue?: string): string {
  const result = process.env[name];
  if (typeof result === 'string') return result;
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Missing env: ${name}`);
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
  ado: {
    agentTempDirectory: getEnv('AGENT_TEMPDIRECTORY'),
    /** git commit of the source */
    buildSourceVersion: getEnv('BUILD_SOURCEVERSION'),
  },
};

async function main() {
  // In the vscode example, the pipeline acquires this token in a previous step and stores it in
  // PUBLISH_AUTH_TOKENS env, but that appears to only be necessary since multiple steps need the token
  // or there may be retries.
  const stagingAuthToken = await getAadToken({
    endpoint: `https://${env.staging.storageAccountName}.blob.core.windows.net/`,
    tenantId: env.staging.tenantId,
    clientId: env.staging.clientId,
    auth: { idToken: env.staging.idToken },
  });

  const stagingBlobServiceClient = new BlobServiceClient(
    `https://${env.staging.storageAccountName}.blob.core.windows.net/`,
    { getToken: () => Promise.resolve(stagingAuthToken) }
  );

  const state = await ReleaseState.create(stagingBlobServiceClient, env.ado.buildSourceVersion);

  // NOTE: Any errors for a layer are allowed to propagate, since a failure blocks later layers

  const zipsDir = path.join(env.ado.agentTempDirectory, 'npm-zips');
  fs.mkdirSync(zipsDir, { recursive: true });

  const layers = fs.readdirSync(env.packedPackagesPath).sort();

  for (const layerNum of layers) {
    if (state.hasPublished(layerNum)) {
      console.log(`✅ layer ${layerNum} (already published)`);
      continue;
    }

    // This is an arbitrary string, not used as the published version
    const layerVersion = `${env.ado.buildSourceVersion}-${layerNum}`;

    console.log(`\n==== Starting layer ${layerNum.replace(/^0+/, '')} of ${layers.length} ====\n`);
    const layerPrefix = 'layer-' + layerNum;
    const layerLog = (...args: unknown[]) => console.log(`[${layerPrefix}]`, ...args);
    const layerDir = path.join(env.packedPackagesPath, layerNum);

    layerLog('Zipping layer contents');
    const zipPath = path.join(zipsDir, `${layerPrefix}-${Date.now()}.zip`);

    const zipfile = new yazl.ZipFile();
    zipfile.outputStream.pipe(fs.createWriteStream(zipPath)).on('close', function () {
      layerLog('done');
    });
    for (const file of fs.readdirSync(layerDir)) {
      if (file.endsWith('.tgz')) {
        zipfile.addFile(path.join(layerDir, file), file);
      }
    }
    zipfile.end();

    await releaseFile({
      log: layerLog,
      filePath: zipPath,
      stagingBlobServiceClient,
      authCertificatePfx: env.esrp.authCertificatePfx,
      requestSigningCertificatePfx: env.esrp.requestSigningCertificatePfx,
      clientId: env.esrp.clientId,
      tenantId: env.esrp.tenantId,
      version: layerVersion,
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
    console.log(`✅ layer ${layerNum}`);
  }

  console.log(`All ${state.publishedCount} artifacts published!`);
}

await main().catch(err => {
  console.error((err as Error).stack || err);
  // eslint-disable-next-line no-restricted-properties
  process.exit(1);
});

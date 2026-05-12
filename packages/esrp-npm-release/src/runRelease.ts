import { BlobServiceClient } from '@azure/storage-blob';
import fs from 'fs';
import path from 'path';
import yazl from 'yazl';
import { ESRPReleaseService } from './ESRPReleaseService.ts';
import type { EnvOptions } from './getEnvOptions.ts';
import { ReleaseState } from './ReleaseState.ts';
import { getAadToken } from './utils/getAadToken.ts';
import type { Logger } from './utils/Logger.ts';
import { pierce } from './utils/pierce.ts';
import { ReleaseError } from './utils/ReleaseError.ts';

/**
 * Layout of `versions.json` written by beachball's `publishToRegistry` when packing:
 * one record per layer, each mapping package name to published version.
 *
 * Must stay in sync with `LayerVersionsJson` in
 * `packages/beachball/src/publish/publishToRegistry.ts`.
 */
type LayerVersionsJson = Record<string, string>[];

export interface RunReleaseOptions {
  env: EnvOptions;
  logger: Logger;
}

/**
 * Run the full release workflow: load state, ensure ESRP is reachable, zip and release each
 * unpublished layer in order.
 *
 * This is the unit-testable seam: tests pass an `env` literal and a `MockLogger`, and
 * mock the modules this function imports (Azure clients, ReleaseState, ESRPReleaseService,
 * AAD token, fs, yazl) via `jest.unstable_mockModule`.
 */
export async function runRelease({ env, logger }: RunReleaseOptions): Promise<void> {
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
          logger,
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
  const repoName = env.ado.buildRepositoryName.replace(/^.*?\//, '');

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
    // Skip non-numeric entries (such as SBOM "_manifest") and non-directories
    .filter(name => /^\d+$/.test(name) && fs.statSync(path.join(env.packedPackagesPath, name)).isDirectory());

  if (!layers.length) {
    throw new ReleaseError(`No layer directories found under ${env.packedPackagesPath}`);
  }

  logger.log(`Found ${layers.length} layer(s) to release`);

  // versions.json is written by beachball's publishToRegistry next to the layer dirs.
  // It records, per layer, the exact name@version of every packed package — used after each
  // ESRP publish to pierce those versions into the ADO Artifacts feed.
  const versionsJsonPath = path.join(env.packedPackagesPath, 'versions.json');
  let layerVersions: LayerVersionsJson;
  try {
    layerVersions = JSON.parse(fs.readFileSync(versionsJsonPath, 'utf8')) as LayerVersionsJson;
  } catch (err) {
    throw new ReleaseError(`Failed to read ${versionsJsonPath}`, { cause: err });
  }
  if (layerVersions.length !== layers.length) {
    throw new ReleaseError(
      `versions.json has ${layerVersions.length} layer(s) but found ${layers.length} layer directory(ies) under ${env.packedPackagesPath}`
    );
  }

  for (const [layerIdx, layerNum] of layers.entries()) {
    if (state.hasPublished(layerNum)) {
      logger.log(`✅ layer ${layerNum} (already published)`);
      continue;
    }

    const layerPrefix = 'layer-' + layerNum;
    logger.startGroup(layerPrefix, `Starting release for layer ${layerNum} of ${layers.length}`);

    const layerDir = path.join(env.packedPackagesPath, layerNum);
    const tgzFiles = fs
      .readdirSync(layerDir)
      .filter(file => file.endsWith('.tgz'))
      .map(file => path.join(layerDir, file));
    if (!tgzFiles.length) {
      throw new ReleaseError(`No .tgz files found in layer directory ${layerDir}`);
    }

    const zipPath = path.join(zipsDir, `${layerPrefix}-${Date.now()}.zip`);
    logger.log(`Zipping layer contents to ${zipPath}`);
    const zipfile = new yazl.ZipFile();
    await new Promise<void>((resolve, reject) => {
      zipfile.outputStream.on('error', reject);
      zipfile.outputStream.pipe(fs.createWriteStream(zipPath)).on('close', resolve).on('error', reject);

      for (const file of tgzFiles) {
        logger.log(`- ${path.basename(file)}`);
        zipfile.addFile(file, path.basename(file));
      }
      zipfile.end();
    }).catch(err => {
      throw new ReleaseError(`Error creating zip file for layer ${layerNum}`, { cause: err });
    });

    logger.log(`Submitting release for layer ${layerNum} via ESRP`);
    // From testing, this succeeds even if the versions already exist in the registry,
    // with no way to distinguish...
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
    logger.log('📦 Packages were successfully published to npm');

    // After ESRP has published the tarballs to npmjs.com, force the ADO Artifacts feed to ingest
    // those versions from upstream. This is mainly to ensure future beachball publish/pack runs'
    // version existence checks are accurate, since in production builds they must run against
    // the private feed.
    logger.log('Piercing packages into ADO feed');
    await pierce({
      packages: layerVersions[layerIdx],
      accessToken: env.ado.systemAccessToken,
      collectionUri: env.ado.systemCollectionUri,
      feedId: env.packagingFeedId,
      logger,
    });

    // This is done AFTER piercing to prevent silently trying to re-publish the same versions
    // if there's a failure in any later step (since ESRP won't error on re-publishes)
    logger.log(`Marking layer as published in release state`);
    await state.markPublished(layerNum);

    logger.endGroup();
    logger.log(`✅ layer ${layerNum}`);
  }

  logger.log(`All ${state.publishedCount} artifacts published!`);
}

// Entry point for the ESRP npm release tool.
// Reads packed packages (produced by `beachball publish --pack-to-path --pack-style layer`),
// zips each layer, and publishes them to npmjs.com via the ESRP Release API in dependency order.
//
// Based on the non-worker part of https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/common/publish.ts
// called by https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/product-publish.yml#L106

import fs from 'fs';
import path from 'path';
import yazl from 'yazl';
import { getAadToken } from './utils/getAadToken.ts';
import { releaseFile } from './releaseFile.ts';

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
    agentBuildDirectory: getEnv('AGENT_BUILDDIRECTORY'),
    agentTempDirectory: getEnv('AGENT_TEMPDIRECTORY'),
    /** git commit of the source */
    buildSourceVersion: getEnv('BUILD_SOURCEVERSION'),
    stageAttempt: getEnv('SYSTEM_STAGEATTEMPT'),
  },
};

/**
 * Tracks which layers have been successfully published across stage retry attempts.
 *
 * On construction, loads state from the most recent previous attempt (if any) by scanning
 * `AGENT_BUILDDIRECTORY` for `artifacts_processed_<N>` directories. Each successful layer
 * is appended to a text file that gets published as a pipeline artifact (via the
 * `artifacts_processed_$(System.StageAttempt)` output in the release pipeline YAML).
 *
 * This allows the tool to resume from where it left off when ADO retries a failed stage,
 * skipping layers that were already published to npm.
 */
class State {
  private statePath: string;
  private set = new Set<string>();

  constructor() {
    // Look for state from previous stage attempts. The release pipeline publishes an
    // `artifacts_processed_<attempt>` pipeline artifact after each attempt (via a
    // PublishPipelineArtifact step), and downloads all current-run artifacts at the start
    // of each attempt (via DownloadPipelineArtifact with source: current).
    // We find the highest-numbered previous attempt and load its list of completed layers
    // so we can skip them.
    // (based on https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/product-publish.yml#L19C1-L25C30
    // but updated with an approach that works in release pipelines)
    const previousState = fs
      .readdirSync(env.ado.agentBuildDirectory)
      .map(name => /^artifacts_processed_(\d+)$/.exec(name))
      .filter((match): match is RegExpExecArray => !!match)
      .map(match => ({ name: match[0], attempt: Number(match[1]) }))
      .sort((a, b) => b.attempt - a.attempt)[0];

    if (previousState) {
      const previousStatePath = path.join(env.ado.agentBuildDirectory, previousState.name, previousState.name + '.txt');
      fs.readFileSync(previousStatePath, 'utf8')
        .split(/\n/)
        .filter(name => !!name)
        .forEach(name => this.set.add(name));
    }

    this.statePath = path.join(
      env.ado.agentBuildDirectory,
      `artifacts_processed_${env.ado.stageAttempt}`,
      `artifacts_processed_${env.ado.stageAttempt}.txt`
    );
    fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
    fs.writeFileSync(this.statePath, [...this.set.values()].map(name => `${name}\n`).join(''));
  }

  get size(): number {
    return this.set.size;
  }

  has(name: string): boolean {
    return this.set.has(name);
  }

  add(name: string): void {
    this.set.add(name);
    fs.appendFileSync(this.statePath, `${name}\n`);
  }

  [Symbol.iterator](): IterableIterator<string> {
    return this.set[Symbol.iterator]();
  }
}

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

  const done = new State();

  for (const name of done) {
    console.log(`✅ layer ${name}`);
  }

  // NOTE: Any errors for a layer are allowed to propagate, since a failure blocks later layers

  const zipsDir = path.join(env.ado.agentTempDirectory, 'npm-zips');
  fs.mkdirSync(zipsDir, { recursive: true });

  const layers = fs.readdirSync(env.packedPackagesPath).sort();

  for (const layerNum of layers) {
    // This is an arbitrary string, not used as the published version
    const layerVersion = `${env.ado.buildSourceVersion}-${layerNum}`;
    if (done.has(layerVersion)) {
      continue;
    }

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
      stagingAuthToken,
      authCertificatePfx: env.esrp.authCertificatePfx,
      requestSigningCertificatePfx: env.esrp.requestSigningCertificatePfx,
      stagingStorageAccountName: env.staging.storageAccountName,
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

    done.add(layerVersion);
    console.log(`✅ layer ${layerNum}`);
  }

  console.log(`All ${done.size} artifacts published!`);
}

await main().catch(err => {
  console.error((err as Error).stack || err);
  // eslint-disable-next-line no-restricted-properties
  process.exit(1);
});

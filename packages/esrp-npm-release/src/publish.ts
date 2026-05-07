// based on the non-worker part of https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/common/publish.ts
// called by https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/product-publish.yml#L106

import fs from 'fs';
import path from 'path';
import yazl from 'yazl';
import { getAadToken } from './utils/getAadToken.ts';
import type { CreateNpmReleaseRequestMessageParams } from './models/npmRelease.ts';
import { releaseFile } from './releaseFile.ts';

const packageLayersDir = '/path/to/downloaded-packs-dir';
const containerName = 'staging';

const releaseRequestParams: CreateNpmReleaseRequestMessageParams = {
  createdBy: 'me',
  driEmail: ['email'],
  owners: ['owner'],
  approvers: ['approver'],
  productInfo: {
    name: ' my-product',
    version: '1.3.0',
    description: 'Package Distribution through ESRP Release.',
  },
  releaseTitle: ' my-product',
};

/**
 * Get an environment variable and throw if it's missing. Built-ins reference:
 * https://learn.microsoft.com/en-us/azure/devops/pipelines/build/variables?view=azure-devops&tabs=yaml
 */
function getEnv(name: string): string {
  const result = process.env[name];
  if (typeof result === 'string') return result;
  throw new Error(`Missing env: ${name}`);
}

const env = {
  releaseTenantId: getEnv('RELEASE_TENANT_ID'),
  releaseClientId: getEnv('RELEASE_CLIENT_ID'),
  stagingStorageAccountName: getEnv('VSCODE_STAGING_BLOB_STORAGE_ACCOUNT_NAME'),
  authCertificatePfx: getEnv('RELEASE_AUTH_CERT'),
  requestSigningCertificatePfx: getEnv('RELEASE_REQUEST_SIGNING_CERT'),
  azureTenantId: getEnv('AZURE_TENANT_ID'),
  azureClientId: getEnv('AZURE_CLIENT_ID'),
  azureIdToken: getEnv('AZURE_ID_TOKEN'),

  // ADO
  buildSourceVersion: getEnv('BUILD_SOURCEVERSION'),
  // Pipeline.Workspace is the same as Agent.BuildDirectory
  pipelineWorkspacePath: getEnv('PIPELINE_WORKSPACE'),
  stageAttempt: getEnv('SYSTEM_STAGEATTEMPT'),
  agentTempDirectory: getEnv('AGENT_TEMPDIRECTORY'),
};

class State {
  private statePath: string;
  private set = new Set<string>();

  constructor() {
    // https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/product-publish.yml#L19C1-L25C30
    // - output: pipelineArtifact
    //   targetPath: $(Pipeline.Workspace)/artifacts_processed_$(System.StageAttempt)/artifacts_processed_$(System.StageAttempt).txt
    //   artifactName: artifacts_processed_$(System.StageAttempt)
    //   displayName: Publish the artifacts processed for this stage attempt
    //   sbomEnabled: false
    //   isProduction: false
    //   condition: always()
    const previousState = fs
      .readdirSync(env.pipelineWorkspacePath)
      .map(name => /^artifacts_processed_(\d+)$/.exec(name))
      .filter((match): match is RegExpExecArray => !!match)
      .map(match => ({ name: match[0], attempt: Number(match[1]) }))
      .sort((a, b) => b.attempt - a.attempt)[0];

    if (previousState) {
      const previousStatePath = path.join(env.pipelineWorkspacePath, previousState.name, previousState.name + '.txt');
      fs.readFileSync(previousStatePath, 'utf8')
        .split(/\n/)
        .filter(name => !!name)
        .forEach(name => this.set.add(name));
    }

    this.statePath = path.join(
      env.pipelineWorkspacePath,
      `artifacts_processed_${env.stageAttempt}`,
      `artifacts_processed_${env.stageAttempt}.txt`
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
  const publishAuthToken = await getAadToken({
    endpoint: `https://${env.stagingStorageAccountName}.blob.core.windows.net/`,
    tenantId: env.azureTenantId,
    clientId: env.azureClientId,
    auth: { idToken: env.azureIdToken },
  });

  const done = new State();

  for (const name of done) {
    console.log(`✅ layer ${name}`);
  }

  // NOTE: Any errors for a layer are allowed to propagate, since a failure blocks later layers

  const zipsDir = path.join(env.agentTempDirectory, 'npm-zips');
  fs.mkdirSync(zipsDir, { recursive: true });

  const layers = fs.readdirSync(packageLayersDir).sort();

  for (const layerNum of layers) {
    if (done.has(layerNum)) {
      continue;
    }

    console.log(`\n==== Starting layer ${layerNum.replace(/^0+/, '')} of ${layers.length} ====\n`);
    const layerPrefix = 'layer-' + layerNum;
    const layerLog = (...args: unknown[]) => console.log(`[${layerPrefix}]`, ...args);
    const layerDir = path.join(packageLayersDir, layerNum);

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
      publishAuthToken,
      authCertificatePfx: env.authCertificatePfx,
      requestSigningCertificatePfx: env.requestSigningCertificatePfx,
      clientId: env.releaseClientId,
      storageAccountName: env.stagingStorageAccountName,
      containerName,
      tenantId: env.releaseTenantId,
      version: env.buildSourceVersion,
      releaseRequestParams,
    });

    done.add(layerNum);
    console.log(`✅ layer ${layerNum}`);
  }

  console.log(`All ${done.size} artifacts published!`);
}

await main().catch(err => {
  console.error((err as Error).stack || err);
  // eslint-disable-next-line no-restricted-properties
  process.exit(1);
});

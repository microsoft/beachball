// based on the non-worker part of https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/common/publish.ts
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

const defaultUser = getEnv('ESRP_USER', '') || undefined;
const env = {
  // varies
  packedPackagesPath: getEnv('PACKED_PACKAGES_PATH'),
  esrp: {
    // static config
    productName: getEnv('ESRP_PRODUCT_NAME'),
    npmTag: getEnv('ESRP_NPM_TAG', 'latest'),
    createdBy: getEnv('ESRP_CREATED_BY', defaultUser),
    driEmail: [getEnv('ESRP_DRI_EMAIL', defaultUser)],
    owners: getEnv('ESRP_OWNERS', defaultUser).split(','),
    approvers: getEnv('ESRP_APPROVERS', defaultUser).split(','),
    clientId: getEnv('ESRP_CLIENT_ID'),
    tenantId: getEnv('ESRP_TENANT_ID'),

    // secrets
    authCertificatePfx: getEnv('ESRP_AUTH_CERT'),
    requestSigningCertificatePfx: getEnv('ESRP_REQUEST_SIGNING_CERT'),
  },
  azure: {
    // static config
    storageAccountName: getEnv('AZURE_STORAGE_ACCOUNT_NAME'),
    containerName: getEnv('AZURE_CONTAINER_NAME'),

    // secrets
    clientId: getEnv('AZURE_CLIENT_ID'),
    idToken: getEnv('AZURE_ID_TOKEN'),
    tenantId: getEnv('AZURE_TENANT_ID'),
  },
  ado: {
    agentBuildDirectory: getEnv('AGENT_BUILDDIRECTORY'),
    agentTempDirectory: getEnv('AGENT_TEMPDIRECTORY'),
    buildSourceVersion: getEnv('BUILD_SOURCEVERSION'),
    stageAttempt: getEnv('SYSTEM_STAGEATTEMPT'),
  },
};

class State {
  private statePath: string;
  private set = new Set<string>();

  constructor() {
    // https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/product-publish.yml#L19C1-L25C30
    // - output: pipelineArtifact
    //   targetPath: $(Agent.BuildDirectory)/artifacts_processed_$(System.StageAttempt)/artifacts_processed_$(System.StageAttempt).txt
    //   artifactName: artifacts_processed_$(System.StageAttempt)
    //   displayName: Publish the artifacts processed for this stage attempt
    //   sbomEnabled: false
    //   isProduction: false
    //   condition: always()
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
  const storageAuthToken = await getAadToken({
    endpoint: `https://${env.azure.storageAccountName}.blob.core.windows.net/`,
    tenantId: env.azure.tenantId,
    clientId: env.azure.clientId,
    auth: { idToken: env.azure.idToken },
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
    if (done.has(layerNum)) {
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
      storageAuthToken,
      authCertificatePfx: env.esrp.authCertificatePfx,
      requestSigningCertificatePfx: env.esrp.requestSigningCertificatePfx,
      storageAccountName: env.azure.storageAccountName,
      containerName: env.azure.containerName,
      clientId: env.esrp.clientId,
      tenantId: env.esrp.tenantId,
      version: env.ado.buildSourceVersion,
      releaseRequestParams: {
        createdBy: env.esrp.createdBy,
        driEmail: env.esrp.driEmail,
        owners: env.esrp.owners,
        approvers: env.esrp.approvers,
        productInfo: {
          name: env.esrp.productName,
          version: `${env.ado.buildSourceVersion}-${layerNum}`,
          description: `${env.esrp.productName} packages - ${layerNum}`,
        },
        releaseTitle: env.esrp.productName,
        npmTag: env.esrp.npmTag,
      },
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

// https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/common/publish.ts
// called by https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/product-publish.yml#L106

import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import type { ReadableStream } from 'stream/web';
import { pipeline } from 'node:stream/promises';
// @ts-expect-error - no longer installed
import yauzl from 'yauzl';
import { Worker } from 'node:worker_threads';
import { env, type Artifact } from './common.ts';
import { retry } from '../utils/retry.ts';

class State {
  private statePath: string;
  private set = new Set<string>();

  constructor() {
    const pipelineWorkspacePath = env.PIPELINE_WORKSPACE;
    const previousState = fs
      .readdirSync(pipelineWorkspacePath)
      .map(name => /^artifacts_processed_(\d+)$/.exec(name))
      .filter((match): match is RegExpExecArray => !!match)
      .map(match => ({ name: match[0], attempt: Number(match[1]) }))
      .sort((a, b) => b.attempt - a.attempt)[0];

    if (previousState) {
      const previousStatePath = path.join(pipelineWorkspacePath, previousState.name, previousState.name + '.txt');
      fs.readFileSync(previousStatePath, 'utf8')
        .split(/\n/)
        .filter(name => !!name)
        .forEach(name => this.set.add(name));
    }

    const stageAttempt = env.SYSTEM_STAGEATTEMPT;
    this.statePath = path.join(
      pipelineWorkspacePath,
      `artifacts_processed_${stageAttempt}`,
      `artifacts_processed_${stageAttempt}.txt`
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

const azdoFetchOptions = {
  headers: {
    // Pretend we're a web browser to avoid download rate limits
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: 'https://dev.azure.com',
    Authorization: `Bearer ${env.SYSTEM_ACCESSTOKEN}`,
  },
};

async function requestAZDOAPI<T>(pth: string): Promise<T> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 2 * 60 * 1000);

  try {
    const res = await retry(() =>
      fetch(`${env.BUILDS_API_URL}${pth}?api-version=6.0`, {
        ...azdoFetchOptions,
        signal: abortController.signal,
      })
    );

    if (!res.ok) {
      throw new Error(`Unexpected status code: ${res.status}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function getPipelineArtifacts(): Promise<Artifact[]> {
  const result = await requestAZDOAPI<{ readonly value: Artifact[] }>('artifacts');
  return result.value.filter(a => /^vscode_/.test(a.name) && !/sbom$/.test(a.name));
}

interface Timeline {
  readonly records: {
    readonly name: string;
    readonly type: string;
    readonly state: string;
    readonly result: string;
  }[];
}

async function getPipelineTimeline(): Promise<Timeline> {
  return await requestAZDOAPI<Timeline>('timeline');
}

async function downloadArtifact(artifact: Artifact, downloadPath: string): Promise<void> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 4 * 60 * 1000);

  try {
    const res = await fetch(artifact.resource.downloadUrl, {
      ...azdoFetchOptions,
      signal: abortController.signal,
    });

    if (!res.ok) {
      throw new Error(`Unexpected status code: ${res.status}`);
    }

    await pipeline(Readable.fromWeb(res.body as ReadableStream), fs.createWriteStream(downloadPath));
  } finally {
    clearTimeout(timeout);
  }
}

async function unzip(packagePath: string, outputPath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    /* eslint-disable */
    // @ts-expect-error - no longer installed
    yauzl.open(packagePath, { lazyEntries: true, autoClose: true }, (err, zipfile) => {
      if (err) {
        return reject(err);
      }

      const result: string[] = [];
      // @ts-expect-error - no longer installed
      zipfile.on('entry', entry => {
        if (entry.fileName.endsWith('/')) {
          zipfile.readEntry();
        } else {
          // @ts-expect-error - no longer installed
          zipfile.openReadStream(entry, (err, istream) => {
            if (err) return reject(err);

            const filePath = path.join(outputPath, entry.fileName);
            fs.mkdirSync(path.dirname(filePath), { recursive: true });

            const ostream = fs.createWriteStream(filePath);
            ostream.on('finish', () => {
              result.push(filePath);
              zipfile.readEntry();
            });
            // @ts-expect-error - no longer installed
            istream?.on('error', e => reject(e));
            istream.pipe(ostream);
          });
        }
      });

      zipfile.on('close', () => resolve(result));
      zipfile.readEntry();
    });
  });
  /* eslint-enable */
}

// It is VERY important that we don't download artifacts too much too fast from AZDO.
// AZDO throttles us SEVERELY if we do. Not just that, but they also close open
// sockets, so the whole things turns to a grinding halt. So, downloading and extracting
// happens serially in the main thread, making the downloads are spaced out
// properly. For each extracted artifact, we spawn a worker thread to upload it to
// the CDN and finally update the build in Cosmos DB.
async function main() {
  const done = new State();
  const processing = new Set<string>();

  for (const name of done) {
    console.log(`\u2705 ${name}`);
  }

  const stages = new Set<string>(['Quality']);

  if (env.VSCODE_BUILD_STAGE_WINDOWS === 'True') {
    stages.add('Windows');
  }
  if (env.VSCODE_BUILD_STAGE_LINUX === 'True') {
    stages.add('Linux');
  }
  if (env.VSCODE_BUILD_STAGE_ALPINE === 'True') {
    stages.add('Alpine');
  }
  if (env.VSCODE_BUILD_STAGE_MACOS === 'True') {
    stages.add('macOS');
  }
  if (env.VSCODE_BUILD_STAGE_WEB === 'True') {
    stages.add('Web');
  }

  let timeline: Timeline;
  let artifacts: Artifact[];
  let resultPromise = Promise.resolve<PromiseSettledResult<void>[]>([]);
  const operations: { name: string; operation: Promise<void> }[] = [];

  while (true) {
    [timeline, artifacts] = await Promise.all([
      retry(() => getPipelineTimeline()),
      retry(() => getPipelineArtifacts()),
    ]);
    const stagesCompleted = new Set<string>(
      timeline.records.filter(r => r.type === 'Stage' && r.state === 'completed' && stages.has(r.name)).map(r => r.name)
    );
    const stagesInProgress = [...stages].filter(s => !stagesCompleted.has(s));
    const artifactsInProgress = artifacts.filter(a => processing.has(a.name));

    if (stagesInProgress.length === 0 && artifacts.length === done.size + processing.size) {
      break;
    } else if (stagesInProgress.length > 0) {
      console.log('Stages in progress:', stagesInProgress.join(', '));
    } else if (artifactsInProgress.length > 0) {
      console.log('Artifacts in progress:', artifactsInProgress.map(a => a.name).join(', '));
    } else {
      console.log(`Waiting for a total of ${artifacts.length}, ${done.size} done, ${processing.size} in progress...`);
    }

    for (const artifact of artifacts) {
      if (done.has(artifact.name) || processing.has(artifact.name)) {
        continue;
      }

      console.log(`[${artifact.name}] Found new artifact`);

      const artifactZipPath = path.join(env.AGENT_TEMPDIRECTORY, `${artifact.name}.zip`);

      await retry(async attempt => {
        const start = Date.now();
        console.log(`[${artifact.name}] Downloading (attempt ${attempt})...`);
        await downloadArtifact(artifact, artifactZipPath);
        const archiveSize = fs.statSync(artifactZipPath).size;
        const downloadDurationS = (Date.now() - start) / 1000;
        const downloadSpeedKBS = Math.round(archiveSize / 1024 / downloadDurationS);
        console.log(
          `[${artifact.name}] Successfully downloaded after ${Math.floor(downloadDurationS)} seconds(${downloadSpeedKBS} KB/s).`
        );
      });

      const artifactFilePaths = await unzip(artifactZipPath, env.AGENT_TEMPDIRECTORY);
      const artifactFilePath = artifactFilePaths.filter(p => !/_manifest/.test(p))[0];

      processing.add(artifact.name);
      const promise = new Promise<void>((resolve, reject) => {
        const worker = new Worker(path.join(import.meta.dirname, 'worker.ts'), {
          workerData: { artifact, artifactFilePath },
        });
        worker.on('error', reject);
        worker.on('exit', code => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`[${artifact.name}] Worker stopped with exit code ${code}`));
          }
        });
      });

      const operation = promise.then(() => {
        processing.delete(artifact.name);
        done.add(artifact.name);
        console.log(`\u2705 ${artifact.name} `);
      });

      operations.push({ name: artifact.name, operation });
      resultPromise = Promise.allSettled(operations.map(o => o.operation));
    }

    await new Promise(c => setTimeout(c, 10_000));
  }

  console.log(
    `Found all ${done.size + processing.size} artifacts, waiting for ${processing.size} artifacts to finish publishing...`
  );

  const artifactsInProgress = operations.filter(o => processing.has(o.name));

  if (artifactsInProgress.length > 0) {
    console.log('Artifacts in progress:', artifactsInProgress.map(a => a.name).join(', '));
  }

  const results = await resultPromise;

  for (let i = 0; i < operations.length; i++) {
    const result = results[i];

    if (result.status === 'rejected') {
      console.error(`[${operations[i].name}]`, result.reason);
    }
  }

  // Fail the job if any of the artifacts failed to publish
  if (results.some(r => r.status === 'rejected')) {
    throw new Error('Some artifacts failed to publish');
  }

  // Also fail the job if any of the stages did not succeed
  let shouldFail = false;

  for (const stage of stages) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const record = timeline.records.find(r => r.name === stage && r.type === 'Stage')!;

    if (record.result !== 'succeeded' && record.result !== 'succeededWithIssues') {
      shouldFail = true;
      console.error(`Stage ${stage} did not succeed: ${record.result}`);
    }
  }

  if (shouldFail) {
    throw new Error('Some stages did not succeed');
  }

  console.log(`All ${done.size} artifacts published!`);
}

if (import.meta.main) {
  main().then(
    () => {
      // eslint-disable-next-line no-restricted-properties
      process.exit(0);
    },
    err => {
      console.error(err);
      // eslint-disable-next-line no-restricted-properties
      process.exit(1);
    }
  );
}

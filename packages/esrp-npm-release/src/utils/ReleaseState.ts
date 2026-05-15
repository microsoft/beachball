import type { ContainerClient, BlobServiceClient } from '@azure/storage-blob';
import { ReleaseError } from './ReleaseError.ts';

const stateContainerName = 'release-state';

const getContainerDesc = (accountName: string) =>
  `container "${stateContainerName}" in storage account "${accountName}"` as const;

/**
 * Tracks which layers have been successfully published for the current source version.
 *
 * State is persisted to Azure Blob Storage in the staging storage account under the
 * `release-state` container. Each successfully-published layer corresponds to one empty
 * marker blob at `{repoName}/{buildSourceVersion}/{layerName}`. This allows the tool to
 * resume from where it left off when ADO retries a failed stage or task, skipping layers
 * that were already published to npm. The repo name prefix isolates state between
 * different repositories sharing the same staging storage account.
 *
 * Keying by `buildSourceVersion` (rather than build ID + stage attempt) means state is
 * shared across all retries and reruns for the same git commit, which is what we want
 * since the same source version always produces the same layers.
 *
 * The recommended bicep template includes a lifecycle management policy to clean up blobs
 * after a given window (90 days as of writing).
 */
export class ReleaseState {
  #publishedLayers: Set<string>;
  #containerClient: ContainerClient;
  #prefix: string;

  /**
   * Initialize the ReleaseState from persisted state in Azure Blob Storage, loading the list of
   * already-published layers for this `repoName` + `sourceVersion`. Throws `ReleaseError` on any issue.
   */
  public static async create(params: {
    blobServiceClient: BlobServiceClient;
    repoName: string;
    sourceVersion: string;
  }): Promise<ReleaseState> {
    const { blobServiceClient, repoName, sourceVersion } = params;
    const desc = getContainerDesc(blobServiceClient.accountName);

    let containerClient: ContainerClient;
    try {
      containerClient = blobServiceClient.getContainerClient(stateContainerName);
    } catch (err) {
      throw new ReleaseError(`Error initializing client for ${desc}`, { cause: err });
    }

    await containerClient.createIfNotExists().catch(err => {
      throw new ReleaseError(`Error creating or accessing ${desc}`, { cause: err });
    });

    const prefix = `${repoName}/${sourceVersion}/`;
    const publishedLayers = new Set<string>();
    try {
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        publishedLayers.add(blob.name.slice(prefix.length));
      }
    } catch (err) {
      throw new ReleaseError(`Error listing blobs with prefix "${prefix}" in ${desc}`, { cause: err });
    }

    return new ReleaseState(containerClient, prefix, publishedLayers);
  }

  private constructor(containerClient: ContainerClient, prefix: string, publishedLayers: Set<string>) {
    this.#containerClient = containerClient;
    this.#prefix = prefix;
    this.#publishedLayers = publishedLayers;
  }

  /** Number of layers published */
  public get publishedCount(): number {
    return this.#publishedLayers.size;
  }

  /** Returns whether the layer has already been published */
  public hasPublished(layerNum: string): boolean {
    return this.#publishedLayers.has(layerNum);
  }

  /** Marks the layer as published (throws `ReleaseError` on any issue) */
  public async markPublished(layerNum: string): Promise<void> {
    const blobName = this.#prefix + layerNum;
    try {
      const blobClient = this.#containerClient.getBlockBlobClient(blobName);
      await blobClient.upload('', 0);
      this.#publishedLayers.add(layerNum);
    } catch (err) {
      throw new ReleaseError(
        `Error marking layer ${layerNum} as published in persisted release state ` +
          `(${getContainerDesc(this.#containerClient.accountName)})`,
        { cause: err }
      );
    }
  }
}

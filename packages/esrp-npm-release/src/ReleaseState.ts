import type { ContainerClient, BlobServiceClient } from '@azure/storage-blob';

const stateContainerName = 'release-state';

/**
 * Tracks which layers have been successfully published for the current source version.
 *
 * State is persisted to Azure Blob Storage in the staging storage account under the
 * `release-state` container. Each successfully-published layer corresponds to one empty
 * marker blob at `{buildSourceVersion}/{layerName}`. This allows the tool to resume from
 * where it left off when ADO retries a failed stage or task, skipping layers that were
 * already published to npm.
 *
 * Keying by `buildSourceVersion` (rather than build ID + stage attempt) means state is
 * shared across all retries and reruns for the same git commit, which is what we want
 * since the same source version always produces the same layers.
 */
export class ReleaseState {
  private set = new Set<string>();
  private containerClient: ContainerClient;
  private prefix: string;

  private constructor(containerClient: ContainerClient, prefix: string) {
    this.containerClient = containerClient;
    this.prefix = prefix;
  }

  static async create(blobServiceClient: BlobServiceClient, sourceVersion: string): Promise<ReleaseState> {
    const containerClient = blobServiceClient.getContainerClient(stateContainerName);
    await containerClient.createIfNotExists();

    const prefix = `${sourceVersion}/`;
    const state = new ReleaseState(containerClient, prefix);

    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      state.set.add(blob.name.slice(prefix.length));
    }

    return state;
  }

  /** Number of layers published */
  get publishedCount(): number {
    return this.set.size;
  }

  /** Returns whether the layer has already been published */
  hasPublished(layerNum: string): boolean {
    return this.set.has(layerNum);
  }

  /** Marks the layer as published */
  async markPublished(layerNum: string): Promise<void> {
    const blobClient = this.containerClient.getBlockBlobClient(this.prefix + layerNum);
    await blobClient.upload('', 0);
    this.set.add(layerNum);
  }
}

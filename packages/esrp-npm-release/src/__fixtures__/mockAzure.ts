import { jest } from '@jest/globals';
import type {
  BlobDeleteResponse,
  BlobItem,
  BlobServiceClient,
  BlobUploadCommonResponse,
  BlockBlobClient,
  BlockBlobUploadResponse,
  ContainerClient,
  ContainerCreateIfNotExistsResponse,
  ServiceGetUserDelegationKeyResponse,
} from '@azure/storage-blob';

/**
 * Fake `BlockBlobClient` exposing only the methods the production code calls.
 * All async methods are `jest.fn()` so tests can assert calls and override behavior per-test.
 */
export type MockBlockBlobClient = Pick<BlockBlobClient, 'url'> &
  jest.Mocked<Pick<BlockBlobClient, 'upload' | 'uploadFile' | 'delete'>>;

export function createMockBlockBlobClient(url = 'https://mock.blob.core.windows.net/c/blob'): MockBlockBlobClient {
  return {
    url,
    upload: jest.fn(() => Promise.resolve({} as BlockBlobUploadResponse)),
    uploadFile: jest.fn(() => Promise.resolve({} as BlobUploadCommonResponse)),
    delete: jest.fn(() => Promise.resolve({} as BlobDeleteResponse)),
  };
}

/**
 * Fake `ContainerClient` covering only the methods the production code calls.
 *
 * Stateful mode: `getBlockBlobClient(name)` returns a per-name blob client backed
 * by an internal `Map`. Calls to `upload`/`uploadFile` add the blob to the listed set;
 * `delete` removes it. `listBlobsFlat({ prefix })` reflects those changes, so tests can
 * round-trip persistence behavior (write a blob, recreate state, see it listed).
 *
 * Basic mode: passing `blobClient` makes `getBlockBlobClient` ignore the name and always
 * return that single client. Use this when a test only needs to assert the call args of one
 * blob and doesn't care about list-after-write consistency.
 */
export interface MockContainerClient extends Pick<ContainerClient, 'accountName' | 'containerName'> {
  createIfNotExists: jest.Mock<ContainerClient['createIfNotExists']>;
  getBlockBlobClient: jest.Mock<(name: string) => MockBlockBlobClient>;
  listBlobsFlat: jest.Mock<(opts?: { prefix?: string }) => AsyncIterable<Pick<BlobItem, 'name'>>>;
}

export function createMockContainerClient(
  opts: {
    accountName?: string;
    containerName?: string;
    /** Initial set of blob names to seed `listBlobsFlat` with (stateful mode). */
    blobNames?: string[];
    /**
     * Single blob client returned from `getBlockBlobClient` regardless of name.
     * Disables stateful tracking (uploads via this client won't appear in `listBlobsFlat`).
     */
    blobClient?: MockBlockBlobClient;
  } = {}
): MockContainerClient {
  const accountName = opts.accountName ?? 'mockaccount';
  const containerName = opts.containerName ?? 'mockcontainer';

  /** Set of "live" blob names */
  const liveNames = new Set<string>(opts.blobNames ?? []);

  /** Build a per-name blob client whose mutating methods update `liveNames`. */
  function makeBlobClient(name: string): MockBlockBlobClient {
    const url = `https://${accountName}.blob.core.windows.net/${containerName}/${name}`;
    return {
      url,
      upload: jest.fn(() => {
        liveNames.add(name);
        return Promise.resolve({} as BlockBlobUploadResponse);
      }),
      uploadFile: jest.fn(() => {
        liveNames.add(name);
        return Promise.resolve({} as BlobUploadCommonResponse);
      }),
      delete: jest.fn(() => {
        liveNames.delete(name);
        return Promise.resolve({} as BlobDeleteResponse);
      }),
    };
  }

  return {
    accountName,
    containerName,
    createIfNotExists: jest.fn(() => Promise.resolve({ succeeded: true } as ContainerCreateIfNotExistsResponse)),
    getBlockBlobClient: jest.fn((name: string) => {
      if (opts.blobClient) return opts.blobClient;
      return makeBlobClient(name);
    }),
    listBlobsFlat: jest.fn(
      // eslint-disable-next-line @typescript-eslint/require-await
      async function* (filter?: { prefix?: string }) {
        const prefix = filter?.prefix ?? '';
        for (const name of liveNames) {
          if (name.startsWith(prefix)) yield { name };
        }
      }
    ),
  };
}

/**
 * Fake `BlobServiceClient` covering only what the production code uses. `getContainerClient`
 * returns the same fake container by default.
 */
export interface MockBlobServiceClient extends Pick<BlobServiceClient, 'accountName'> {
  getContainerClient: jest.Mock<(name: string) => MockContainerClient>;
  getUserDelegationKey: jest.Mock<BlobServiceClient['getUserDelegationKey']>;
}

export function createMockBlobServiceClient(
  opts: {
    accountName?: string;
    containerClient?: MockContainerClient;
  } = {}
): MockBlobServiceClient {
  const accountName = opts.accountName ?? 'mockaccount';
  const containerClient = opts.containerClient ?? createMockContainerClient({ accountName });
  return {
    accountName,
    getContainerClient: jest.fn<(name: string) => MockContainerClient>().mockReturnValue(containerClient),
    getUserDelegationKey: jest.fn(() => Promise.resolve({ value: 'mock-key' } as ServiceGetUserDelegationKeyResponse)),
  };
}

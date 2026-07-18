import type { BlobServiceClient } from '@azure/storage-blob';
import { describe, expect, it } from '@jest/globals';
import {
  createMockBlobServiceClient,
  createMockBlockBlobClient,
  createMockContainerClient,
  type MockBlockBlobClient,
} from '../__fixtures__/mockAzure.ts';
import { ReleaseError } from '../utils/ReleaseError.ts';
import { ReleaseState } from '../utils/ReleaseState.ts';

describe('ReleaseState', () => {
  const params = {
    repoName: 'repo1',
    buildSourceVersion: 'abc',
    productName: 'prod1',
    npmTag: undefined,
  };

  describe('create', () => {
    it('lists blobs with the expected prefix and populates publishedLayers', async () => {
      const containerClient = createMockContainerClient({
        blobNames: ['repo1/abc/prod1/0', 'repo1/abc/prod1/1', 'repo1/abc/prod1/2'],
      });
      const blobServiceClient = createMockBlobServiceClient({ containerClient });

      const state = await ReleaseState.create({
        blobServiceClient: blobServiceClient as unknown as BlobServiceClient,
        ...params,
      });

      expect(blobServiceClient.getContainerClient).toHaveBeenCalledWith('release-state');
      expect(containerClient.createIfNotExists).toHaveBeenCalledTimes(1);
      expect(containerClient.listBlobsFlat).toHaveBeenCalledWith({ prefix: 'repo1/abc/prod1/' });
      expect(state.publishedCount).toBe(3);
      expect(state.hasPublished('2')).toBe(true);
      expect(state.hasPublished('3')).toBe(false);
    });

    it('returns publishedCount=0 when no blobs match the prefix', async () => {
      const containerClient = createMockContainerClient({ blobNames: [] });
      const state = await ReleaseState.create({
        blobServiceClient: createMockBlobServiceClient({ containerClient }) as unknown as BlobServiceClient,
        ...params,
      });

      expect(state.publishedCount).toBe(0);
    });

    it('includes the npmTag in the prefix when present', async () => {
      const containerClient = createMockContainerClient({
        blobNames: ['repo1/abc/prod1/latest/0'],
      });
      const state = await ReleaseState.create({
        blobServiceClient: createMockBlobServiceClient({ containerClient }) as unknown as BlobServiceClient,
        ...params,
        npmTag: 'latest',
      });

      expect(containerClient.listBlobsFlat).toHaveBeenCalledWith({ prefix: 'repo1/abc/prod1/latest/' });
      expect(state.publishedCount).toBe(1);
      expect(state.hasPublished('0')).toBe(true);
    });

    it('isolates state by npmTag so the same product under different tags does not collide', async () => {
      const containerClient = createMockContainerClient();
      const blobServiceClient = createMockBlobServiceClient({ containerClient });

      const latest = await ReleaseState.create({
        blobServiceClient: blobServiceClient as unknown as BlobServiceClient,
        ...params,
        npmTag: 'latest',
      });
      await latest.markPublished('0');
      expect(containerClient.getBlockBlobClient).toHaveBeenCalledWith('repo1/abc/prod1/latest/0');

      // Same product + build but a different tag -- should see nothing.
      const next = await ReleaseState.create({
        blobServiceClient: blobServiceClient as unknown as BlobServiceClient,
        ...params,
        npmTag: 'next',
      });
      expect(next.publishedCount).toBe(0);
      expect(next.hasPublished('0')).toBe(false);
    });

    it('wraps errors from getContainerClient with ReleaseError', async () => {
      const blobServiceClient = createMockBlobServiceClient();
      const originalError = new Error('synthetic getContainerClient failure');
      blobServiceClient.getContainerClient.mockImplementation(() => {
        throw originalError;
      });

      const err = await ReleaseState.create({
        blobServiceClient: blobServiceClient as unknown as BlobServiceClient,
        ...params,
      }).catch(e => e as unknown);
      expect(err).toBeInstanceOf(ReleaseError);
      expect((err as ReleaseError).message).toBe(
        `Error initializing client for container "release-state" in storage account "mockaccount"`
      );
      expect((err as ReleaseError).cause).toBe(originalError);
    });

    it('wraps errors from createIfNotExists with ReleaseError mentioning the container and account', async () => {
      const containerClient = createMockContainerClient({ accountName: 'myacct' });
      const originalError = new Error('synthetic createIfNotExists failure');
      containerClient.createIfNotExists.mockRejectedValue(originalError);

      const err = await ReleaseState.create({
        blobServiceClient: createMockBlobServiceClient({
          accountName: 'myacct',
          containerClient,
        }) as unknown as BlobServiceClient,
        ...params,
      }).catch(e => e as unknown);
      expect(err).toBeInstanceOf(ReleaseError);
      expect((err as ReleaseError).message).toBe(
        'Error creating or accessing container "release-state" in storage account "myacct"'
      );
      expect((err as ReleaseError).cause).toBe(originalError);
    });

    it('wraps errors from listBlobsFlat with ReleaseError mentioning the prefix', async () => {
      const containerClient = createMockContainerClient();
      const originalError = new Error('synthetic listBlobsFlat failure');
      containerClient.listBlobsFlat.mockImplementation(() => {
        throw originalError;
      });

      const err = await ReleaseState.create({
        blobServiceClient: createMockBlobServiceClient({ containerClient }) as unknown as BlobServiceClient,
        ...params,
      }).catch(e => e as unknown);
      expect(err).toBeInstanceOf(ReleaseError);
      expect((err as ReleaseError).message).toBe(
        'Error listing blobs with prefix "repo1/abc/prod1/" in container "release-state" in storage account "mockaccount"'
      );
      expect((err as ReleaseError).cause).toBe(originalError);
    });
  });

  describe('markPublished', () => {
    async function newState() {
      const blobClient = createMockBlockBlobClient();
      const containerClient = createMockContainerClient({ blobClient });
      const blobServiceClient = createMockBlobServiceClient({ containerClient });
      const state = await ReleaseState.create({
        blobServiceClient: blobServiceClient as unknown as BlobServiceClient,
        ...params,
      });
      return { state, blobClient, containerClient };
    }

    it('uploads an empty blob at the prefixed path and adds the layer to the set', async () => {
      const { state, blobClient, containerClient } = await newState();

      await state.markPublished('5');

      expect(containerClient.getBlockBlobClient).toHaveBeenCalledWith('repo1/abc/prod1/5');
      expect(blobClient.upload).toHaveBeenCalledWith('', 0);
      expect(state.hasPublished('5')).toBe(true);
      expect(state.publishedCount).toBe(1);
    });

    it('wraps upload failures with ReleaseError mentioning the layer and account', async () => {
      const blobClient = createMockBlockBlobClient();
      const originalError = new Error('synthetic upload failure');
      blobClient.upload.mockRejectedValue(originalError);
      const containerClient = createMockContainerClient({ accountName: 'myacct', blobClient });
      const state = await ReleaseState.create({
        blobServiceClient: createMockBlobServiceClient({
          accountName: 'myacct',
          containerClient,
        }) as unknown as BlobServiceClient,
        ...params,
      });

      const err = await state.markPublished('5').catch(e => e as unknown);
      expect(err).toBeInstanceOf(ReleaseError);
      expect((err as ReleaseError).message).toBe(
        'Error marking layer 5 as published in persisted release state (container "release-state" in storage account "myacct")'
      );
      expect((err as ReleaseError).cause).toBe(originalError);
      // Did not record the layer as published since upload failed
      expect(state.hasPublished('5')).toBe(false);
    });
  });

  describe('persistence round-trip', () => {
    it('a layer marked published shows up in a fresh ReleaseState.create against the same container', async () => {
      // Stateful container: getBlockBlobClient(name) returns per-name clients and
      // listBlobsFlat reflects whatever has been uploaded.
      const containerClient = createMockContainerClient();
      const blobServiceClient = createMockBlobServiceClient({ containerClient });

      const initial = await ReleaseState.create({
        blobServiceClient: blobServiceClient as unknown as BlobServiceClient,
        ...params,
      });
      expect(initial.publishedCount).toBe(0);

      await initial.markPublished('0');
      await initial.markPublished('2');

      // The blob clients are per-name, so each upload was against the right blob.
      const blob0 = containerClient.getBlockBlobClient.mock.results[0].value as MockBlockBlobClient;
      const blob2 = containerClient.getBlockBlobClient.mock.results[1].value as MockBlockBlobClient;
      expect(blob0.url).toBe('https://mockaccount.blob.core.windows.net/mockcontainer/repo1/abc/prod1/0');
      expect(blob2.url).toBe('https://mockaccount.blob.core.windows.net/mockcontainer/repo1/abc/prod1/2');
      expect(blob0.upload).toHaveBeenCalledWith('', 0);
      expect(blob2.upload).toHaveBeenCalledWith('', 0);

      // A fresh ReleaseState reading the same container should see both layers.
      const reloaded = await ReleaseState.create({
        blobServiceClient: blobServiceClient as unknown as BlobServiceClient,
        ...params,
      });
      expect(reloaded.publishedCount).toBe(2);
      expect(reloaded.hasPublished('0')).toBe(true);
      expect(reloaded.hasPublished('2')).toBe(true);
      expect(reloaded.hasPublished('1')).toBe(false);
    });

    it('isolates state by repoName and buildSourceVersion prefix', async () => {
      const containerClient = createMockContainerClient();
      const blobServiceClient = createMockBlobServiceClient({ containerClient });

      const repo1 = await ReleaseState.create({
        blobServiceClient: blobServiceClient as unknown as BlobServiceClient,
        ...params,
      });
      await repo1.markPublished('0');

      // Different repoName -- should see nothing
      const repo2 = await ReleaseState.create({
        blobServiceClient: blobServiceClient as unknown as BlobServiceClient,
        ...params,
        repoName: 'repo2',
      });
      expect(repo2.publishedCount).toBe(0);

      // Different buildSourceVersion -- should see nothing
      const repo1Other = await ReleaseState.create({
        blobServiceClient: blobServiceClient as unknown as BlobServiceClient,
        ...params,
        buildSourceVersion: 'def',
      });
      expect(repo1Other.publishedCount).toBe(0);
    });

    it('isolates state by productName so a second invocation on the same build sees fresh state', async () => {
      const containerClient = createMockContainerClient();
      const blobServiceClient = createMockBlobServiceClient({ containerClient });

      // First invocation on this build publishes its layer 0.
      const canary = await ReleaseState.create({
        blobServiceClient: blobServiceClient as unknown as BlobServiceClient,
        ...params,
        productName: 'beachball-canary',
      });
      await canary.markPublished('0');

      // Second invocation on the same build (same repo + buildSourceVersion) but a different set of
      // packages must NOT see the first invocation's layer 0 as already published.
      const others = await ReleaseState.create({
        blobServiceClient: blobServiceClient as unknown as BlobServiceClient,
        ...params,
        productName: 'beachball-others',
      });
      expect(others.publishedCount).toBe(0);
      expect(others.hasPublished('0')).toBe(false);
    });
  });
});

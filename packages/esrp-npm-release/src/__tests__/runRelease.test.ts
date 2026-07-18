/* eslint-disable @typescript-eslint/unbound-method */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import type { ESRPReleaseService } from '../ESRPReleaseService.ts';
import { MockLogger } from '../__fixtures__/MockLogger.ts';
import { createMockEnv } from '../__fixtures__/mockEnv.ts';
import { createPackedDir, setupTempDir } from '../__fixtures__/tempDir.ts';
import { ReleaseError } from '../utils/ReleaseError.ts';
import type { ReleaseState } from '../utils/ReleaseState.ts';

//
// This test mocks all external interactions of runRelease but uses actual zip files.
//

jest.unstable_mockModule('@azure/storage-blob', () => ({
  BlobServiceClient: class {
    public accountName = 'stagingaccount';
  },
}));

const mockReleaseStateCreate = jest.fn<typeof ReleaseState.create>();
jest.unstable_mockModule('../utils/ReleaseState.ts', () => ({
  ReleaseState: { create: mockReleaseStateCreate },
}));

const releaseService = { createRelease: jest.fn() } as unknown as jest.Mocked<typeof ESRPReleaseService.prototype>;
jest.unstable_mockModule('../ESRPReleaseService.ts', () => ({
  ESRPReleaseService: { create: () => releaseService },
}));

jest.unstable_mockModule<typeof import('../auth/getAadToken.ts')>('../auth/getAadToken.ts', () => ({
  getAadToken: () => Promise.resolve({ token: 'token', expiresOnTimestamp: 0 }),
}));

const { runRelease } = await import('../runRelease.ts');

describe('runRelease', () => {
  const { getTempDir } = setupTempDir();
  let logger: MockLogger;
  let state: jest.Mocked<typeof ReleaseState.prototype>;

  function makeReleaseState(opts: { alreadyPublished?: string[] } = {}): typeof state {
    const published = new Set(opts.alreadyPublished ?? []);
    return {
      get publishedCount() {
        return published.size;
      },
      hasPublished: jest.fn((layer: string) => published.has(layer)),
      markPublished: jest.fn(async (layer: string) => {
        await Promise.resolve();
        published.add(layer);
      }),
    } satisfies Partial<typeof state> as unknown as typeof state;
  }

  function envWithTempPaths(layers: Record<string, string[]>) {
    const temp = getTempDir();
    const agentTemp = path.join(temp, 'agent');
    fs.mkdirSync(agentTemp, { recursive: true });

    const packedDir = createPackedDir(temp, layers);

    const env = createMockEnv();
    env.packedPackagesPath = packedDir;
    env.ado.agentTempDirectory = agentTemp;
    env.ado.buildSourceVersion = 'commit-1';
    return env;
  }

  beforeEach(() => {
    jest.resetAllMocks();
    logger = new MockLogger();
    state = makeReleaseState();
    mockReleaseStateCreate.mockImplementation(() => Promise.resolve(state));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('zips and releases each unpublished layer in order, then marks them published', async () => {
    const env = envWithTempPaths({
      '1': ['pkg-a-1.0.0.tgz'],
      '2': ['pkg-b-2.0.0.tgz', 'pkg-c-3.0.0.tgz'],
    });

    await runRelease({ env, logger });

    // Releases happen in sorted layer order
    expect(releaseService.createRelease).toHaveBeenCalledTimes(2);
    const layerVersions = releaseService.createRelease.mock.calls.map(
      ([params]) => params.releaseRequestParams.productInfo.version
    );
    expect(layerVersions).toEqual(['commit-1-1', 'commit-1-2']);

    // Each layer is then marked published
    expect(state.markPublished).toHaveBeenCalledTimes(2);
    expect(state.markPublished.mock.calls.map(c => c[0])).toEqual(['1', '2']);

    // Zip files were actually created on disk
    const zipsDir = path.join(env.ado.agentTempDirectory, 'npm-zips');
    expect(fs.readdirSync(zipsDir).length).toBe(2);
  });

  it('processes 10+ zero-padded layer names in correct numeric order via lexical sort', async () => {
    // beachball pads layer numbers to a uniform width (packPackage.ts), so layer names
    // like '01', '02', ..., '10' lexically sort the same as numerically. This test pins
    // that behavior so a regression to unpadded names (which would sort as ['1', '10', '2'])
    // would be caught here.
    const layers: Record<string, string[]> = {};
    for (let i = 1; i <= 12; i++) {
      const name = String(i).padStart(2, '0');
      layers[name] = [`pkg-${name}-1.0.0.tgz`];
    }

    await runRelease({ env: envWithTempPaths(layers), logger });

    const publishCalls = state.markPublished.mock.calls.map(c => c[0]);
    expect(publishCalls).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']);
  });

  it('skips layers that have already been published', async () => {
    state = makeReleaseState({ alreadyPublished: ['1'] });

    const env = envWithTempPaths({
      '1': ['pkg-a-1.0.0.tgz'],
      '2': ['pkg-b-2.0.0.tgz'],
    });

    await runRelease({ env, logger });

    expect(releaseService.createRelease).toHaveBeenCalledTimes(1);
    expect(releaseService.createRelease.mock.calls[0][0]).toMatchObject({
      releaseRequestParams: { productInfo: { version: 'commit-1-2' } },
    });
    expect(state.markPublished).toHaveBeenCalledTimes(1);
    expect(state.markPublished).toHaveBeenCalledWith('2');
    // Logged the skip
    expect(logger.lines.some(l => l.includes('layer 1 (already published)'))).toBe(true);
  });

  it('strips an "org/" prefix from BUILD_REPOSITORY_NAME when computing the staging path prefix', async () => {
    const env = envWithTempPaths({ '1': ['pkg-a.tgz'] });
    env.ado.buildRepositoryName = 'my-org/my-repo';

    await runRelease({ env, logger });

    expect(mockReleaseStateCreate).toHaveBeenCalledWith(expect.objectContaining({ repoName: 'my-repo' }));
    expect(releaseService.createRelease).toHaveBeenCalledWith(expect.objectContaining({ repoName: 'my-repo' }));
  });

  it('passes the bare repository name through unchanged when there is no "org/" prefix', async () => {
    const env = envWithTempPaths({ '1': ['pkg-a.tgz'] });
    env.ado.buildRepositoryName = 'bare-repo';

    await runRelease({ env, logger });

    expect(mockReleaseStateCreate).toHaveBeenCalledWith(expect.objectContaining({ repoName: 'bare-repo' }));
  });

  it('propagates failures from createRelease', async () => {
    const originalError = new Error('oh no');
    releaseService.createRelease.mockRejectedValue(originalError);
    const env = envWithTempPaths({ '1': ['pkg-a.tgz'] });

    const err = await runRelease({ env, logger }).catch(e => e as unknown);
    expect(err).toBe(originalError);
    expect(state.markPublished).not.toHaveBeenCalled();
  });

  it('warns and succeeds when no layer directories are found', async () => {
    const env = envWithTempPaths({});

    await expect(runRelease({ env, logger })).resolves.toBeUndefined();
    expect(logger.mocks.warn).toHaveBeenCalledTimes(1);
    expect(logger.lines).toContainEqual(expect.stringContaining('No layer directories found'));
    expect(releaseService.createRelease).not.toHaveBeenCalled();
  });

  it('only includes .tgz files in the layer zips (ignores other files)', async () => {
    const env = envWithTempPaths({ '1': ['pkg-a-1.0.0.tgz', 'README.md'] });

    await runRelease({ env, logger });

    // Both files exist on disk, but only the .tgz is logged as added to the zip
    const addedLines = logger.lines.filter(l => l.includes('- pkg') || l.includes('- README'));
    expect(addedLines.length).toBe(1);
    expect(addedLines[0]).toContain('- pkg-a-1.0.0.tgz');
  });

  it('skips non-numeric subdirectories like "_manifest" (SBOM output) under packed packages', async () => {
    const env = envWithTempPaths({
      '1': ['pkg-a-1.0.0.tgz'],
      '2': ['pkg-b-2.0.0.tgz'],
      _manifest: ['manifest.spdx.json'], // SBOM-style sibling directory
    });

    await runRelease({ env, logger });

    // Only the two numbered layers should be released; "_manifest" should be silently skipped.
    expect(releaseService.createRelease).toHaveBeenCalledTimes(2);
    const layerVersions = releaseService.createRelease.mock.calls.map(
      ([params]) => params.releaseRequestParams.productInfo.version
    );
    expect(layerVersions).toEqual(['commit-1-1', 'commit-1-2']);
    expect(state.markPublished.mock.calls.map(c => c[0])).toEqual(['1', '2']);
    // No log line should mention _manifest (it's filtered out before logging)
    expect(logger.lines.some(l => l.includes('_manifest'))).toBe(false);
  });

  it('throws when a layer directory contains no .tgz files', async () => {
    const env = envWithTempPaths({
      '1': ['pkg-a-1.0.0.tgz'],
      '2': ['README.md'], // no .tgz
    });

    const err = await runRelease({ env, logger }).catch(e => e as unknown);
    expect(err).toBeInstanceOf(ReleaseError);
    expect((err as ReleaseError).message).toMatch(/No \.tgz files found in layer directory.*[/\\]2$/);
    // Layer 1 was released before the failure was hit
    expect(releaseService.createRelease).toHaveBeenCalledTimes(1);
    expect(state.markPublished).toHaveBeenCalledWith('1');
    expect(state.markPublished).not.toHaveBeenCalledWith('2');
  });
});

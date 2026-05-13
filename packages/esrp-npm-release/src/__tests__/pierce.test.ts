import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { pierce, type PierceOptions } from '../utils/pierce.ts';
import { ReleaseError } from '../utils/ReleaseError.ts';
import { MockLogger } from '../__fixtures__/MockLogger.ts';

describe('pierce', () => {
  let fetchMock: jest.Mock<typeof fetch>;
  let logger: MockLogger;
  const originalFetch = globalThis.fetch;

  const baseParams: Pick<PierceOptions, 'accessToken' | 'collectionUri' | 'feedId'> = {
    accessToken: 'tok',
    collectionUri: 'https://dev.azure.com/myorg/',
    feedId: 'feed-guid',
  };

  function makeFetchResponse(opts: { status: number }): Response {
    return { status: opts.status } as Response;
  }

  beforeEach(() => {
    fetchMock = jest.fn<typeof fetch>();
    globalThis.fetch = fetchMock;
    logger = new MockLogger();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('does nothing and logs when packages map is empty', async () => {
    await pierce({ ...baseParams, packages: {}, logger });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(logger.lines).toEqual(['[log] No packages to pierce.']);
  });

  it('issues a HEAD with manual redirect, bearer auth, and the expected URL for each package', async () => {
    fetchMock.mockResolvedValue(makeFetchResponse({ status: 200 }));

    await pierce({
      ...baseParams,
      packages: { 'pkg-a': '1.0.0', '@scope/pkg-b': '2.3.4' },
      logger,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://pkgs.dev.azure.com/myorg/_apis/packaging/feeds/feed-guid/npm/packages/pkg-a/versions/1.0.0/content',
      { method: 'HEAD', headers: { Authorization: 'Bearer tok' }, redirect: 'manual' }
    );
    // Scoped names are passed through as-is (not URL-encoded), since the ADO endpoint accepts them
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://pkgs.dev.azure.com/myorg/_apis/packaging/feeds/feed-guid/npm/packages/@scope/pkg-b/versions/2.3.4/content',
      expect.anything()
    );
  });

  it('treats 200 as already-ingested and 303 as ingestion-triggered (both success)', async () => {
    fetchMock
      .mockResolvedValueOnce(makeFetchResponse({ status: 200 }))
      .mockResolvedValueOnce(makeFetchResponse({ status: 303 }));

    await pierce({ ...baseParams, packages: { 'pkg-a': '1.0.0', 'pkg-b': '2.0.0' }, logger });

    expect(logger.getOutput()).toMatchInlineSnapshot(`
      "[log] Piercing 2 package version(s) into feed myorg/feed-guid
      [log] ✅ pkg-a@1.0.0 (already ingested)
      [log] ✅ pkg-b@2.0.0 (ingestion triggered)
      [log] Pierced 2 package version(s) successfully."
    `);
  });

  it('parses the org from a legacy "<org>.visualstudio.com" collection URI', async () => {
    fetchMock.mockResolvedValue(makeFetchResponse({ status: 200 }));

    await pierce({
      ...baseParams,
      collectionUri: 'https://oldorg.visualstudio.com/',
      packages: { 'pkg-a': '1.0.0' },
      logger,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://pkgs.dev.azure.com/oldorg/_apis/packaging/feeds/feed-guid/npm/packages/pkg-a/versions/1.0.0/content',
      expect.anything()
    );
  });

  it('throws ReleaseError when collectionUri is unparseable', async () => {
    const err = await pierce({
      ...baseParams,
      collectionUri: 'not a url',
      packages: { 'pkg-a': '1.0.0' },
      logger,
    }).catch(e => e as unknown);

    expect(err).toBeInstanceOf(ReleaseError);
    expect((err as ReleaseError).message).toContain('Invalid SYSTEM_COLLECTIONURI');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws ReleaseError when collectionUri has no org segment', async () => {
    const err = await pierce({
      ...baseParams,
      collectionUri: 'https://dev.azure.com/',
      packages: { 'pkg-a': '1.0.0' },
      logger,
    }).catch(e => e as unknown);

    expect(err).toBeInstanceOf(ReleaseError);
    expect((err as ReleaseError).message).toContain('Could not parse organization');
  });

  it('retries with exponential backoff (1s, 2s, 4s, 8s, 16s) and eventually succeeds', async () => {
    jest.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(makeFetchResponse({ status: 500 }))
      .mockResolvedValueOnce(makeFetchResponse({ status: 502 }))
      .mockResolvedValueOnce(makeFetchResponse({ status: 200 }));

    const promise = pierce({
      ...baseParams,
      packages: { 'pkg-a': '1.0.0' },
      logger,
    });

    // First attempt (sync), then 1s wait
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Second backoff is 2s
    await jest.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await expect(promise).resolves.toBeUndefined();
    // Two warnings (one per failed attempt) -- the third attempt succeeded
    expect(logger.lines.filter(l => l.startsWith('[warn]'))).toHaveLength(2);
  });

  it('throws ReleaseError listing all failed packages after exhausting retries', async () => {
    jest.useFakeTimers();
    // Always fail for the second package; succeed for the first.
    fetchMock.mockImplementation(((url: string) => {
      const status = url.includes('pkg-bad') ? 500 : 200;
      return Promise.resolve(makeFetchResponse({ status }));
    }) as typeof fetch);

    const promise = pierce({
      ...baseParams,
      packages: { 'pkg-good': '1.0.0', 'pkg-bad': '2.0.0' },
      logger,
    });
    promise.catch(() => undefined); // suppress unhandled rejection while running timers

    await jest.runAllTimersAsync();

    const err = await promise.catch(e => e as unknown);
    expect(err).toBeInstanceOf(ReleaseError);
    expect((err as ReleaseError).message).toContain('Failed to pierce 1 package(s)');
    expect((err as ReleaseError).message).toContain('pkg-bad@2.0.0');
    expect((err as ReleaseError).alreadyLogged).toBe(true);
    // pkg-good (1) + pkg-bad (1 + 5 retries = 6 attempts, since maxRetries=5 means 5 retries)
    expect(fetchMock).toHaveBeenCalledTimes(1 + 6);
    expect(logger.getOutput()).toMatchInlineSnapshot(`
      "[log] Piercing 2 package version(s) into feed myorg/feed-guid
      [log] ✅ pkg-good@1.0.0 (already ingested)
      [warn] ##vso[task.logissue type=warning] Pierce attempt failed (HTTP 500 from https://pkgs.dev.azure.com/myorg/_apis/packaging/feeds/feed-guid/npm/packages/pkg-bad/versions/2.0.0/content); retrying in 1000ms...
      [warn] ##vso[task.logissue type=warning] Pierce attempt failed (HTTP 500 from https://pkgs.dev.azure.com/myorg/_apis/packaging/feeds/feed-guid/npm/packages/pkg-bad/versions/2.0.0/content); retrying in 2000ms...
      [warn] ##vso[task.logissue type=warning] Pierce attempt failed (HTTP 500 from https://pkgs.dev.azure.com/myorg/_apis/packaging/feeds/feed-guid/npm/packages/pkg-bad/versions/2.0.0/content); retrying in 4000ms...
      [warn] ##vso[task.logissue type=warning] Pierce attempt failed (HTTP 500 from https://pkgs.dev.azure.com/myorg/_apis/packaging/feeds/feed-guid/npm/packages/pkg-bad/versions/2.0.0/content); retrying in 8000ms...
      [warn] ##vso[task.logissue type=warning] Pierce attempt failed (HTTP 500 from https://pkgs.dev.azure.com/myorg/_apis/packaging/feeds/feed-guid/npm/packages/pkg-bad/versions/2.0.0/content); retrying in 16000ms...
      [error] ##vso[task.logissue type=error] Failed to pierce pkg-bad@2.0.0: HTTP 500 from https://pkgs.dev.azure.com/myorg/_apis/packaging/feeds/feed-guid/npm/packages/pkg-bad/versions/2.0.0/content"
    `);
  });
});

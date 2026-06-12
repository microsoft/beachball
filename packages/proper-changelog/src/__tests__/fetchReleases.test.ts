import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { fetchReleases } from '../fetchReleases.ts';
import { makeRelease } from '../__fixtures__/makeRelease.ts';

const repo = { owner: 'microsoft', repo: 'some-repo' };

describe('fetchReleases', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn() as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockResponse(body: unknown, init: { link?: string; ok?: boolean; status?: number } = {}): Response {
    const headers = new Headers();
    if (init.link) {
      headers.set('link', init.link);
    }
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      statusText: 'OK',
      headers,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response;
  }

  it('requests the releases endpoint without an Authorization header when no token is given', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce(mockResponse([makeRelease({ tag_name: 'v1.0.0' })]));

    const releases = await fetchReleases(repo);

    expect(releases.map(r => r.tag_name)).toEqual(['v1.0.0']);
    const [url, requestInit] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/microsoft/some-repo/releases?per_page=100');
    const headers = (requestInit as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('sends a bearer token when one is provided', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce(mockResponse([]));

    await fetchReleases(repo, 'secret-token');

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer secret-token');
  });

  it('follows pagination via the Link header', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce(
        mockResponse([makeRelease({ tag_name: 'v2.0.0' })], {
          link: '<https://api.github.com/repos/microsoft/some-repo/releases?per_page=100&page=2>; rel="next"',
        })
      )
      .mockResolvedValueOnce(mockResponse([makeRelease({ tag_name: 'v1.0.0' })]));

    const releases = await fetchReleases(repo);

    expect(releases.map(r => r.tag_name)).toEqual(['v2.0.0', 'v1.0.0']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.github.com/repos/microsoft/some-repo/releases?per_page=100&page=2'
    );
  });

  it('throws a descriptive error on a non-OK response', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce(mockResponse({ message: 'Not Found' }, { ok: false, status: 404 }));

    await expect(fetchReleases(repo)).rejects.toThrow('Failed to fetch releases for microsoft/some-repo: 404');
  });
});

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { _parseGitHubRepo, resolveRepoFromPackage } from '../resolveRepoFromPackage.ts';

describe('_parseGitHubRepo', () => {
  const expected = { owner: 'microsoft', repo: 'beachball' };

  it.each([
    'git+https://github.com/microsoft/beachball.git',
    'https://github.com/microsoft/beachball',
    'https://github.com/microsoft/beachball.git',
    'git://github.com/microsoft/beachball.git',
    'git@github.com:microsoft/beachball.git',
    'github:microsoft/beachball',
    'microsoft/beachball',
    'https://github.com/microsoft/beachball.git#main',
  ])('parses %p', url => {
    expect(_parseGitHubRepo(url, 'beachball')).toEqual(expected);
  });

  it('parses the object form with a url', () => {
    expect(
      _parseGitHubRepo({ type: 'git', url: 'git+https://github.com/microsoft/beachball.git' }, 'beachball')
    ).toEqual(expected);
  });

  it('throws when no repository is specified', () => {
    expect(() => _parseGitHubRepo(undefined, 'beachball')).toThrow(
      'npm package "beachball" does not specify a repository.'
    );
  });

  it.each(['gitlab:owner/repo', 'https://gitlab.com/owner/repo.git', 'https://bitbucket.org/owner/repo.git'])(
    'throws for non-github.com repository %p',
    url => {
      expect(() => _parseGitHubRepo(url, 'pkg')).toThrow(
        `npm package "pkg" repository is "${url}" which does not appear to be on github.com`
      );
    }
  );
});

describe('resolveRepoFromPackage', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn() as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      statusText: init.ok === false ? 'Not Found' : 'OK',
      headers: new Headers(),
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response;
  }

  it('resolves the repository from the latest manifest', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce(
      mockResponse({ repository: { type: 'git', url: 'git+https://github.com/microsoft/beachball.git' } })
    );

    expect(await resolveRepoFromPackage('beachball')).toEqual({ owner: 'microsoft', repo: 'beachball' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://registry.npmjs.org/beachball/latest');
  });

  it('encodes the slash in a scoped package name', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce(mockResponse({ repository: 'github:microsoft/fluentui' }));

    await resolveRepoFromPackage('@fluentui/react');
    expect(fetchMock.mock.calls[0][0]).toBe('https://registry.npmjs.org/@fluentui%2Freact/latest');
  });

  it('throws when the package is not found', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce(mockResponse({}, { ok: false, status: 404 }));

    await expect(resolveRepoFromPackage('does-not-exist')).rejects.toThrow(
      'Failed to look up npm package "does-not-exist": 404'
    );
  });

  it('throws when the package has no repository', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce(mockResponse({ name: 'no-repo' }));

    await expect(resolveRepoFromPackage('no-repo')).rejects.toThrow('does not specify a repository');
  });
});

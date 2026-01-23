// eslint-disable-next-line no-restricted-imports
import { expect, it, afterAll, beforeEach, jest, xdescribe } from '@jest/globals';
// import fetch from 'npm-registry-fetch';
import { _packageContentTypeAccept, getNpmPackageInfo } from '../../packageManager/getNpmPackageInfo';
import { initMockLogs } from '../../__fixtures__/mockLogs';

// TODO re-enable after https://github.com/microsoft/beachball/issues/1143
xdescribe('getNpmPackageInfo', () => {
  const fetchJsonSpy = jest.fn();
  // const fetchJsonSpy = jest.spyOn(fetch, 'json');
  const logs = initMockLogs();
  // These tests mostly get known packages from the public npm registry.
  // There's a tiny chance it could fail if the registry is down, but beachball's developer traffic
  // is low enough that it doesn't really matter.
  const registry = 'https://registry.npmjs.org/';
  /** In the unlikely event that somebody publishes this package, it can be changed to different nonsense */
  const shouldNotExist = 'asdfsdfsadfsafsafdsafsdfsdafsfsdfsdafsadfsdfsdfasdfsaf';

  beforeEach(() => {
    fetchJsonSpy.mockClear();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it.each<{ desc: string; name: string; knownVersion: string }>([
    { desc: 'unscoped', name: 'beachball', knownVersion: '2.60.1' },
    { desc: 'scoped', name: '@lage-run/cli', knownVersion: '0.33.0' },
  ])('gets info for $desc package from public npm registry', async ({ name, knownVersion }) => {
    const timeout = 10000;
    const result = await getNpmPackageInfo(name, { registry, timeout, path: '' });

    expect(fetchJsonSpy).toHaveBeenCalledTimes(1);
    // Verify args format
    expect(fetchJsonSpy).toHaveBeenCalledWith(`/${encodeURIComponent(name)}`, {
      headers: { accept: _packageContentTypeAccept },
      registry,
      timeout,
    });
    // Verify API return value format (there's no toHaveResolvedWith matcher, so await the return value)
    expect(await fetchJsonSpy.mock.results[0].value).toEqual({
      name,
      modified: expect.any(String),
      versions: expect.objectContaining({
        [knownVersion]: expect.objectContaining({ name, version: knownVersion }),
      }),
      'dist-tags': expect.objectContaining({ latest: expect.any(String) }),
    });

    // Verify processed result
    expect(result).toEqual({
      versions: expect.arrayContaining([knownVersion]),
      'dist-tags': expect.objectContaining({ latest: expect.any(String) }),
    });
  });

  it('returns undefined for nonexistent package', async () => {
    const result = await getNpmPackageInfo(shouldNotExist, { registry, verbose: true, path: '' });
    expect(result).toBeUndefined();

    expect(fetchJsonSpy).toHaveBeenCalledTimes(1);
    // The fetch call rejected with a 404 error
    await expect(fetchJsonSpy.mock.results[0].value).rejects.toThrow('404');

    // There's a warning with verbose logging
    expect(logs.mocks.warn).toHaveBeenCalledTimes(1);
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`Failed to get or parse npm info for ${shouldNotExist}:.*404`))
    );
  });

  it('passes auth args', async () => {
    // Don't care about the result in this case
    await getNpmPackageInfo(shouldNotExist, { registry, token: 'fake', path: '' });

    expect(fetchJsonSpy).toHaveBeenCalledTimes(1);
    expect(fetchJsonSpy).toHaveBeenCalledWith('/' + shouldNotExist, {
      registry,
      headers: { accept: _packageContentTypeAccept },
      alwaysAuth: true,
      '//registry.npmjs.org/:_authToken': 'fake',
    });
    // No warning since verbose wasn't enabled
    expect(logs.mocks.warn).not.toHaveBeenCalled();
  });
});

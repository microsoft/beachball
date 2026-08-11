import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { initMockLogs } from '@microsoft/beachball-test-utilities';
import { env } from '../../env';
import { getNpmPackageInfo } from '../../packageManager/getNpmPackageInfo';

// These tests mostly get known packages from the public npm registry. There's a tiny chance it
// could fail if the registry is down, but it's not a big concern with low development traffic.
// (They fail on the ADO release build due to network restrictions.)
// TODO: use the configured registry from the machine
// eslint-disable-next-line no-restricted-properties
const maybeDescribe = env.isBeachballAdoRelease ? describe.skip : describe;

maybeDescribe('getNpmPackageInfo (real registry)', () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');
  const logs = initMockLogs();
  const registry = 'https://registry.npmjs.org/';
  /** In the unlikely event that somebody publishes this package, it can be changed to different nonsense */
  const shouldNotExist = 'asdfsdfsadfsafsafdsafsdfsdafsfsdfsdafsadfsdfsdfasdfsaf';

  beforeEach(() => {
    fetchSpy.mockClear();
  });

  it.each([
    { desc: 'unscoped version', name: 'beachball', versionOrTag: '2.60.1', expectedVersion: '2.60.1' },
    { desc: 'unscoped tag', name: 'beachball', versionOrTag: 'latest', expectedVersion: expect.any(String) },
    { desc: 'scoped version', name: '@lage-run/cli', versionOrTag: '0.33.0', expectedVersion: '0.33.0' },
  ])('gets info for package with $desc', async ({ name, versionOrTag, expectedVersion }) => {
    const result = await getNpmPackageInfo(name, versionOrTag, { registry, timeout: 10000, path: '' });

    expect(result).toEqual({ name, version: expectedVersion });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toEqual(
      new URL(`${registry}${encodeURIComponent(name)}/${encodeURIComponent(versionOrTag)}`)
    );
  });

  it('returns undefined for nonexistent package', async () => {
    const result = await getNpmPackageInfo(shouldNotExist, '1.0.0', { registry, verbose: true, path: '' });
    expect(result).toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await expect(fetchSpy.mock.results[0].value).resolves.toMatchObject({ status: 404 });
    expect(logs.mocks.warn).not.toHaveBeenCalled();
  });
});

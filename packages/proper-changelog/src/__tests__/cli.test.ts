import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { makeRelease } from '../__fixtures__/makeRelease.ts';
import type * as fetchReleasesModule from '../fetchReleases.ts';
import { getContext } from '../__fixtures__/getContext.ts';

jest.unstable_mockModule<typeof fetchReleasesModule>('../fetchReleases.ts', () => ({
  fetchReleases: jest.fn(() => Promise.resolve([])),
}));
const mockFetchReleases = (await import('../fetchReleases.ts')).fetchReleases as jest.MockedFunction<
  typeof fetchReleasesModule.fetchReleases
>;

const { _generateChangelog } = await import('../cli.ts');

describe('cli _generateChangelog', () => {
  const repo = { owner: 'microsoft', repo: 'beachball' };

  afterEach(() => {
    mockFetchReleases.mockResolvedValue([]);
  });

  it('warns and writes nothing when there are no releases', async () => {
    mockFetchReleases.mockResolvedValue([]);
    const context = getContext([]);
    await _generateChangelog({ repo }, context);

    expect(mockFetchReleases).toHaveBeenCalledWith(repo, undefined);
    expect(context.warn).toHaveBeenCalledWith('No releases found for microsoft/beachball');
    expect(context.writeFile).not.toHaveBeenCalled();
    expect(context.log).not.toHaveBeenCalled();
  });

  it('writes to the default CHANGELOG-<repo>.md file and logs the path', async () => {
    mockFetchReleases.mockResolvedValue([makeRelease({ tag_name: 'v1.0.0' })]);
    const context = getContext([]);
    await _generateChangelog({ repo }, context);

    expect(context.writeFile).toHaveBeenCalledWith(
      'CHANGELOG-beachball.md',
      expect.stringContaining('# Changelog - beachball')
    );
    expect(context.log).toHaveBeenCalledWith('Wrote changelog to CHANGELOG-beachball.md');
  });

  it('derives the default file name from the package name when given', async () => {
    mockFetchReleases.mockResolvedValue([makeRelease({ tag_name: 'v1.0.0' })]);
    const context = getContext([]);
    await _generateChangelog({ repo, package: '@fluentui/react' }, context);

    expect(context.writeFile).toHaveBeenCalledWith(
      'CHANGELOG-fluentui-react.md',
      expect.stringContaining('# Changelog -')
    );
    expect(context.log).toHaveBeenCalledWith('Wrote changelog to CHANGELOG-fluentui-react.md');
  });

  it('writes to a custom file name when --out is given', async () => {
    mockFetchReleases.mockResolvedValue([makeRelease({ tag_name: 'v1.0.0' })]);
    const context = getContext([]);
    await _generateChangelog({ repo, out: 'CUSTOM.md' }, context);

    expect(context.writeFile).toHaveBeenCalledWith('CUSTOM.md', expect.stringContaining('# Changelog -'));
    expect(context.log).toHaveBeenCalledWith('Wrote changelog to CUSTOM.md');
  });

  it('writes to stdout instead of a file when stdout is set', async () => {
    mockFetchReleases.mockResolvedValue([makeRelease({ tag_name: 'v1.0.0' })]);
    const context = getContext([]);
    await _generateChangelog({ repo, stdout: true }, context);

    expect(context.writeFile).not.toHaveBeenCalled();
    expect(context.log).toHaveBeenCalledWith(expect.stringContaining('# Changelog -'));
  });

  it('passes the token to fetchReleases', async () => {
    mockFetchReleases.mockResolvedValue([makeRelease({ tag_name: 'v1.0.0' })]);
    const context = getContext([]);
    await _generateChangelog({ repo, token: 'secret-token' }, context);

    expect(mockFetchReleases).toHaveBeenCalledWith(repo, 'secret-token');
  });
});

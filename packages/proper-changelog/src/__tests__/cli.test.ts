import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { makeRelease } from '../__fixtures__/makeRelease.ts';
import type { CliContext } from '../cli.ts';
import type * as fetchReleasesModule from '../fetchReleases.ts';
import type * as resolveRepoModule from '../resolveRepoFromPackage.ts';

jest.unstable_mockModule<typeof fetchReleasesModule>('../fetchReleases.ts', () => ({
  fetchReleases: jest.fn(() => Promise.resolve([])),
}));
const mockFetchReleases = (await import('../fetchReleases.ts')).fetchReleases as jest.MockedFunction<
  typeof fetchReleasesModule.fetchReleases
>;

jest.unstable_mockModule('../resolveRepoFromPackage.ts', () => ({
  resolveRepoFromPackage: jest.fn<typeof resolveRepoModule.resolveRepoFromPackage>(packageName =>
    Promise.resolve({ owner: 'microsoft', repo: packageName.replace(/^.*?\//, '') })
  ),
}));
const mockResolveRepoFromPackage = (await import('../resolveRepoFromPackage.ts'))
  .resolveRepoFromPackage as jest.MockedFunction<typeof resolveRepoModule.resolveRepoFromPackage>;

// Mock nano-spawn which is used for `gh auth token`
let mockGhAuthToken = '';
jest.unstable_mockModule('nano-spawn', () => ({ default: () => Promise.resolve({ stdout: mockGhAuthToken }) }));

const { _parseArgs, _generateChangelog } = await import('../cli.ts');

/** Get a context which mocks all functions and throws on `exitOverride` */
function getContext(args: string[], env: NodeJS.ProcessEnv = {}) {
  return jest.mocked<Required<CliContext>>({
    argv: ['node', 'proper-changelog.js', ...args],
    env,
    log: jest.fn(),
    warn: jest.fn(),
    writeFile: jest.fn(),
    writeErr: jest.fn(),
    exitOverride: err => {
      throw err;
    },
  });
}

afterEach(() => {
  mockGhAuthToken = '';
  mockFetchReleases.mockResolvedValue([]);
});

describe('_parseArgs', () => {
  it('parses --repo into a RepoId and applies defaults', async () => {
    const context = getContext(['--repo', 'microsoft/some-repo']);
    const opts = await _parseArgs(context);
    expect(opts).toEqual({ repo: { owner: 'microsoft', repo: 'some-repo' } });
    // no token, so a warning is logged
    expect(context.warn).toHaveBeenCalledWith(expect.stringContaining('no GitHub token found'));
  });

  it('parses all options', async () => {
    const context = getContext(
      [
        '--repo',
        'microsoft/some-repo',
        '--out',
        'changes.md',
        '--token',
        't',
        '--include-prereleases',
        '--from',
        'v2.0.0',
        '--to',
        'v1.0.0',
        '--limit',
        '5',
        '--filter',
        '/^v2\\./',
        '--since',
        '2024-01-01',
      ],
      { GITHUB_TOKEN: 'env-token' } // not used due to --token
    );
    expect(await _parseArgs(context)).toEqual({
      repo: { owner: 'microsoft', repo: 'some-repo' },
      out: 'changes.md',
      token: 't',
      includePrereleases: true,
      from: 'v2.0.0',
      to: 'v1.0.0',
      limit: 5,
      filter: '/^v2\\./',
      since: new Date('2024-01-01'),
    });
  });

  it('parses and fetches --package', async () => {
    const context = getContext(['--package', '@scope/pkg']);
    const opts = await _parseArgs(context);
    // per the resolve mock
    expect(opts).toEqual({ repo: { owner: 'microsoft', repo: 'pkg' }, package: '@scope/pkg' });
    expect(await mockResolveRepoFromPackage.mock.results[0].value).toEqual({ owner: 'microsoft', repo: 'pkg' });
  });

  it('gets the token from the environment', async () => {
    const context = getContext(['--repo', 'microsoft/some-repo'], { GITHUB_TOKEN: 'token' });
    const opts = await _parseArgs(context);
    expect(opts.token).toBe('token');
  });

  it('gets the token from `gh auth token` as fallack', async () => {
    mockGhAuthToken = 'gh-token';
    const context = getContext(['--repo', 'microsoft/some-repo']);
    const opts = await _parseArgs(context);
    expect(opts.token).toBe('gh-token');
  });

  it.each(['beachball', 'a/b/c', 'owner/', '/repo', 'owner repo'])('rejects invalid --repo %p', async input => {
    const context = getContext(['--repo', input]);
    // this message comes from commander but will contain the invalid input
    await expect(_parseArgs(context)).rejects.toThrow(input);
  });

  it('rejects a non-integer --limit', async () => {
    const context = getContext(['--repo', 'microsoft/some-repo', '--limit', 'abc']);
    await expect(_parseArgs(context)).rejects.toThrow('Expected a positive integer but got "abc"');
  });

  it('rejects an invalid --since date', async () => {
    const context = getContext(['--repo', 'microsoft/some-repo', '--since', 'nope']);
    await expect(_parseArgs(context)).rejects.toThrow('Expected a date but got "nope"');
  });

  it('rejects using --out and --stdout together', async () => {
    const context = getContext(['--repo', 'microsoft/some-repo', '--out', 'x.md', '--stdout']);
    await expect(_parseArgs(context)).rejects.toThrow(/--out.*?--stdout/);
  });

  it('rejects using --repo and --package together', async () => {
    const context = getContext(['--repo', 'microsoft/some-repo', '--package', 'pkg']);
    await expect(_parseArgs(context)).rejects.toThrow(/--repo.*?--package/);
  });
});

describe('_generateChangelog', () => {
  const repo = { owner: 'microsoft', repo: 'beachball' };

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

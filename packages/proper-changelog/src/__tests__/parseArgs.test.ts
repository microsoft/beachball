import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type * as resolveRepoModule from '../resolveRepoFromPackage.ts';
import { getContext } from '../__fixtures__/getContext.ts';

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

const { parseArgs } = await import('../parseArgs.ts');

describe('parseArgs', () => {
  afterEach(() => {
    mockGhAuthToken = '';
  });

  it('parses --repo into a RepoId and applies defaults', async () => {
    const context = getContext(['--repo', 'microsoft/some-repo']);
    const opts = await parseArgs(context);
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
    expect(await parseArgs(context)).toEqual({
      repo: { owner: 'microsoft', repo: 'some-repo' },
      out: 'changes.md',
      token: 't',
      includePrereleases: true,
      from: 'v2.0.0',
      to: 'v1.0.0',
      limit: 5,
      filter: /^v2\./,
      since: new Date('2024-01-01'),
    });
  });

  it('parses and fetches --package', async () => {
    const context = getContext(['--package', '@scope/pkg']);
    const opts = await parseArgs(context);
    // per the resolve mock
    expect(opts).toEqual({ repo: { owner: 'microsoft', repo: 'pkg' }, package: '@scope/pkg' });
    expect(await mockResolveRepoFromPackage.mock.results[0].value).toEqual({ owner: 'microsoft', repo: 'pkg' });
  });

  it('gets the token from the environment', async () => {
    const context = getContext(['--repo', 'microsoft/some-repo'], { GITHUB_TOKEN: 'token' });
    const opts = await parseArgs(context);
    expect(opts.token).toBe('token');
  });

  it('gets the token from `gh auth token` as fallback', async () => {
    mockGhAuthToken = 'gh-token';
    const context = getContext(['--repo', 'microsoft/some-repo']);
    const opts = await parseArgs(context);
    expect(opts.token).toBe('gh-token');
  });

  it.each(['beachball', 'a/b/c', 'owner/', '/repo', 'owner repo'])('rejects invalid --repo %p', async input => {
    const context = getContext(['--repo', input]);
    // this message comes from commander but will contain the invalid input
    await expect(parseArgs(context)).rejects.toThrow(input);
  });

  it('rejects a non-integer --limit', async () => {
    const context = getContext(['--repo', 'microsoft/some-repo', '--limit', 'abc']);
    await expect(parseArgs(context)).rejects.toThrow('Expected a positive integer but got "abc"');
  });

  it('rejects an invalid --since date', async () => {
    const context = getContext(['--repo', 'microsoft/some-repo', '--since', 'nope']);
    await expect(parseArgs(context)).rejects.toThrow('Expected a date but got "nope"');
  });

  it('keeps a plain --filter as a string', async () => {
    const context = getContext(['--repo', 'microsoft/some-repo', '--filter', 'v2']);
    const opts = await parseArgs(context);
    expect(opts.filter).toBe('v2');
  });

  it('converts a slash-wrapped --filter into a RegExp', async () => {
    const context = getContext(['--repo', 'microsoft/some-repo', '--filter', '/^v2\\./i']);
    const opts = await parseArgs(context);
    expect(opts.filter).toEqual(/^v2\./i);
  });

  it('rejects an invalid --filter regex', async () => {
    const context = getContext(['--repo', 'microsoft/some-repo', '--filter', '/[/']);
    await expect(parseArgs(context)).rejects.toThrow('Invalid regular expression "/[/"');
  });

  it('rejects using --out and --stdout together', async () => {
    const context = getContext(['--repo', 'microsoft/some-repo', '--out', 'x.md', '--stdout']);
    await expect(parseArgs(context)).rejects.toThrow(/--out.*?--stdout/);
  });

  it('rejects using --repo and --package together', async () => {
    const context = getContext(['--repo', 'microsoft/some-repo', '--package', 'pkg']);
    await expect(parseArgs(context)).rejects.toThrow(/--repo.*?--package/);
  });
});

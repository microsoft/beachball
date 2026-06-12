import { describe, it, expect } from '@jest/globals';
import { createProgram, defaultBaseName, parseRepo, run } from '../cli.ts';

describe('parseRepo', () => {
  it('parses an owner/repo string', () => {
    expect(parseRepo('microsoft/beachball')).toEqual({ owner: 'microsoft', repo: 'beachball' });
  });

  it.each(['beachball', 'a/b/c', 'owner/', '/repo', 'owner repo'])('rejects invalid input %p', input => {
    expect(() => parseRepo(input)).toThrow();
  });
});

describe('createProgram', () => {
  function parse(args: string[]): Record<string, unknown> {
    const program = createProgram().exitOverride();
    program.parse(args, { from: 'user' });
    return program.opts();
  }

  it('parses --repo into a RepoId and applies defaults', () => {
    const opts = parse(['--repo', 'microsoft/some-repo']);
    expect(opts.repo).toEqual({ owner: 'microsoft', repo: 'some-repo' });
    expect(opts.includePrereleases).toBeUndefined();
  });

  it('parses all options', () => {
    const opts = parse([
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
    ]);
    expect(opts).toMatchObject({
      repo: { owner: 'microsoft', repo: 'some-repo' },
      out: 'changes.md',
      token: 't',
      includePrereleases: true,
      from: 'v2.0.0',
      to: 'v1.0.0',
      limit: 5,
    });
  });

  it('parses --package', () => {
    const opts = parse(['--package', '@scope/pkg']);
    expect(opts.package).toBe('@scope/pkg');
    expect(opts.repo).toBeUndefined();
  });

  it('rejects a non-integer --limit', () => {
    expect(() => parse(['--repo', 'microsoft/some-repo', '--limit', 'abc'])).toThrow(
      'Expected a non-negative integer but got "abc"'
    );
  });

  it('rejects using --out and --stdout together', () => {
    expect(() => parse(['--repo', 'microsoft/some-repo', '--out', 'x.md', '--stdout'])).toThrow(/--out.*?--stdout/);
  });

  it('rejects using --repo and --package together', () => {
    expect(() => parse(['--repo', 'microsoft/some-repo', '--package', 'pkg'])).toThrow(/--repo.*?--package/);
  });
});

describe('defaultBaseName', () => {
  const repo = { owner: 'microsoft', repo: 'beachball' };

  it('uses the repo name when no package is given', () => {
    expect(defaultBaseName(undefined, repo)).toBe('beachball');
  });

  it('uses the package name when given', () => {
    expect(defaultBaseName('lodash', repo)).toBe('lodash');
  });

  it('sanitizes a scoped package name into a safe filename', () => {
    expect(defaultBaseName('@fluentui/react', repo)).toBe('fluentui-react');
  });
});

describe('run', () => {
  it('throws when neither --repo nor --package is provided', async () => {
    await expect(run({}, { log() {}, warn() {}, write: () => Promise.resolve() })).rejects.toThrow(
      'Exactly one of --repo or --package is required.'
    );
  });
});

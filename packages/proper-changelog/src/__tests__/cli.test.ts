import { describe, it, expect } from '@jest/globals';
import { createProgram, parseRepo } from '../cli.ts';

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
    const opts = parse(['--repo', 'o/r']);
    expect(opts.repo).toEqual({ owner: 'o', repo: 'r' });
    expect(opts.includePrereleases).toBeUndefined();
  });

  it('parses all options', () => {
    const opts = parse([
      '--repo',
      'o/r',
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
      repo: { owner: 'o', repo: 'r' },
      out: 'changes.md',
      token: 't',
      includePrereleases: true,
      from: 'v2.0.0',
      to: 'v1.0.0',
      limit: 5,
    });
  });

  it('requires --repo', () => {
    expect(() => parse([])).toThrow();
  });

  it('rejects a non-integer --limit', () => {
    expect(() => parse(['--repo', 'o/r', '--limit', 'abc'])).toThrow();
  });

  it('rejects using --out and --stdout together', () => {
    expect(() => parse(['--repo', 'o/r', '--out', 'x.md', '--stdout'])).toThrow();
  });
});

import { describe, it, expect } from '@jest/globals';
import { selectReleases } from '../selectReleases.ts';
import { makeRelease } from '../__fixtures__/makeRelease.ts';
import type { ProperChangelogOptions } from '../types.ts';

const repo = { owner: 'microsoft', repo: 'some-repo' };

function options(overrides: Partial<ProperChangelogOptions> = {}): ProperChangelogOptions {
  return { repo, ...overrides };
}

describe('selectReleases', () => {
  it('always excludes draft releases', () => {
    const releases = [makeRelease({ tag_name: 'v2.0.0' }), makeRelease({ tag_name: 'v1.0.0-draft', draft: true })];
    expect(selectReleases(releases, options()).map(r => r.tag_name)).toEqual(['v2.0.0']);
  });

  it('excludes prereleases by default', () => {
    const releases = [
      makeRelease({ tag_name: 'v2.0.0' }),
      makeRelease({ tag_name: 'v2.0.0-beta.1', prerelease: true }),
    ];
    expect(selectReleases(releases, options()).map(r => r.tag_name)).toEqual(['v2.0.0']);
  });

  it('includes prereleases when includePrereleases is set', () => {
    const releases = [
      makeRelease({ tag_name: 'v2.0.0', published_at: '2024-02-01T00:00:00Z' }),
      makeRelease({ tag_name: 'v2.0.0-beta.1', prerelease: true, published_at: '2024-01-01T00:00:00Z' }),
    ];
    expect(selectReleases(releases, options({ includePrereleases: true })).map(r => r.tag_name)).toEqual([
      'v2.0.0',
      'v2.0.0-beta.1',
    ]);
  });

  it('sorts releases newest-first by published date', () => {
    const releases = [
      makeRelease({ tag_name: 'v1.0.0', published_at: '2024-01-01T00:00:00Z' }),
      makeRelease({ tag_name: 'v3.0.0', published_at: '2024-03-01T00:00:00Z' }),
      makeRelease({ tag_name: 'v2.0.0', published_at: '2024-02-01T00:00:00Z' }),
    ];
    expect(selectReleases(releases, options()).map(r => r.tag_name)).toEqual(['v3.0.0', 'v2.0.0', 'v1.0.0']);
  });

  it('applies the limit after sorting', () => {
    const releases = [
      makeRelease({ tag_name: 'v1.0.0', published_at: '2024-01-01T00:00:00Z' }),
      makeRelease({ tag_name: 'v3.0.0', published_at: '2024-03-01T00:00:00Z' }),
      makeRelease({ tag_name: 'v2.0.0', published_at: '2024-02-01T00:00:00Z' }),
    ];
    expect(selectReleases(releases, options({ limit: 2 })).map(r => r.tag_name)).toEqual(['v3.0.0', 'v2.0.0']);
  });

  it('applies an inclusive from/to tag range regardless of bound order', () => {
    const releases = [
      makeRelease({ tag_name: 'v4.0.0', published_at: '2024-04-01T00:00:00Z' }),
      makeRelease({ tag_name: 'v3.0.0', published_at: '2024-03-01T00:00:00Z' }),
      makeRelease({ tag_name: 'v2.0.0', published_at: '2024-02-01T00:00:00Z' }),
      makeRelease({ tag_name: 'v1.0.0', published_at: '2024-01-01T00:00:00Z' }),
    ];
    expect(selectReleases(releases, options({ from: 'v3.0.0', to: 'v2.0.0' })).map(r => r.tag_name)).toEqual([
      'v3.0.0',
      'v2.0.0',
    ]);
  });

  it('throws a helpful error when a from/to tag is not found', () => {
    const releases = [makeRelease({ tag_name: 'v1.0.0' })];
    expect(() => selectReleases(releases, options({ from: 'v9.9.9' }))).toThrow('No release found with tag "v9.9.9".');
  });
});

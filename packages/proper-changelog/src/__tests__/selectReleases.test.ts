import { describe, it, expect } from '@jest/globals';
import { selectReleases } from '../selectReleases.ts';
import { makeRelease } from '../__fixtures__/makeRelease.ts';

describe('selectReleases', () => {
  it('always excludes draft releases', () => {
    const releases = [makeRelease({ tag_name: 'v2.0.0' }), makeRelease({ tag_name: 'v1.0.0-draft', draft: true })];
    expect(selectReleases(releases, {}).map(r => r.tag_name)).toEqual(['v2.0.0']);
  });

  it('excludes prereleases by default', () => {
    const releases = [
      makeRelease({ tag_name: 'v2.0.0' }),
      makeRelease({ tag_name: 'v2.0.0-beta.1', prerelease: true }),
    ];
    expect(selectReleases(releases, {}).map(r => r.tag_name)).toEqual(['v2.0.0']);
  });

  it('includes prereleases when includePrereleases is set', () => {
    const releases = [
      makeRelease({ tag_name: 'v2.0.0', published_at: '2024-02-01T00:00:00Z' }),
      makeRelease({ tag_name: 'v2.0.0-beta.1', prerelease: true, published_at: '2024-01-01T00:00:00Z' }),
    ];
    expect(selectReleases(releases, { includePrereleases: true }).map(r => r.tag_name)).toEqual([
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
    expect(selectReleases(releases, {}).map(r => r.tag_name)).toEqual(['v3.0.0', 'v2.0.0', 'v1.0.0']);
  });

  it('applies the limit after sorting', () => {
    const releases = [
      makeRelease({ tag_name: 'v1.0.0', published_at: '2024-01-01T00:00:00Z' }),
      makeRelease({ tag_name: 'v3.0.0', published_at: '2024-03-01T00:00:00Z' }),
      makeRelease({ tag_name: 'v2.0.0', published_at: '2024-02-01T00:00:00Z' }),
    ];
    expect(selectReleases(releases, { limit: 2 }).map(r => r.tag_name)).toEqual(['v3.0.0', 'v2.0.0']);
  });

  it('applies an inclusive from/to tag range regardless of bound order', () => {
    const releases = [
      makeRelease({ tag_name: 'v4.0.0', published_at: '2024-04-01T00:00:00Z' }),
      makeRelease({ tag_name: 'v3.0.0', published_at: '2024-03-01T00:00:00Z' }),
      makeRelease({ tag_name: 'v2.0.0', published_at: '2024-02-01T00:00:00Z' }),
      makeRelease({ tag_name: 'v1.0.0', published_at: '2024-01-01T00:00:00Z' }),
    ];
    expect(selectReleases(releases, { from: 'v3.0.0', to: 'v2.0.0' }).map(r => r.tag_name)).toEqual([
      'v3.0.0',
      'v2.0.0',
    ]);
  });

  it('throws a helpful error when a from/to tag is not found', () => {
    const releases = [makeRelease({ tag_name: 'v1.0.0' })];
    expect(() => selectReleases(releases, { from: 'v9.9.9' })).toThrow('No release found with tag "v9.9.9".');
  });

  it('filters by a case-insensitive substring of the tag', () => {
    const releases = [
      makeRelease({ tag_name: 'app_v2.0.0', published_at: '2024-02-01T00:00:00Z' }),
      makeRelease({ tag_name: 'lib_v1.0.0', published_at: '2024-01-01T00:00:00Z' }),
    ];
    expect(selectReleases(releases, { filter: 'APP' }).map(r => r.tag_name)).toEqual(['app_v2.0.0']);
  });

  it('filters by a /regex/ when the value is wrapped in slashes', () => {
    const releases = [
      makeRelease({ tag_name: 'v2.1.0', published_at: '2024-03-01T00:00:00Z' }),
      makeRelease({ tag_name: 'v2.0.0', published_at: '2024-02-01T00:00:00Z' }),
      makeRelease({ tag_name: 'v1.0.0', published_at: '2024-01-01T00:00:00Z' }),
    ];
    expect(selectReleases(releases, { filter: '/^v2\\./' }).map(r => r.tag_name)).toEqual(['v2.1.0', 'v2.0.0']);
  });

  it('supports regex flags such as case-insensitivity', () => {
    const releases = [
      makeRelease({ tag_name: 'Release-A', published_at: '2024-02-01T00:00:00Z' }),
      makeRelease({ tag_name: 'release-b', published_at: '2024-01-01T00:00:00Z' }),
    ];
    expect(selectReleases(releases, { filter: '/^release-/i' }).map(r => r.tag_name)).toEqual([
      'Release-A',
      'release-b',
    ]);
  });

  it('throws a helpful error for an invalid /regex/ filter', () => {
    const releases = [makeRelease({ tag_name: 'v1.0.0' })];
    expect(() => selectReleases(releases, { filter: '/[/' })).toThrow(/Invalid --filter regular expression/);
  });

  it('includes only releases published after the --since date', () => {
    const releases = [
      makeRelease({ tag_name: 'v3.0.0', published_at: '2024-03-01T00:00:00Z' }),
      makeRelease({ tag_name: 'v2.0.0', published_at: '2024-02-01T00:00:00Z' }),
      makeRelease({ tag_name: 'v1.0.0', published_at: '2024-01-01T00:00:00Z' }),
    ];
    expect(selectReleases(releases, { since: new Date('2024-02-01') }).map(r => r.tag_name)).toEqual(['v3.0.0']);
  });
});

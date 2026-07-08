import { describe, it, expect } from '@jest/globals';
import { parsePermissions, parseRepository, splitList } from '../../githubAuth/validationHelpers';

describe('parseRepository', () => {
  it('parses owner/repo format', () => {
    const result = parseRepository('my-org/my-repo');
    expect(result.owner).toBe('my-org');
    expect(result.name).toBe('my-repo');
  });

  it('rejects a bare repo name', () => {
    expect(() => parseRepository('my-repo')).toThrow(/Invalid repository/);
  });

  it('rejects an empty owner', () => {
    expect(() => parseRepository('/my-repo')).toThrow(/Invalid repository/);
  });

  it('rejects an empty name', () => {
    expect(() => parseRepository('my-org/')).toThrow(/Invalid repository/);
  });

  it('rejects too many segments', () => {
    expect(() => parseRepository('a/b/c')).toThrow(/Invalid repository/);
  });
});

describe('splitList', () => {
  it('handles comma-separated', () => {
    expect(splitList('repo-a, repo-b, repo-c')).toEqual(['repo-a', 'repo-b', 'repo-c']);
  });

  it('handles newline-separated', () => {
    expect(splitList('repo-a\nrepo-b\nrepo-c')).toEqual(['repo-a', 'repo-b', 'repo-c']);
  });

  it('handles arrays', () => {
    expect(splitList(['repo-a', 'repo-b'])).toEqual(['repo-a', 'repo-b']);
  });

  it('returns empty for undefined', () => {
    expect(splitList(undefined)).toEqual([]);
  });
});

describe('parsePermissions', () => {
  it('returns undefined for empty input', () => {
    expect(parsePermissions(undefined)).toBeUndefined();
    expect(parsePermissions('')).toBeUndefined();
  });

  it('parses comma- and newline-separated entries', () => {
    expect(parsePermissions('contents:read, issues:write\npull_requests:admin')).toEqual({
      contents: 'read',
      issues: 'write',
      pull_requests: 'admin',
    });
  });

  it('requires an explicit level', () => {
    expect(() => parsePermissions('contents')).toThrow(/must include an explicit level/);
  });

  it('requires a permission name', () => {
    expect(() => parsePermissions(':read')).toThrow(/must include a permission name/);
  });

  it('rejects an invalid permission name', () => {
    expect(() => parsePermissions('bad name!:read')).toThrow(/Invalid permission name/);
  });

  it('rejects an invalid permission level', () => {
    expect(() => parsePermissions('contents:bogus')).toThrow(/Invalid permission level/);
  });

  it('rejects duplicate permissions', () => {
    expect(() => parsePermissions('contents:read, contents:write')).toThrow(/Duplicate permission/);
  });
});

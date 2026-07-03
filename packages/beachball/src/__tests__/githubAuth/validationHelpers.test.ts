import { describe, it, expect } from '@jest/globals';
import {
  normalizeRepositoryTarget,
  parsePermissions,
  parseRepositoryInput,
  splitList,
  validatePermissions,
} from '../../githubAuth/validationHelpers';

describe('normalizeRepositoryTarget', () => {
  it('uses explicit owner', () => {
    const result = normalizeRepositoryTarget('my-org', ['repo-a']);
    expect(result.owner).toBe('my-org');
    expect(result.repositories).toEqual(['repo-a']);
  });

  it('infers owner from owner/repo entry', () => {
    const result = normalizeRepositoryTarget(undefined, ['inferred-org/repo-a']);
    expect(result.owner).toBe('inferred-org');
    expect(result.repositories).toEqual(['repo-a']);
  });

  it('infers owner from multiple owner/repo entries with the same owner', () => {
    const result = normalizeRepositoryTarget(undefined, ['my-org/repo-a', 'my-org/repo-b']);
    expect(result.owner).toBe('my-org');
    expect(result.repositories).toEqual(['repo-a', 'repo-b']);
  });

  it('applies an inferred owner to bare repo entries', () => {
    const result = normalizeRepositoryTarget(undefined, ['my-org/repo-a', 'repo-b']);
    expect(result.owner).toBe('my-org');
    expect(result.repositories).toEqual(['repo-a', 'repo-b']);
  });

  it('infers owner case-insensitively across entries', () => {
    const result = normalizeRepositoryTarget(undefined, ['my-org/repo-a', 'My-Org/repo-b']);
    expect(result.owner).toBe('my-org');
    expect(result.repositories).toEqual(['repo-a', 'repo-b']);
  });

  it('rejects owner mismatch', () => {
    expect(() => normalizeRepositoryTarget('org-a', ['org-b/repo'])).toThrow(/does not match/);
  });

  it('rejects mismatched owners across entries', () => {
    expect(() => normalizeRepositoryTarget(undefined, ['org-a/repo-a', 'org-b/repo-b'])).toThrow(/does not match/);
  });

  it('rejects missing owner entirely', () => {
    expect(() => normalizeRepositoryTarget(undefined, ['repo'])).toThrow(/owner is required/);
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

describe('parseRepositoryInput', () => {
  it('parses bare repo name', () => {
    const result = parseRepositoryInput('my-repo');
    expect(result.name).toBe('my-repo');
    expect(result.owner).toBeUndefined();
  });

  it('parses owner/repo format', () => {
    const result = parseRepositoryInput('my-org/my-repo');
    expect(result.owner).toBe('my-org');
    expect(result.name).toBe('my-repo');
  });

  it('rejects invalid format', () => {
    expect(() => parseRepositoryInput('a/b/c')).toThrow(/Invalid repository/);
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

describe('validatePermissions', () => {
  it('returns undefined for undefined or empty input', () => {
    expect(validatePermissions(undefined)).toBeUndefined();
    expect(validatePermissions({})).toBeUndefined();
  });

  it('returns validated permissions', () => {
    expect(validatePermissions({ contents: 'read', issues: 'write' })).toEqual({
      contents: 'read',
      issues: 'write',
    });
  });

  it('rejects a non-object value', () => {
    expect(() => validatePermissions('contents:read')).toThrow(/permissions must be an object/);
  });

  it('rejects an invalid permission name', () => {
    expect(() => validatePermissions({ 'bad name!': 'read' })).toThrow(/Invalid permission name/);
  });

  it('rejects an invalid permission level', () => {
    expect(() => validatePermissions({ contents: 'bogus' })).toThrow(/Invalid permission level/);
  });
});

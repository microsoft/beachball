import { describe, it, expect } from '@jest/globals';
import { parsePermissions } from '../../authHelper/validationHelpers';

describe('parsePermissions', () => {
  it('returns undefined for empty input', () => {
    expect(parsePermissions('')).toBeUndefined();
  });

  it('parses a single entry', () => {
    expect(parsePermissions('contents:read')).toEqual({ contents: 'read' });
  });

  it('parses single entry with spaces', () => {
    expect(parsePermissions('  contents:  read  ')).toEqual({ contents: 'read' });
  });

  it('parses comma-separated entries', () => {
    // works with or without spaces
    expect(parsePermissions('contents:read, issues:write,pull_requests:admin')).toEqual({
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

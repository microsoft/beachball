import { describe, expect, it } from '@jest/globals';
import type { Catalogs } from 'workspace-tools';
import { diffCatalogs } from '../../monorepo/diffCatalogs';

describe('diffCatalogs', () => {
  it('returns undefined for identical catalogs', () => {
    const catalogs: Catalogs = {
      default: { foo: '^1.0.0', bar: '^2.0.0' },
      named: { test: { jest: '^29.0.0' } },
    };
    expect(diffCatalogs({ before: catalogs, after: catalogs })).toBeUndefined();
  });

  it('returns undefined for empty catalogs', () => {
    expect(diffCatalogs({ before: {}, after: {} })).toBeUndefined();
  });

  it('returns added entries in the default catalog', () => {
    const result = diffCatalogs({
      before: { default: { foo: '^1.0.0' } },
      after: { default: { foo: '^1.0.0', bar: '^2.0.0' } },
    });
    expect(result).toEqual({ default: { bar: '^2.0.0' } });
  });

  it('returns changed entries in the default catalog', () => {
    const result = diffCatalogs({
      before: { default: { foo: '^1.0.0', bar: '^2.0.0' } },
      after: { default: { foo: '^1.1.0', bar: '^2.0.0' } },
    });
    expect(result).toEqual({ default: { foo: '^1.1.0' } });
  });

  it('excludes removed entries in the default catalog', () => {
    const result = diffCatalogs({
      before: { default: { foo: '^1.0.0', bar: '^2.0.0' } },
      after: { default: { foo: '^1.0.0' } },
    });
    expect(result).toBeUndefined();
  });

  it('returns only added and changed entries when entries are also removed', () => {
    const result = diffCatalogs({
      before: { default: { foo: '^1.0.0', bar: '^2.0.0', baz: '^3.0.0' } },
      after: { default: { foo: '^1.1.0', baz: '^3.0.0', qux: '^4.0.0' } },
    });
    expect(result).toEqual({ default: { foo: '^1.1.0', qux: '^4.0.0' } });
  });

  it('returns all entries when default catalog is brand new', () => {
    const result = diffCatalogs({
      before: {},
      after: { default: { foo: '^1.0.0', bar: '^2.0.0' } },
    });
    expect(result).toEqual({ default: { foo: '^1.0.0', bar: '^2.0.0' } });
  });

  it('excludes a removed default catalog', () => {
    const result = diffCatalogs({
      before: { default: { foo: '^1.0.0' } },
      after: {},
    });
    expect(result).toBeUndefined();
  });

  it('returns added named catalogs', () => {
    const result = diffCatalogs({
      before: { named: { react17: { react: '^17.0.0' } } },
      after: {
        named: {
          react17: { react: '^17.0.0' },
          react18: { react: '^18.0.0' },
        },
      },
    });
    expect(result).toEqual({ named: { react18: { react: '^18.0.0' } } });
  });

  it('returns changed entries within a named catalog', () => {
    const result = diffCatalogs({
      before: { named: { test: { jest: '^29.0.0', mocha: '^10.0.0' } } },
      after: { named: { test: { jest: '^29.5.0', mocha: '^10.0.0' } } },
    });
    expect(result).toEqual({ named: { test: { jest: '^29.5.0' } } });
  });

  it('excludes a removed named catalog', () => {
    const result = diffCatalogs({
      before: { named: { old: { foo: '^1.0.0' } } },
      after: {},
    });
    expect(result).toBeUndefined();
  });

  it('excludes removed entries within a named catalog', () => {
    const result = diffCatalogs({
      before: { named: { test: { jest: '^29.0.0', mocha: '^10.0.0' } } },
      after: { named: { test: { jest: '^29.0.0' } } },
    });
    expect(result).toBeUndefined();
  });

  it('returns combined diffs across default and named catalogs', () => {
    const result = diffCatalogs({
      before: { default: { foo: '^1.0.0' }, named: { test: { jest: '^29.0.0' } } },
      after: { default: { foo: '^1.1.0' }, named: { test: { jest: '^29.5.0' } } },
    });
    expect(result).toEqual({
      default: { foo: '^1.1.0' },
      named: { test: { jest: '^29.5.0' } },
    });
  });

  it('returns only the changed catalog when default changes but named is unchanged', () => {
    const result = diffCatalogs({
      before: {
        default: { foo: '^1.0.0' },
        named: { test: { jest: '^29.0.0' } },
      },
      after: {
        default: { foo: '^1.1.0' },
        named: { test: { jest: '^29.0.0' } },
      },
    });
    expect(result).toEqual({ default: { foo: '^1.1.0' } });
  });

  it('returns only the changed named catalog when there are multiple named catalogs', () => {
    const result = diffCatalogs({
      before: { named: { react17: { react: '^17.0.0' }, react18: { react: '^18.0.0' } } },
      after: { named: { react17: { react: '^17.0.0' }, react18: { react: '^18.1.0' } } },
    });
    expect(result).toEqual({ named: { react18: { react: '^18.1.0' } } });
  });
});

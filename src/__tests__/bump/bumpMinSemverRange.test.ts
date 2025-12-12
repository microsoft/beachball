import { describe, expect, it } from '@jest/globals';
import { bumpMinSemverRange } from '../../bump/bumpMinSemverRange';

describe('bumpMinSemverRange', () => {
  it('preserves *', () => {
    const result = bumpMinSemverRange('1.0.0', '*');
    expect(result).toBe('*');
  });

  it('preserves file: protocol with relative path', () => {
    const result = bumpMinSemverRange('1.0.0', 'file:../local-package');
    expect(result).toBe('file:../local-package');
  });

  it('preserves file: protocol with absolute path', () => {
    const result = bumpMinSemverRange('1.0.0', 'file:/absolute/path/to/package');
    expect(result).toBe('file:/absolute/path/to/package');
  });

  it('preserves catalog: protocol', () => {
    let result = bumpMinSemverRange('1.0.0', 'catalog:');
    expect(result).toBe('catalog:');
    result = bumpMinSemverRange('1.0.0', 'catalog:foo');
    expect(result).toBe('catalog:foo');
  });

  it.each(['~', '^'])('preserves %s and bumps to new version', prefix => {
    const result = bumpMinSemverRange('1.3.0', `${prefix}1.2.0`);
    expect(result).toBe(`${prefix}1.3.0`);
  });

  it('returns range from new version to next major with >=', () => {
    const result = bumpMinSemverRange('1.3.0', '>=1.2.0 <2.0.0');
    expect(result).toBe('>=1.3.0 <2.0.0');
  });

  it('returns range from new version to next major with >', () => {
    const result = bumpMinSemverRange('1.3.0', '>1.2.0 <2.0.0');
    expect(result).toBe('>=1.3.0 <2.0.0');
  });

  it('returns range from new version to next major with -', () => {
    const result = bumpMinSemverRange('1.3.0', '1.2.0 - 2.0.0');
    expect(result).toBe('1.3.0 - 2.0.0');
  });

  it.each(['workspace:*', 'workspace:~', 'workspace:^'])('preserves %s', workspaceVersion => {
    const result = bumpMinSemverRange('1.3.0', workspaceVersion);
    expect(result).toBe(workspaceVersion);
  });

  it('bumps workspace:~x.y.z to workspace range with new version', () => {
    const result = bumpMinSemverRange('1.2.1', 'workspace:~1.2.0');
    expect(result).toBe('workspace:~1.2.1');
  });

  it('bumps workspace:^x.y.z to workspace range with new version', () => {
    const result = bumpMinSemverRange('1.3.0', 'workspace:^1.2.0');
    expect(result).toBe('workspace:^1.3.0');
  });

  it('uses the new version for exact version match', () => {
    const result = bumpMinSemverRange('1.3.0', '1.2.0');
    expect(result).toBe('1.3.0');
  });

  it('uses the new version if unknown non-semver format', () => {
    const result = bumpMinSemverRange('1.3.0', '#1.2.0');
    expect(result).toBe('1.3.0');
  });

  it('preserves unrecognized range if new version satisfies it', () => {
    const result = bumpMinSemverRange('1.3.0', '1');
    expect(result).toBe('1');
  });
});

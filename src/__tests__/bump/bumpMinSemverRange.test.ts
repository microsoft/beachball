import { describe, expect, it } from '@jest/globals';
import { bumpMinSemverRange } from '../../bump/bumpMinSemverRange';

describe('bumpMinSemverRange', () => {
  it('bumps * to *', () => {
    const result = bumpMinSemverRange('1.0.0', '*');
    expect(result).toBe('*');
  });

  it('attaches ~ to semver range', () => {
    const result = bumpMinSemverRange('1.3.0', '~1.2.0');
    expect(result).toBe('~1.3.0');
  });

  it('bumps ^ to semver range', () => {
    const result = bumpMinSemverRange('1.3.0', '^1.2.0');
    expect(result).toBe('^1.3.0');
  });

  it('will return the min version if unknown format', () => {
    const result = bumpMinSemverRange('1.3.0', '#1.2.0');
    expect(result).toBe('1.3.0');
  });

  it('will return a minor range generally if a range is specified with >= or >', () => {
    const result = bumpMinSemverRange('1.3.0', '>=1.2.0 <2.0.0');
    expect(result).toBe('>=1.3.0 <2.0.0');
  });

  it('will return a minor range generally if a range is specified with x - y', () => {
    const result = bumpMinSemverRange('1.3.0', '1.2.0 - 2.0.0');
    expect(result).toBe('1.3.0 - 2.0.0');
  });

  it.each(['workspace:*', 'workspace:~', 'workspace:^'])('will preserve %s', workspaceVersion => {
    const result = bumpMinSemverRange('1.3.0', workspaceVersion);
    expect(result).toBe(workspaceVersion);
  });

  it('bumps workspace:~1.2.0 to workspace semver range', () => {
    const result = bumpMinSemverRange('1.2.1', 'workspace:~1.2.0');
    expect(result).toBe('workspace:~1.2.1');
  });

  it('bumps workspace:^1.2.0 to workspace semver range', () => {
    const result = bumpMinSemverRange('1.3.0', 'workspace:^1.2.0');
    expect(result).toBe('workspace:^1.3.0');
  });
});

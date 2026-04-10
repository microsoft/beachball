import { describe, expect, it } from '@jest/globals';
import { getNpmAuthArgs, getNpmPublishArgs } from '../../packageManager/npmArgs';
import type { AuthType } from '../../types/Auth';
import type { NpmOptions } from '../../types/NpmOptions';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

describe('getNpmAuthArgs', () => {
  const registry = 'https://testRegistry';
  const token = 'someToken';

  it('returns undefined with no token regardless of authType', () => {
    expect(getNpmAuthArgs({ registry })).toBeUndefined();
    expect(getNpmAuthArgs({ registry, authType: 'password' })).toBeUndefined();
    expect(getNpmAuthArgs({ registry, authType: 'authtoken' })).toBeUndefined();
  });

  it('ignores empty string as token', () => {
    expect(getNpmAuthArgs({ registry, token: '' })).toBeUndefined();
  });

  it('defaults to _authToken when no authType specified but token is provided', () => {
    expect(getNpmAuthArgs({ registry, token })).toEqual({ key: '//testRegistry:_authToken', value: token });
  });

  it('respects authType: authtoken', () => {
    const result = getNpmAuthArgs({ registry, token, authType: 'authtoken' });
    expect(result).toEqual({ key: '//testRegistry:_authToken', value: token });
  });

  it('respects authType: password', () => {
    const result = getNpmAuthArgs({ registry, token, authType: 'password' });
    expect(result).toEqual({ key: '//testRegistry:_password', value: token });
  });

  it('uses _authToken for invalid authType', () => {
    const result = getNpmAuthArgs({ registry, token, authType: 'invalidvalue' as AuthType });
    expect(result).toEqual({ key: '//testRegistry:_authToken', value: token });
  });
});

describe('getNpmPublishArgs', () => {
  const options: Omit<NpmOptions, 'path'> = { registry: 'https://testRegistry', npmReadConcurrency: 2 };

  const packageInfos = makePackageInfos({
    basic: {},
    tag: { beachball: { tag: 'testTag', defaultNpmTag: 'testDefaultTag' } },
    defaultTag: { beachball: { defaultNpmTag: 'testDefaultTag' } },
    '@scoped/foo': {},
  });

  it('uses latest tag if not specified', () => {
    const args = getNpmPublishArgs(packageInfos.basic, options).join(' ');
    // Test the interesting part separately first, then the whole thing
    expect(args).toMatch('--tag latest');
    expect(args).toEqual('publish --registry https://testRegistry --tag latest --loglevel warn');
  });

  it('uses tag if specified', () => {
    const args = getNpmPublishArgs(packageInfos.tag, options).join(' ');
    expect(args).toMatch('--tag testTag');
  });

  it('uses defaultNpmTag if tag is not specified', () => {
    const args = getNpmPublishArgs(packageInfos.defaultTag, options).join(' ');
    expect(args).toMatch('--tag testDefaultTag');
  });

  it('ignores access for unscoped package', () => {
    let args = getNpmPublishArgs(packageInfos.basic, { ...options, access: 'public' }).join(' ');
    expect(args).not.toMatch('--access public');

    args = getNpmPublishArgs(packageInfos.basic, { ...options, access: 'restricted' }).join(' ');
    expect(args).not.toMatch('--access restricted');
  });

  it('uses specified access for scoped package', () => {
    let args = getNpmPublishArgs(packageInfos['@scoped/foo'], { ...options, access: 'public' }).join(' ');
    expect(args).toMatch('--access public');
    expect(args).toEqual('publish --registry https://testRegistry --tag latest --loglevel warn --access public');

    args = getNpmPublishArgs(packageInfos['@scoped/foo'], { ...options, access: 'restricted' }).join(' ');
    expect(args).toMatch('--access restricted');
  });

  it('does not add access for scoped package if not specified', () => {
    const args = getNpmPublishArgs(packageInfos['@scoped/foo'], options).join(' ');
    expect(args).not.toMatch('--access');
  });

  it('uses auth args if specified', () => {
    const args = getNpmPublishArgs(packageInfos.basic, { ...options, token: 'testToken' }).join(' ');
    expect(args).toMatch('--//testRegistry:_authToken=testToken');
  });
});

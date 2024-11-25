import { describe, expect, it } from '@jest/globals';
import { getNpmAuthArgs, getNpmPublishArgs } from '../../packageManager/npmArgs';
import type { AuthType } from '../../types/Auth';
import type { NpmOptions } from '../../types/NpmOptions';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

describe('getNpmAuthArgs', () => {
  type NpmAuthTest = { token?: string; authType?: AuthType; expected: string };

  const registry = 'https://testRegistry';
  const token = 'someToken';

  it.each<NpmAuthTest>([
    // no token
    { expected: '' },
    // no specified auth type
    { token, expected: '--//testRegistry:_authToken=someToken' },
    // different auth types
    { token, authType: 'authtoken', expected: '--//testRegistry:_authToken=someToken' },
    { token, authType: 'password', expected: '--//testRegistry:_password=someToken' },
    { token, authType: 'invalidvalue' as AuthType, expected: '--//testRegistry:_authToken=someToken' },
  ])('token = $token, authType = $authType', ({ token: tkn, authType, expected }) => {
    expect(getNpmAuthArgs(registry, tkn, authType).join(' ')).toStrictEqual(expected);
  });
});

describe('getNpmPublishArgs', () => {
  const options: Omit<NpmOptions, 'path'> = { registry: 'https://testRegistry' };

  const packageInfos = makePackageInfos({
    basic: {},
    tag: { combinedOptions: { tag: 'testTag', defaultNpmTag: 'testDefaultTag' } },
    defaultTag: { combinedOptions: { defaultNpmTag: 'testDefaultTag' } },
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

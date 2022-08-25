import { describe, expect, it } from '@jest/globals';
import { getNpmAuthArgs } from '../../packageManager/npm';
import { AuthType } from '../../types/Auth';

type NpmAuthTestTuple = [string, string, AuthType | undefined, string];

describe('getNpmAuthArgs', () => {
  it.each<NpmAuthTestTuple>([
    ['https://testRegistry', 'someToken', undefined, '--//testRegistry:_authToken=someToken'],
    ['https://testRegistry', 'someToken', 'invalidvalue' as AuthType, '--//testRegistry:_authToken=someToken'],
    ['https://testRegistry', 'someToken', 'authtoken', '--//testRegistry:_authToken=someToken'],
    ['https://testRegistry', 'someToken', 'password', '--//testRegistry:_password=someToken'],
  ])('registry = %s, token = %s, authType = %s)', (registry, token, authType, expected) => {
    expect(getNpmAuthArgs(registry, token, authType)).toStrictEqual([expected]);
  });
});

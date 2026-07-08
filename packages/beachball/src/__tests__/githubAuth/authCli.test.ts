import { describe, it, expect } from '@jest/globals';
import { getOptions, readEnv } from '../../githubAuth/authCli';

describe('readEnv', () => {
  it('reads options from the provided source', () => {
    const env = readEnv({
      GITHUB_API_URL: 'https://ghe.example.com/api/v3',
      REVOKE_TOKEN: 'ghs_token',
      APP_CLIENT_ID: 'Iv1.client',
      KEY_ID: 'https://vault/keys/key',
      OUTPUT: 'azure',
      AZURE_TOKEN_VARIABLE: 'MY_TOKEN',
      REPOSITORY: 'my-org/repo-a',
      PERMISSIONS: 'contents:read',
    });

    expect(env).toEqual({
      githubApiUrl: 'https://ghe.example.com/api/v3',
      revokeToken: 'ghs_token',
      appClientId: 'Iv1.client',
      keyId: 'https://vault/keys/key',
      output: 'azure',
      azureTokenVariable: 'MY_TOKEN',
      repository: 'my-org/repo-a',
      permissions: 'contents:read',
    });
  });

  it('applies defaults for missing values', () => {
    const env = readEnv({});
    expect(env.githubApiUrl).toBe('https://api.github.com');
    expect(env.output).toBe('stdout');
    expect(env.repository).toBeUndefined();
  });
});

describe('getOptions', () => {
  const base = { APP_CLIENT_ID: 'Iv1.client', KEY_ID: 'key-id', REPOSITORY: 'org/repo' };

  it('defaults to stdout output with no token variable', () => {
    const result = getOptions(readEnv(base));
    expect(result).toEqual({
      outputMode: 'stdout',
      azureTokenVariable: undefined,
      appClientId: 'Iv1.client',
      keyId: 'key-id',
      permissions: undefined,
      repository: 'org/repo',
    });
  });

  it('normalizes output casing and whitespace', () => {
    expect(getOptions(readEnv({ ...base, OUTPUT: '  AZURE  ', AZURE_TOKEN_VARIABLE: 'TOKEN' })).outputMode).toBe(
      'azure'
    );
  });

  it('parses permissions', () => {
    expect(getOptions(readEnv({ ...base, PERMISSIONS: 'contents:read  ,foo:write\nbar:admin' })).permissions).toEqual({
      contents: 'read',
      foo: 'write',
      bar: 'admin',
    });
  });

  it('rejects invalid permissions', () => {
    expect(() => getOptions(readEnv({ ...base, PERMISSIONS: 'contents:bogus' }))).toThrow(
      /Invalid permission level for contents: bogus/
    );
  });

  it('rejects an invalid output mode', () => {
    expect(() => getOptions(readEnv({ ...base, OUTPUT: 'bogus' }))).toThrow(/OUTPUT must be one of/);
  });

  it('requires AZURE_TOKEN_VARIABLE for non-stdout output', () => {
    expect(() => getOptions(readEnv({ ...base, OUTPUT: 'azure' }))).toThrow(/AZURE_TOKEN_VARIABLE must be set/);
  });

  it('rejects an invalid AZURE_TOKEN_VARIABLE name', () => {
    expect(() => getOptions(readEnv({ ...base, OUTPUT: 'azure', AZURE_TOKEN_VARIABLE: 'bad name!' }))).toThrow(
      /environment-style variable name/
    );
  });

  it('requires APP_CLIENT_ID', () => {
    expect(() => getOptions(readEnv({ KEY_ID: 'key-id' }))).toThrow(/APP_CLIENT_ID must be set/);
  });

  it('requires KEY_ID', () => {
    expect(() => getOptions(readEnv({ APP_CLIENT_ID: 'Iv1.client' }))).toThrow(/KEY_ID must be set/);
  });

  it('requires REPOSITORY', () => {
    expect(() => getOptions(readEnv({ ...base, REPOSITORY: undefined }))).toThrow(/REPOSITORY must be set/);
  });
});

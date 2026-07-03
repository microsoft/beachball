import { describe, it, expect } from '@jest/globals';
import { getOtherOptions, getTokenOptions, readEnv } from '../../githubAuth/cli';

describe('readEnv', () => {
  it('reads options from the provided source', () => {
    const env = readEnv({
      GITHUB_API_URL: 'https://ghe.example.com/api/v3',
      REVOKE_TOKEN: 'ghs_token',
      APP_CLIENT_ID: 'Iv1.client',
      KEY_ID: 'https://vault/keys/key',
      OUTPUT: 'azure',
      AZURE_TOKEN_VARIABLE: 'MY_TOKEN',
      OWNER: 'my-org',
      ENTERPRISE: 'my-enterprise',
      REPOSITORIES: 'repo-a, repo-b',
      PERMISSIONS: 'contents:read',
      HTTPS_PROXY: 'http://proxy',
      NODE_USE_ENV_PROXY: '1',
    });

    expect(env).toEqual({
      githubApiUrl: 'https://ghe.example.com/api/v3',
      revokeToken: 'ghs_token',
      appClientId: 'Iv1.client',
      keyId: 'https://vault/keys/key',
      output: 'azure',
      azureTokenVariable: 'MY_TOKEN',
      owner: 'my-org',
      enterprise: 'my-enterprise',
      repositories: 'repo-a, repo-b',
      permissions: 'contents:read',
      hasHttpProxy: true,
      nodeUseEnvProxy: '1',
    });
  });

  it('applies defaults for missing values', () => {
    const env = readEnv({});
    expect(env.githubApiUrl).toBe('https://api.github.com');
    expect(env.output).toBe('stdout');
    expect(env.owner).toBeUndefined();
    expect(env.hasHttpProxy).toBe(false);
  });
});

describe('getOtherOptions', () => {
  const base = { APP_CLIENT_ID: 'Iv1.client', KEY_ID: 'key-id' };

  it('defaults to stdout output with no token variable', () => {
    const result = getOtherOptions(readEnv(base));
    expect(result).toEqual({
      outputMode: 'stdout',
      azureTokenVariable: undefined,
      appClientId: 'Iv1.client',
      keyId: 'key-id',
    });
  });

  it('normalizes output casing and whitespace', () => {
    expect(getOtherOptions(readEnv({ ...base, OUTPUT: '  AZURE  ', AZURE_TOKEN_VARIABLE: 'TOKEN' })).outputMode).toBe(
      'azure'
    );
  });

  it('rejects an invalid output mode', () => {
    expect(() => getOtherOptions(readEnv({ ...base, OUTPUT: 'bogus' }))).toThrow(/OUTPUT must be one of/);
  });

  it('requires AZURE_TOKEN_VARIABLE for non-stdout output', () => {
    expect(() => getOtherOptions(readEnv({ ...base, OUTPUT: 'azure' }))).toThrow(/AZURE_TOKEN_VARIABLE must be set/);
  });

  it('rejects an invalid AZURE_TOKEN_VARIABLE name', () => {
    expect(() => getOtherOptions(readEnv({ ...base, OUTPUT: 'azure', AZURE_TOKEN_VARIABLE: 'bad name!' }))).toThrow(
      /environment-style variable name/
    );
  });

  it('requires APP_CLIENT_ID', () => {
    expect(() => getOtherOptions(readEnv({ KEY_ID: 'key-id' }))).toThrow(/APP_CLIENT_ID must be set/);
  });

  it('requires KEY_ID', () => {
    expect(() => getOtherOptions(readEnv({ APP_CLIENT_ID: 'Iv1.client' }))).toThrow(/KEY_ID must be set/);
  });
});

describe('getTokenOptions', () => {
  it('parses owner-only options', () => {
    expect(getTokenOptions(readEnv({ OWNER: 'my-org' }))).toEqual({ owner: 'my-org', permissions: undefined });
  });

  it('parses repositories with permissions', () => {
    expect(
      getTokenOptions(readEnv({ OWNER: 'my-org', REPOSITORIES: 'repo-a, repo-b', PERMISSIONS: 'contents:read' }))
    ).toEqual({
      owner: 'my-org',
      repositories: ['repo-a', 'repo-b'],
      permissions: { contents: 'read' },
    });
  });

  it('parses enterprise options', () => {
    expect(getTokenOptions(readEnv({ ENTERPRISE: 'my-enterprise' }))).toEqual({
      enterprise: 'my-enterprise',
      permissions: undefined,
    });
  });

  it('rejects enterprise combined with owner', () => {
    expect(() => getTokenOptions(readEnv({ ENTERPRISE: 'e', OWNER: 'o' }))).toThrow(
      /Cannot use ENTERPRISE with OWNER or REPOSITORIES/
    );
  });

  it('rejects enterprise combined with repositories', () => {
    expect(() => getTokenOptions(readEnv({ ENTERPRISE: 'e', REPOSITORIES: 'r' }))).toThrow(
      /Cannot use ENTERPRISE with OWNER or REPOSITORIES/
    );
  });

  it('rejects when nothing is set', () => {
    expect(() => getTokenOptions(readEnv({}))).toThrow(/OWNER, REPOSITORIES, or ENTERPRISE must be set/);
  });
});

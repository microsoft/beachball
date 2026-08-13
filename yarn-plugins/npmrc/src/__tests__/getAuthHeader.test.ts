import { afterEach, describe, expect, it } from '@jest/globals';
import { initMockLogs, removeTempDir } from '@microsoft/beachball-test-utilities';
import NpmConfig from '@npmcli/config';
import { getAuthHeader } from '../getAuthHeader.ts';
import { makeVerboseLogger } from '../helpers.ts';
import { initNpmFixture } from '../__fixtures__/initNpmFixture.ts';

describe('getAuthHeader', () => {
  initMockLogs();
  let projectRoot = '';

  async function setup(projectNpmrc: string): Promise<NpmConfig> {
    const fixture = initNpmFixture({ projectNpmrc });
    projectRoot = fixture.projectRoot;

    const npmrc = new NpmConfig({ npmPath: fixture.npmPath, projectRoot, env: fixture.env });
    await npmrc.load();
    return npmrc;
  }

  afterEach(() => {
    projectRoot && removeTempDir(projectRoot);
    projectRoot = '';
  });

  it('gets token auth from npm config', async () => {
    const npmrc = await setup('//token.example/:_authToken=secret-token');

    const header = getAuthHeader({
      npmrc,
      verboseLog: makeVerboseLogger(false),
      registry: 'https://token.example',
    });
    expect(header).toBe('Bearer secret-token');
  });

  it('retries a registry path with a trailing slash', async () => {
    const npmrc = await setup('//token.example/registry/:_authToken=path-token');

    const header = getAuthHeader({
      npmrc,
      verboseLog: makeVerboseLogger(false),
      registry: 'https://token.example/registry',
    });
    expect(header).toBe('Bearer path-token');
  });

  it('gets basic auth from npm config', async () => {
    const npmrc = await setup(
      [
        '//basic.example/:username=test-user',
        `//basic.example/:_password=${Buffer.from('secret').toString('base64')}`,
      ].join('\n')
    );
    const verboseLog = makeVerboseLogger(false);

    const header = getAuthHeader({
      npmrc,
      verboseLog,
      registry: 'https://basic.example',
    });
    expect(header).toBe(`Basic ${Buffer.from('test-user:secret').toString('base64')}`);
  });

  it('falls back to yarn auth when npm config has no matching credentials', async () => {
    const npmrc = await setup('//token.example/:_authToken=secret-token');

    const header = getAuthHeader({
      npmrc,
      verboseLog: makeVerboseLogger(false),
      registry: 'https://unmatched.example',
    });
    expect(header).toBeUndefined();
  });
});

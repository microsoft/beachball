import { afterAll, describe, expect, it, jest } from '@jest/globals';
import { initMockLogs, Registry, removeTempDir, writeJson } from '@microsoft/beachball-test-utilities';
import fs from 'node:fs';
import path from 'node:path';
import { findProjectRoot } from 'workspace-tools';
import { initNpmFixture } from '../__fixtures__/initNpmFixture.ts';
import type { SubprocessError } from 'nano-spawn';

jest.setTimeout(20_000);

/**
 * WARNING: This test uses the BUNDLED plugin output, so it will only run against the latest
 * code if the plugin has already been bundled (this is ensured in lage tasks).
 */
describe('npmrc authentication integration', () => {
  initMockLogs();

  const registry = new Registry(5874);
  let projectRoot: string;

  afterAll(() => {
    registry.stop();
    registry.cleanUp();
    removeTempDir(projectRoot);
  });

  it('authenticates Yarn registry requests using the token from .npmrc', async () => {
    const repoRoot = findProjectRoot(__dirname);

    const yarnrc = fs.readFileSync(path.join(repoRoot, '.yarnrc.yml'), 'utf8');
    const yarnPathMatch = yarnrc.match(/^yarnPath:\s*(?:(['"])(.*?)\1|(\S+))\s*$/m);
    const yarnPath = yarnPathMatch?.[2] || yarnPathMatch?.[3] || '';
    expect(yarnPath).toBeTruthy();

    await registry.start();
    const token = await registry.getToken();
    const registryUrl = registry.getUrl();

    const fixture = initNpmFixture({
      projectNpmrc: `${registryUrl.replace(/^https?:/, '')}/:_authToken=${token}\n`,
    });
    projectRoot = fixture.projectRoot;
    let env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(yarn|npm)_/i.test(key)));
    env = { ...env, ...fixture.env, FORCE_COLOR: '0' };

    writeJson(path.join(projectRoot, 'package.json'), { name: 'npmrc-auth-integration', private: true });

    const pluginPath = path.resolve(__dirname, '../../dist/plugin.dev.js');
    expect(fs.existsSync(pluginPath)).toBe(true);

    fs.writeFileSync(
      path.join(projectRoot, '.yarnrc.yml'),
      [
        'npmrcAuthEnabled: true',
        `npmRegistryServer: ${registryUrl}`,
        'unsafeHttpWhitelist:',
        '  - localhost',
        'plugins:',
        `  - path: "${pluginPath}"`,
        '',
      ].join('\n')
    );

    const { default: nanoSpawn } = await import('nano-spawn');
    let stdout: string | undefined;
    try {
      ({ stdout } = await nanoSpawn(process.execPath, [path.resolve(repoRoot, yarnPath), 'npm', 'whoami'], {
        cwd: projectRoot,
        env,
      }));
    } catch (err) {
      throw new Error(`Command failed:\n${(err as SubprocessError).output}`, { cause: err });
    }

    // this is the username configured in registry.ts
    expect(stdout).toContain('➤ YN0000: fake');
  });
});

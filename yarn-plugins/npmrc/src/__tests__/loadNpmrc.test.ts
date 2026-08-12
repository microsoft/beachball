import { afterEach, describe, expect, it } from '@jest/globals';
import { initMockLogs, removeTempDir } from '@microsoft/beachball-test-utilities';
import { makeVerboseLogger } from '../helpers.ts';
import { loadNpmrc } from '../loadNpmrc.ts';
import { initNpmFixture } from '../__fixtures__/initNpmFixture.ts';

describe('loadNpmrc', () => {
  initMockLogs();
  let projectRoot = '';

  afterEach(() => {
    projectRoot && removeTempDir(projectRoot);
    projectRoot = '';
  });

  it('loads the .npmrc config from project, user, and global locations', async () => {
    const fixture = initNpmFixture({
      projectNpmrc: 'color=false\nregistry=https://project.example/\n',
      userNpmrc: 'fund=false\nregistry=https://user.example/\n',
      globalNpmrc: 'audit=false\nregistry=https://global.example/\n',
    });
    projectRoot = fixture.projectRoot;

    const conf = await loadNpmrc({
      projectRoot,
      workspaceRoot: projectRoot,
      env: {
        ...fixture.env,
        npm_config_registry: 'https://env.example/',
      },
      verboseLog: makeVerboseLogger(true),
    });

    expect(Object.fromEntries(conf.sources.entries())).toMatchObject({
      [fixture.projectNpmrcPath!]: 'project',
      [fixture.userNpmrcPath]: 'user',
      [fixture.globalNpmrcPath]: 'global',
    });

    expect(conf.get('globalconfig')).toBe(fixture.globalNpmrcPath);
    expect(conf.get('audit')).toBe(false);
    expect(conf.get('registry')).toBe('https://env.example/');
  });
});

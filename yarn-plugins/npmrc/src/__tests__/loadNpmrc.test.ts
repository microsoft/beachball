import { afterEach, describe, expect, it } from '@jest/globals';
import { initMockLogs, removeTempDir } from '@microsoft/beachball-test-utilities';
import { makeVerboseLogger } from '../helpers.ts';
import { loadNpmrc } from '../loadNpmrc.ts';
import { initNpmFixture } from '../__fixtures__/initNpmFixture.ts';

describe('loadNpmrc', () => {
  const logs = initMockLogs();
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

    const logLines = logs.getMockLines('log', { root: projectRoot }).replaceAll('[yarn-plugin-npmrc] ', '');
    expect(logLines).toContain('Loaded npm config');
    const loadedIndex = logLines.indexOf('Loaded npm config');
    // remove defaults and builtins in case they change between versions
    const configList = logLines.slice(loadedIndex).replace(/  default: [\s\S]*?  env:/, '  ...\n  env:');
    expect(configList).toMatchInlineSnapshot(`
      "Loaded npm config successfully. Config sources:
        ...
        env: environment
          globalconfig = "<root>/global.npmrc"
          registry = "https://env.example/"
          userconfig = "<root>/user.npmrc"
        project: <root>/.npmrc
          color = false
          registry = "https://project.example/"
        user: <root>/user.npmrc
          fund = false
          registry = "https://user.example/"
        global: <root>/global.npmrc
          audit = false
          registry = "https://global.example/""
    `);
  });
});

import { afterEach, describe, expect, it } from '@jest/globals';
import { expectError, initMockLogs, removeTempDir } from '@microsoft/beachball-test-utilities';
import { npath } from '@yarnpkg/fslib';
import fs from 'node:fs';
import { makeVerboseLogger } from '../helpers.ts';
import { initNpmFixture } from '../__fixtures__/initNpmFixture.ts';
import { _clearCaches, getHeaderFromNpmConfig } from '../getHeaderFromNpmConfig.ts';
import { ReportError } from '@yarnpkg/core';

describe('getHeaderFromNpmConfig', () => {
  const logs = initMockLogs();
  let projectRoot = '';

  function callGetHeader(params: {
    registry: string;
    projectNpmrc: string;
    currentHeader?: string;
    verbose?: boolean;
  }) {
    const { registry, projectNpmrc } = params;
    const fixture = initNpmFixture({ projectNpmrc });
    projectRoot = fixture.projectRoot;

    return getHeaderFromNpmConfig({
      currentHeader: params.currentHeader ?? 'yarn-header',
      registry,
      projectCwd: npath.toPortablePath(projectRoot),
      verboseLog: makeVerboseLogger(params.verbose ?? false),
    });
  }

  afterEach(() => {
    projectRoot && removeTempDir(projectRoot);
    projectRoot = '';
    _clearCaches();
  });

  it('returns the current header when there is no project cwd', async () => {
    const verboseLog = makeVerboseLogger(true);

    const header = await getHeaderFromNpmConfig({
      currentHeader: 'yarn-header',
      registry: 'https://registry.example',
      projectCwd: null,
      verboseLog,
    });

    expect(header).toBe('yarn-header');
    expect(logs.getMockLines('log')).toBe('[yarn-plugin-npmrc] No projectCwd; skipping .npmrc auth header');
  });

  it('loads npm config and returns its auth header', async () => {
    const header = await callGetHeader({
      registry: 'https://registry.example',
      projectNpmrc: '//registry.example/:_authToken=secret-token',
      verbose: true,
    });

    expect(header).toBe('Bearer secret-token');
    expect(logs.getMockLines('log', { root: projectRoot })).toContain(
      '[yarn-plugin-npmrc] Loading .npmrc for projectRoot=<root>'
    );
  });

  it('caches the result for each registry', async () => {
    const firstHeader = callGetHeader({
      registry: 'https://registry.example',
      projectNpmrc: '//registry.example/:_authToken=secret-token',
      currentHeader: 'first-yarn-header',
    });
    const secondHeader = getHeaderFromNpmConfig({
      currentHeader: 'second-yarn-header',
      registry: 'https://registry.example',
      projectCwd: npath.toPortablePath(projectRoot),
      verboseLog: makeVerboseLogger(false),
    });

    expect(await firstHeader).toBe('Bearer secret-token');
    expect(await secondHeader).toBe('Bearer secret-token');
  });

  it('uses currentHeader if the cached header is undefined', async () => {
    const firstHeader = callGetHeader({
      registry: 'https://unmatched.example',
      projectNpmrc: '//registry.example/:_authToken=secret-token',
      currentHeader: 'first-yarn-header',
    });
    const secondHeader = getHeaderFromNpmConfig({
      currentHeader: 'second-yarn-header',
      registry: 'https://unmatched.example',
      projectCwd: npath.toPortablePath(projectRoot),
      verboseLog: makeVerboseLogger(false),
    });

    expect(await firstHeader).toBe('first-yarn-header');
    expect(await secondHeader).toBe('second-yarn-header');
  });

  it('caches npm config loading errors', async () => {
    const fixture = initNpmFixture({ projectNpmrc: '_authToken=invalid-unscoped-token' });
    projectRoot = fixture.projectRoot;
    const params = {
      currentHeader: 'yarn-header',
      registry: 'https://registry.example',
      projectCwd: npath.toPortablePath(projectRoot),
      workspaceRoot: undefined,
      verboseLog: makeVerboseLogger(false),
    };

    const firstError = await expectError(
      () => getHeaderFromNpmConfig(params),
      ReportError,
      'Invalid auth configuration'
    );

    fs.writeFileSync(fixture.projectNpmrcPath!, '//registry.example/:_authToken=valid-token');
    await expect(getHeaderFromNpmConfig(params)).rejects.toBe(firstError);
  });
});

import { describe, expect, it } from '@jest/globals';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { makePackageInfos, type PartialPackageInfos } from '../../__fixtures__/packageInfos';
import { configList } from '../../commands/configList';
import { getPackageGroups } from '../../monorepo/getPackageGroups';
import { getDefaultOptions } from '../../options/getDefaultOptions';
import type { BeachballOptions } from '../../types/BeachballOptions';

describe('configList', () => {
  const logs = initMockLogs();

  function configListWrapper(params?: { packageInfos?: PartialPackageInfos; options?: Partial<BeachballOptions> }) {
    const { options: optionOverrides, packageInfos = {} } = params || {};
    const options: BeachballOptions = { ...getDefaultOptions(), ...optionOverrides };
    const originalPackageInfos = makePackageInfos(packageInfos);

    configList(options, {
      scopedPackages: new Set(Object.keys(originalPackageInfos)),
      packageGroups: getPackageGroups(originalPackageInfos, '', options.groups),
      originalPackageInfos,
    });
  }

  it('prints all repo-level settings and defaults', () => {
    configListWrapper({
      options: {
        branch: 'origin/foo',
        ignorePatterns: ['*.test.ts'],
        // include a nested object to verify indentation level
        changelog: {
          includeCommitHashes: false,
          customRenderers: {
            renderChangeTypeHeader: () => '',
          },
        },
        // This is automatically true in CI, so set an explicit value
        yes: true,
      },
    });
    const output = logs.getMockLines('log');
    // overrides respected
    expect(output).toContain('branch: "origin/foo"');
    expect(output).toContain('ignorePatterns: ["*.test.ts"]');
    expect(output).toContain('changelog:');

    // Just for this test, include a snapshot of the whole thing.
    // Check carefully for indentation or extra whitespace issues if this snapshot changes!
    expect(output).toMatchInlineSnapshot(`
      "Main options (including defaults):
        access: "restricted"
        all: false
        authType: "authtoken"
        branch: "origin/foo"
        bump: true
        bumpDeps: true
        canaryName: undefined
        changeDir: "change"
        changehint: "Run \\"beachball change\\" to create a change file"
        changelog:
          includeCommitHashes: false
          customRenderers:
            renderChangeTypeHeader: (Function)
        command: "change"
        commit: true
        concurrency: 1
        defaultNpmTag: "latest"
        depth: undefined
        disallowedChangeTypes: null
        fetch: true
        generateChangelog: "md"
        gitTags: true
        gitTimeout: undefined
        ignorePatterns: ["*.test.ts"]
        message: ""
        new: false
        npmReadConcurrency: 2
        path: ""
        publish: true
        push: true
        registry: "https://registry.npmjs.org/"
        retries: 3
        scope: null
        tag: ""
        timeout: undefined
        type: null
        version: false
        yes: true"
    `);
  });

  it('prints group overrides with package names', () => {
    configListWrapper({
      options: {
        groups: [{ name: 'my-group', include: 'packages/*', disallowedChangeTypes: ['major'] }],
      },
      packageInfos: { 'pkg-a': {}, 'pkg-b': {} },
    });

    const output = logs.getMockLines('log');
    expect(output).toContain('Group overrides:');
    const groupOverrides = output.substring(output.indexOf('Group overrides:'));
    expect(groupOverrides).toMatchInlineSnapshot(`
      "Group overrides:
        my-group:
          packageNames: ["pkg-a", "pkg-b"]
          disallowedChangeTypes: ["major"]"
    `);
  });

  it('prints per-package overrides', () => {
    configListWrapper({
      packageInfos: {
        'pkg-a': { beachball: { disallowedChangeTypes: ['major', 'minor'] } },
        'pkg-b': {},
        'pkg-c': { beachball: { tag: 'foo' } },
      },
    });

    const output = logs.getMockLines('log');
    expect(output).toContain('Package overrides:');
    expect(output).not.toContain('pkg-b:');
    expect(output.substring(output.indexOf('Package overrides:'))).toMatchInlineSnapshot(`
      "Package overrides:
        pkg-a:
          disallowedChangeTypes: ["major", "minor"]
        pkg-c:
          tag: "foo""
    `);
  });

  it('does not print groups section when there are no groups', () => {
    configListWrapper();
    const output = logs.getMockLines('log');
    expect(output).not.toContain('Groups:');
  });

  it('does not print package overrides section when no packages have overrides', () => {
    configListWrapper({ packageInfos: { 'pkg-a': {} } });
    const output = logs.getMockLines('log');
    expect(output).not.toContain('Package overrides:');
  });
});

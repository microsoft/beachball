import { describe, expect, it, jest } from '@jest/globals';
import {
  Configuration,
  LinkType,
  Manifest,
  Project,
  SettingsType,
  structUtils,
  ThrowReport,
  Workspace,
  type Hooks,
  type Linker,
  type Locator,
  type Package,
} from '@yarnpkg/core';
import { Filename, PortablePath, ppath, xfs } from '@yarnpkg/fslib';
import plugin from './index.ts';
import { EnginesProbeLinker } from './linker.ts';

/** Creates Yarn's resolved package data from a manifest. */
function makePackage(locator: Locator, manifest: Manifest): Package {
  return {
    ...locator,
    version: manifest.version,
    languageName: 'node',
    linkType: LinkType.SOFT,
    conditions: null,
    dependencies: manifest.dependencies,
    peerDependencies: manifest.peerDependencies,
    dependenciesMeta: manifest.dependenciesMeta,
    peerDependenciesMeta: manifest.peerDependenciesMeta,
    bin: manifest.bin,
  };
}

/** Creates a linked project with one public workspace and one dependency. */
function createTestProject({ range = 'npm:^10.0.0', repoRange = '>=20.0.0', loose = false } = {}) {
  const cwd = PortablePath.root;
  const configuration = Configuration.create(
    cwd,
    new Map([
      [
        'engines',
        {
          ...plugin,
          configuration: {
            ...plugin.configuration,
            nodeLinker: {
              description: 'Linker used by the test',
              type: SettingsType.STRING,
              default: 'node-modules',
            },
          },
        },
      ],
    ])
  );
  configuration.use('test', { engines: { loose } }, cwd);
  const project = new Project(cwd, { configuration });
  const manifest = new Manifest();
  manifest.load({
    name: 'test-package',
    version: '1.0.0',
    engines: { node: repoRange },
    dependencies: { 'node-gyp': range },
  });
  const locator = structUtils.makeLocator(structUtils.parseIdent('test-package'), 'workspace:.');
  const workspace = Object.assign(new Workspace(cwd, { project }), { manifest, anchoredLocator: locator });
  project.workspaces.push(workspace);
  project.workspacesByCwd.set(cwd, workspace);
  project.storedPackages.set(locator.locatorHash, makePackage(locator, manifest));
  const descriptor = structUtils.makeDescriptor(structUtils.parseIdent('node-gyp'), range);
  project.storedDescriptors.set(descriptor.descriptorHash, descriptor);

  const probeLinker = new EnginesProbeLinker();
  probeLinker.makeInstaller({ project });
  const linker: Linker = probeLinker;
  jest.spyOn(linker, 'supportsPackage').mockReturnValue(true);
  jest.spyOn(configuration, 'getLinkers').mockReturnValue([linker]);
  const report = new ThrowReport();
  const reportError = jest.spyOn(report, 'reportError').mockImplementation(() => {});
  const reportWarning = jest.spyOn(report, 'reportWarning').mockImplementation(() => {});
  return { configuration, project, descriptor, linker, report, reportError, reportWarning };
}

describe('validateProjectAfterInstall', () => {
  it.each([
    { description: 'reports an unresolved npm dependency', range: 'npm:^10.0.0', ignored: false },
    { description: 'skips an ignore: dependency', range: 'ignore:', ignored: true },
    { description: 'skips a virtualized ignore: dependency', range: 'virtual:peer#ignore:', ignored: true },
  ])('$description', async ({ range, ignored }) => {
    const { configuration, project, descriptor, report, reportError, reportWarning } = createTestProject({ range });

    // eslint-disable-next-line @typescript-eslint/await-thenable
    await (plugin.hooks as Hooks).validateProjectAfterInstall?.(project, report);

    if (ignored) {
      expect(reportError).not.toHaveBeenCalled();
    } else {
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(reportError).toHaveBeenCalledWith(
        0,
        `[yarn-plugin-engines] Could not find a resolved version for ${structUtils.prettyDescriptor(configuration, descriptor)}`
      );
    }
    expect(reportWarning).not.toHaveBeenCalled();
  });

  it.each([
    { description: 'accepts a dependency without engines.node', nodeRange: undefined, loose: false, mismatch: false },
    {
      description: 'accepts a compatible dependency Node requirement',
      nodeRange: '>=18.0.0',
      loose: false,
      mismatch: false,
    },
    {
      description: 'reports a dependency requiring a newer Node version',
      nodeRange: '>=24.0.0',
      loose: false,
      mismatch: true,
    },
    {
      description: 'reports a dependency excluding supported Node versions',
      nodeRange: '<20.0.0',
      loose: false,
      mismatch: true,
    },
    {
      description: 'rejects partial overlap in strict mode',
      nodeRange: '>=18.0.0 <22.0.0',
      loose: false,
      mismatch: true,
    },
    {
      description: 'accepts partial overlap in loose mode',
      nodeRange: '>=18.0.0 <22.0.0',
      loose: true,
      mismatch: false,
    },
  ])('$description', async ({ nodeRange, loose, mismatch }) => {
    await xfs.mktempPromise(async location => {
      const { configuration, project, descriptor, linker, report, reportError, reportWarning } = createTestProject({
        loose,
      });
      const rawManifest = {
        name: 'node-gyp',
        version: '10.0.0',
        ...(nodeRange ? { engines: { node: nodeRange } } : {}),
      };
      await xfs.writeJsonPromise(ppath.join(location, Filename.manifest), rawManifest);
      const manifest = new Manifest();
      manifest.load(rawManifest);
      const locator = structUtils.makeLocator(descriptor, 'npm:10.0.0');
      project.storedResolutions.set(descriptor.descriptorHash, locator.locatorHash);
      const pkg = makePackage(locator, manifest);
      project.storedPackages.set(locator.locatorHash, pkg);
      const findPackageLocation = jest.spyOn(linker, 'findPackageLocation').mockResolvedValue(location);

      // eslint-disable-next-line @typescript-eslint/await-thenable
      await (plugin.hooks as Hooks).validateProjectAfterInstall?.(project, report);

      expect(findPackageLocation).toHaveBeenCalledTimes(1);
      expect(findPackageLocation).toHaveBeenCalledWith(pkg, { project, report });
      if (mismatch) {
        expect(reportError).toHaveBeenCalledTimes(1);
        expect(reportError).toHaveBeenCalledWith(
          0,
          `[yarn-plugin-engines] The following packages require Node ${nodeRange}, which does not match the repo requirement >=20.0.0:\n` +
            `  - ${structUtils.prettyLocator(configuration, locator)}`
        );
      } else {
        expect(reportError).not.toHaveBeenCalled();
      }
      expect(reportWarning).not.toHaveBeenCalled();
    });
  });
});

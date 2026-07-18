import {
  Cache,
  Manifest,
  SettingsType,
  structUtils,
  ThrowReport,
  type ConfigurationDefinitionMap,
  type ConfigurationValueMap,
  type Descriptor,
  type DescriptorHash,
  type FetchOptions,
  type Hooks,
  type Plugin,
  type miscUtils,
} from '@yarnpkg/core';
import semver from 'semver';
import { EnginesProbeLinker } from './linker.js';
import { isRangeSatisfied, parseRange } from './ranges.js';

interface EnginesConfig {
  engines: miscUtils.ToMapValue<{
    ignorePackages: string[];
    includeDevDependencies: boolean;
    loose: boolean;
    verbose: boolean;
  }> | null;
}

const configurationMap: ConfigurationDefinitionMap<EnginesConfig> &
  // we don't provide any of these built-in properties; this just satisfies the plugin type later
  Partial<ConfigurationDefinitionMap<ConfigurationValueMap>> = {
  engines: {
    description: 'Config for yarn-plugin-engines',
    type: SettingsType.SHAPE,
    properties: {
      ignorePackages: {
        description: 'List of packages to ignore when validating engines.node (also ignores their dependencies)',
        type: SettingsType.STRING,
        isArray: true,
        default: [],
      },
      includeDevDependencies: {
        description: 'Whether to include local dev dependencies and private packages when validating engines.node',
        type: SettingsType.BOOLEAN,
        default: false,
      },
      loose: {
        description:
          'If true, only validate that the minimum allowed Node version for the repo satisfies the manifest requirements, instead of requiring the full ranges to overlap',
        type: SettingsType.BOOLEAN,
        default: false,
      },
      verbose: {
        description: 'Enable verbose warnings for debugging',
        type: SettingsType.BOOLEAN,
        default: false,
      },
    },
  },
};

/** A package.json file */
interface RawManifest {
  name?: string;
  version?: string;
  engines?: { node?: string };
  optionalDependencies?: Record<string, string>;
  dependenciesMeta?: Record<string, { optional?: boolean }>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

/**
 * Recursively find non-dev dependencies of published packages, and verify that any `engines.node`
 * requirements match the version from the root `package.json`'s `engines.node`.
 * (Yarn v1 would verify this automatically, but v2+ does not...)
 */
// eslint-disable-next-line @typescript-eslint/no-misused-promises -- is awaited at runtime
const validateProjectAfterInstall: NonNullable<Hooks['validateProjectAfterInstall']> = async (project, report) => {
  const enginesConfig = project.configuration.get('engines') as EnginesConfig['engines'] | undefined;
  const ignorePackages = enginesConfig?.get('ignorePackages') || [];
  const includeDevDependencies = !!enginesConfig?.get('includeDevDependencies');
  const loose = !!enginesConfig?.get('loose');
  const verbose = !!enginesConfig?.get('verbose');
  const linkerName = (project.configuration.get('nodeLinker') as string) || 'node-modules';

  const reportError = (message: unknown) => {
    report.reportError(0, `[yarn-plugin-engines] ${String(message)}`);
  };

  const verboseWarning = (message: unknown) => {
    verbose && report.reportWarning(0, `[yarn-plugin-engines] warning: ${String(message)}`);
  };

  // If the link step didn't run (e.g. `yarn install --mode=update-lockfile`), packages haven't been
  // installed on disk, so there's nothing to validate.
  if (!EnginesProbeLinker.wasProjectLinked(project)) {
    report.reportWarning(0, '[yarn-plugin-engines] Skipping validation because packages were not linked');
    return;
  }

  if (linkerName !== 'pnpm' && linkerName !== 'node-modules') {
    reportError(`This plugin is not compatible with the ${linkerName} linker`);
    return;
  }

  const rangeStr = (project.topLevelWorkspace.manifest.raw as RawManifest).engines?.node;
  if (!rangeStr) {
    reportError('Missing package.json engines.node field');
    return;
  }
  const repoRange = parseRange(rangeStr);
  if (!repoRange) {
    reportError(`Invalid semver range "${rangeStr}" in package.json engines.node`);
    return;
  }
  if (!semver.satisfies(process.versions.node, repoRange)) {
    reportError(`The current Node version ${process.versions.node} does not satisfy ${repoRange.raw}`);
    return;
  }

  // Read each package's manifest from the fetch cache (populated during the fetch step) rather than
  // from the linked node_modules. This is linker-agnostic and doesn't depend on the on-disk layout.
  const cache = await Cache.find(project.configuration);
  const fetcher = project.configuration.makeFetcher();
  const fetchOptions: FetchOptions = {
    project,
    cache,
    fetcher,
    checksums: project.storedChecksums,
    report: new ThrowReport(),
    cacheOptions: {
      mockedPackages: project.disabledLocators,
      unstablePackages: project.conditionalLocators,
      skipIntegrityCheck: true,
    },
  };

  /** deps detected but not yet found/processed */
  const dependenciesQueue: DescriptorHash[] = [];
  const processedDependencies = new Set<DescriptorHash>();
  /** deps detected as required by at least one manifest */
  const requiredDependencies = new Set<DescriptorHash>();
  /** deps marked as optional by at least one manifest */
  const optionalDependencies = new Set<DescriptorHash>();
  const debugInfo = new Map<DescriptorHash, { ident: string; range: string; pretty: string; parent: string }>();

  /** Queue a descriptor for processing if not already queued/processed */
  const enqueueDependency = (descriptor: Descriptor, manifest: Manifest) => {
    const pkgName = structUtils.stringifyIdent(descriptor);
    const descriptorHash = descriptor.descriptorHash;
    const rawManifest = manifest.raw as RawManifest;
    debugInfo.set(descriptorHash, {
      ident: pkgName,
      range: descriptor.range,
      pretty: structUtils.prettyDescriptor(project.configuration, descriptor),
      parent: `${rawManifest.name}@${rawManifest.version}`,
    });

    // Check all the places a dep can be specified as optional
    // (it's probably not important to be strict about deps vs peers here)
    if (
      rawManifest.optionalDependencies?.[pkgName] ||
      rawManifest.dependenciesMeta?.[pkgName]?.optional === true ||
      rawManifest.peerDependenciesMeta?.[pkgName]?.optional === true
    ) {
      if (!requiredDependencies.has(descriptorHash)) {
        optionalDependencies.add(descriptorHash);
      }
    } else {
      requiredDependencies.add(descriptorHash);
      optionalDependencies.delete(descriptorHash);
    }

    if (
      descriptor.range.startsWith('workspace:') ||
      ignorePackages.includes(pkgName) ||
      processedDependencies.has(descriptorHash) ||
      dependenciesQueue.includes(descriptorHash)
    ) {
      return;
    }

    dependenciesQueue.push(descriptorHash);
  };

  // Seed with non-dev dependencies from public workspace manifests.
  // Use the Package object's dependency descriptors (which have correct hashes
  // matching storedResolutions, including virtual hashes for packages with peer deps),
  // but filter by idents from the manifest's dependencies/peerDependencies to exclude devDeps.
  for (const workspace of project.workspaces) {
    if (workspace.manifest.private && !includeDevDependencies) continue;

    const wsPkg = project.storedPackages.get(workspace.anchoredLocator.locatorHash);
    if (!wsPkg) continue;

    // Queue matching descriptors from the Package (which have correct hashes)
    for (const desc of wsPkg.dependencies.values()) {
      // Package.dependencies for workspaces also includes devDependencies, so ignore those
      // unless dev dependencies are requested
      if (includeDevDependencies || workspace.manifest.dependencies.has(desc.identHash)) {
        enqueueDependency(desc, workspace.manifest);
      }
    }
    for (const desc of wsPkg.peerDependencies.values()) {
      enqueueDependency(desc, workspace.manifest);
    }
  }

  const unsatisfiedNodeReqs: Record<string, Set<string>> = {};

  while (dependenciesQueue.length) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const descriptorHash = dependenciesQueue.shift()!;
    processedDependencies.add(descriptorHash);

    const isOptional = optionalDependencies.has(descriptorHash);
    const maybeReportError = (message: string) => !isOptional && reportError(message);

    const desc = project.storedDescriptors.get(descriptorHash);
    if (!desc) {
      // A descriptor with no stored resolution is an unresolved peer dependency (e.g. a workspace's
      // own peerDependencies, which are never resolved because nothing in the graph provides them).
      // These can't be validated, so skip them silently rather than reporting a spurious error.
      if (!project.storedResolutions.has(descriptorHash)) {
        continue;
      }
      const info = debugInfo.get(descriptorHash);
      const debugText =
        info && `[ident="${info.ident}" range="${info.range}" pretty="${info.pretty}" parent="${info.parent}"]`;
      maybeReportError(`Could not find descriptor for hash ${descriptorHash} ${debugText}`);
      continue;
    }
    const prettyDesc = structUtils.prettyDescriptor(project.configuration, desc);

    const locatorHash = project.storedResolutions.get(descriptorHash);
    if (!locatorHash) {
      maybeReportError(`Could not find a resolved version for ${prettyDesc}`);
      continue;
    }

    // The descriptor resolved successfully, so its debug info is no longer needed.
    debugInfo.delete(descriptorHash);

    const pkg = project.storedPackages.get(locatorHash);
    if (!pkg) {
      maybeReportError(`Could not find an installed package for ${prettyDesc}`);
      continue;
    }

    // Fetch the package's sources from the cache (a virtual locator's manifest is the same as its
    // devirtualized locator's, so devirtualize before fetching).
    const fetchLocator = structUtils.isVirtualLocator(pkg) ? structUtils.devirtualizeLocator(pkg) : pkg;
    let fetchResult;
    try {
      fetchResult = await fetcher.fetch(fetchLocator, fetchOptions);
    } catch (e) {
      if (isOptional) {
        verboseWarning(`Could not fetch optional package ${prettyDesc} from the cache, skipping...`);
        continue;
      }
      reportError(`Could not fetch ${prettyDesc} from the cache: ${e}`);
      continue;
    }

    let manifest: Manifest | null;
    try {
      manifest = await Manifest.tryFind(fetchResult.prefixPath, { baseFs: fetchResult.packageFs });
    } finally {
      fetchResult.releaseFs?.();
    }
    if (!manifest) {
      const isDisabledLocator =
        project.disabledLocators.has(pkg.locatorHash) || project.disabledLocators.has(fetchLocator.locatorHash);
      if (isDisabledLocator) {
        // A mocked/disabled package (e.g. incompatible with this platform) has an empty fs, so skip
        verboseWarning(`Could not read package.json for disabled package ${prettyDesc}, skipping...`);
        continue;
      }
      maybeReportError(`Could not read package.json for ${prettyDesc}`);
      continue;
    }

    const manifestRange = (manifest.raw as RawManifest).engines?.node;
    if (manifestRange && !isRangeSatisfied({ repoRange, manifestRange, loose })) {
      unsatisfiedNodeReqs[manifestRange] ??= new Set();
      unsatisfiedNodeReqs[manifestRange].add(structUtils.prettyLocator(project.configuration, pkg));
    }

    // Recursively process this package's dependencies.
    // Use the original (possibly virtual) pkg's dependencies — these have descriptor
    // hashes that match storedResolutions. External packages don't include devDeps.
    for (const dep of pkg.dependencies.values()) {
      enqueueDependency(dep, manifest);
    }
  }

  for (const [nodeReq, pkgs] of Object.entries(unsatisfiedNodeReqs)) {
    reportError(
      `The following packages require Node ${nodeReq}, which does not match the repo requirement ${repoRange.raw}:\n` +
        [...pkgs]
          .sort()
          .map(pkg => `  - ${pkg}`)
          .join('\n')
    );
  }
};

const plugin: Plugin = {
  hooks: { validateProjectAfterInstall },
  linkers: [EnginesProbeLinker],
  configuration: configurationMap,
};

export default plugin;

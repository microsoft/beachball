import { isPackageIncluded } from '../changefile/isPackageIncluded';
import { getDisallowedChangeTypes } from '../changefile/getDisallowedChangeTypes';
import { formatValue } from '../logging/formatValue';
import { BeachballError } from '../types/BeachballError';
import type { BeachballOptions, PackageOptions, RepoOptions, VersionGroupOptions } from '../types/BeachballOptions';
import type { BasicCommandContext } from '../types/CommandContext';

/** Keys that can be overridden per-package (exhaustive via Record) */
const packageOptionKeys: Record<string, true> = {
  tag: true,
  defaultNpmTag: true,
  disallowedChangeTypes: true,
  gitTags: true,
  shouldPublish: true,
} satisfies Record<keyof PackageOptions, true>;

/** Keys from RepoOptions (the full set of valid config file settings, exhaustive via Record) */
const repoOptionKeys: Record<string, true> = {
  access: true,
  authType: true,
  branch: true,
  bump: true,
  bumpDeps: true,
  changeFilePrompt: true,
  changehint: true,
  changeDir: true,
  changelog: true,
  commit: true,
  concurrency: true,
  npmReadConcurrency: true,
  defaultNpmTag: true,
  disallowedChangeTypes: true,
  disallowDeletedChangeFiles: true,
  fetch: true,
  fromRef: true,
  generateChangelog: true,
  groups: true,
  gitTags: true,
  hooks: true,
  ignorePatterns: true,
  keepChangeFiles: true,
  message: true,
  path: true,
  prereleasePrefix: true,
  identifierBase: true,
  publish: true,
  packToPath: true,
  packStyle: true,
  push: true,
  registry: true,
  retries: true,
  scope: true,
  tag: true,
  timeout: true,
  gitTimeout: true,
  transform: true,
  groupChanges: true,
  depth: true,
  new: true,
} satisfies Record<keyof RepoOptions, true>;

type GroupOptionName = Exclude<keyof VersionGroupOptions, 'name' | 'include' | 'exclude'>;
const groupOptionsKeys: Record<string, true> = {
  disallowedChangeTypes: true,
} satisfies Record<GroupOptionName, true>;

/** All valid config names that can be queried */
const validConfigNames = new Set<string>([
  ...Object.keys(repoOptionKeys),
  ...Object.keys(packageOptionKeys),
  ...Object.keys(groupOptionsKeys),
]);

/**
 * Handles the `beachball config get <name>` command.
 *
 * The output of this command is intended to be read by humans or AI, not parsed directly.
 * It includes the top-level setting and any package and/or group overrides.
 * (If parseable output is needed, an option could be added in the future.)
 */
export function configGet(options: BeachballOptions, context: BasicCommandContext): void {
  const { originalPackageInfos: packageInfos, scopedPackages } = context;

  const extraArgs = options._extraPositionalArgs || [];
  if (extraArgs[0] !== 'get' || extraArgs.length !== 2) {
    throw new BeachballError(
      'Usage: beachball config get <setting>\n\nGets the value of the specified config setting.'
    );
  }

  const name = extraArgs[1];
  if (!validConfigNames.has(name)) {
    const suggestion = findSimilar(name, [...validConfigNames]);
    throw new BeachballError(
      suggestion
        ? `Unknown config setting: "${name}" - did you mean "${suggestion}"?`
        : `Unknown config setting: "${name}"`
    );
  }

  // Validate any provided package names
  const packageNames = Array.isArray(options.package) ? options.package : options.package ? [options.package] : [];
  let hasError = false;
  for (const pkgName of packageNames) {
    if (!packageInfos[pkgName]) {
      console.error(`Package "${pkgName}" not found in repo`);
      hasError = true;
    } else {
      const { isIncluded, reason } = isPackageIncluded(packageInfos[pkgName], scopedPackages);
      if (!isIncluded) {
        console.error(`Invalid package: ${reason}`);
        hasError = true;
      }
    }
  }
  if (hasError) {
    throw new BeachballError('One or more packages not included', { alreadyLogged: true });
  }

  if (packageNames?.length) {
    printForPackages(name, packageNames, options, context);
  } else {
    printDefault(name, options, context);
  }
}

/** Print the effective value of a setting for specific packages (--package) */
function printForPackages(
  name: string,
  packageNames: string[],
  options: BeachballOptions,
  context: BasicCommandContext
): void {
  const { originalPackageInfos: packageInfos, packageGroups } = context;
  const mainValue = (options as unknown as Record<string, unknown>)[name];

  const results: Record<string, unknown> = {};
  for (const pkgName of packageNames) {
    if (groupOptionsKeys[name]) {
      if (name === 'disallowedChangeTypes') {
        results[pkgName] = getDisallowedChangeTypes(pkgName, packageInfos, packageGroups, options);
      } else {
        // guard against future group options
        throw new BeachballError(`Not implemented: need logic to merge group option "${name}"`);
      }
    } else {
      const pkgValue = packageOptionKeys[name]
        ? packageInfos[pkgName].packageOptions?.[name as keyof PackageOptions]
        : undefined;
      results[pkgName] = pkgValue !== undefined ? pkgValue : mainValue;
    }
  }

  console.log(formatValue(results));
}

/** Print the repo-level value of a setting, plus any package or group overrides */
function printDefault(name: string, options: BeachballOptions, context: BasicCommandContext): void {
  const { originalPackageInfos: packageInfos, scopedPackages, packageGroups } = context;
  const mainValue = (options as unknown as Record<string, unknown>)[name];

  // Collect package overrides
  const pkgOverrides: Record<string, unknown> = {};
  if (packageOptionKeys[name]) {
    const pkgKey = name as keyof PackageOptions;
    for (const pkgInfo of Object.values(packageInfos)) {
      const pkgValue = pkgInfo.packageOptions?.[pkgKey];
      // Verify the package is included, but it's not an error here since it wasn't explicitly requested
      if (isPackageIncluded(pkgInfo, scopedPackages).isIncluded && pkgValue !== undefined) {
        pkgOverrides[pkgInfo.name] = pkgValue;
      }
    }
  }

  // Collect group overrides
  const groupOverrides: Record<string, unknown> = {};
  if (groupOptionsKeys[name] && options.groups?.length) {
    const groupKey = name as GroupOptionName;
    for (const group of options.groups) {
      if (group[groupKey] !== undefined) {
        groupOverrides[group.name] = {
          [groupKey]: group[groupKey],
          packageNames: packageGroups[group.name]?.packageNames,
        };
      }
    }
  }

  const hasGroupOverrides = Object.keys(groupOverrides).length > 0;
  const hasPkgOverrides = Object.keys(pkgOverrides).length > 0;

  const prefix = hasPkgOverrides || hasGroupOverrides ? 'Main value: ' : '';
  console.log(prefix + formatValue(mainValue));

  if (hasPkgOverrides) {
    console.log('\nPackage overrides:');
    console.log(formatValue(pkgOverrides, { level: 1 }));
  }

  if (hasGroupOverrides) {
    console.log('\nGroup overrides:');
    console.log(formatValue(groupOverrides, { level: 1 }));
  }
}

/** Find a similar string (for typo suggestions) using simple edit distance check */
function findSimilar(input: string, candidates: string[]): string | undefined {
  const lower = input.toLowerCase();
  // First try prefix match
  const prefixMatch = candidates.find(c => c.toLowerCase().startsWith(lower));
  if (prefixMatch) return prefixMatch;
  // Then try contains
  const containsMatch = candidates.find(c => c.toLowerCase().includes(lower));
  if (containsMatch) return containsMatch;
  return undefined;
}

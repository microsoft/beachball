import type { BeachballOptions, PackageOptions, RepoOptions } from '../types/BeachballOptions';
import type { PackageInfos } from '../types/PackageInfo';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import type { ParsedOptions } from '../types/BeachballOptions';
import { BeachballError } from '../types/BeachballError';

/** Keys that can be overridden per-package */
const packageOptionKeys: (keyof PackageOptions)[] = [
  'tag',
  'defaultNpmTag',
  'disallowedChangeTypes',
  'gitTags',
  'shouldPublish',
];

/** Keys from RepoOptions (the full set of valid config file settings) */
const repoOptionKeys: (keyof RepoOptions)[] = [
  'access',
  'authType',
  'branch',
  'bump',
  'bumpDeps',
  'canaryName',
  'changeFilePrompt',
  'changehint',
  'changeDir',
  'changelog',
  'commit',
  'concurrency',
  'npmReadConcurrency',
  'defaultNpmTag',
  'disallowedChangeTypes',
  'disallowDeletedChangeFiles',
  'fetch',
  'fromRef',
  'generateChangelog',
  'groups',
  'gitTags',
  'hooks',
  'ignorePatterns',
  'keepChangeFiles',
  'message',
  'path',
  'prereleasePrefix',
  'identifierBase',
  'publish',
  'packToPath',
  'packStyle',
  'push',
  'registry',
  'retries',
  'scope',
  'tag',
  'timeout',
  'gitTimeout',
  'transform',
  'groupChanges',
  'depth',
  'new',
];

/** All valid config names that can be queried */
const validConfigNames = new Set<string>([...repoOptionKeys, ...packageOptionKeys]);

/**
 * Handles the `beachball config get <name>` command.
 * Displays the effective value of a config setting, including any per-package or group overrides.
 */
export function configGet(options: BeachballOptions, name: string, parsedOptions: ParsedOptions): void {
  if (!validConfigNames.has(name)) {
    const suggestion = findSimilar(name, [...validConfigNames]);
    const message = suggestion
      ? `Unknown config setting: "${name}". Did you mean "${suggestion}"?`
      : `Unknown config setting: "${name}".`;
    console.error(message);
    console.error(`\nValid config settings:\n  ${[...validConfigNames].sort().join('\n  ')}`);
    throw new BeachballError(message, { alreadyLogged: true });
  }

  const isPackageOption = packageOptionKeys.includes(name as keyof PackageOptions);
  const requestedPackages = options.package;

  if (requestedPackages) {
    // Show value for specific package(s)
    const packageInfos = getPackageInfos(parsedOptions);
    const packageNames = Array.isArray(requestedPackages) ? requestedPackages : [requestedPackages];
    let hasError = false;

    for (const pkgName of packageNames) {
      const pkgInfo = packageInfos[pkgName];
      if (!pkgInfo) {
        console.error(`Package not found: "${pkgName}"`);
        hasError = true;
        continue;
      }
      const pkgValue = isPackageOption ? pkgInfo.packageOptions?.[name as keyof PackageOptions] : undefined;
      const effectiveValue = pkgValue !== undefined ? pkgValue : (options as unknown as Record<string, unknown>)[name];
      console.log(`${name} (for ${pkgName}): ${formatValue(effectiveValue)}`);
    }

    if (hasError) {
      throw new BeachballError('One or more packages not found', { alreadyLogged: true });
    }
  } else {
    // Show the repo-level value
    console.log(`${name}: ${formatValue((options as unknown as Record<string, unknown>)[name])}`);

    // If it's a package option, show any per-package overrides
    if (isPackageOption) {
      const packageInfos = getPackageInfos(parsedOptions);
      const overrides = getPackageOverrides(packageInfos, name as keyof PackageOptions);
      if (overrides.length) {
        console.log('\nPackages with overrides:');
        for (const override of overrides) {
          console.log(`  ${override.name}: ${formatValue(override.value)}`);
        }
      }
    }

    // For disallowedChangeTypes, also show group overrides
    if (name === 'disallowedChangeTypes' && options.groups?.length) {
      const groupOverrides = options.groups.filter(g => g.disallowedChangeTypes !== undefined);
      if (groupOverrides.length) {
        console.log('\nGroup overrides:');
        for (const group of groupOverrides) {
          console.log(`  ${group.name}: ${formatValue(group.disallowedChangeTypes)}`);
        }
      }
    }
  }
}

/** Find packages that have overrides for a specific option */
function getPackageOverrides(
  packageInfos: PackageInfos,
  optionName: keyof PackageOptions
): { name: string; value: unknown }[] {
  const overrides: { name: string; value: unknown }[] = [];
  for (const [pkgName, pkgInfo] of Object.entries(packageInfos)) {
    const pkgValue = pkgInfo.packageOptions?.[optionName];
    if (pkgValue !== undefined) {
      overrides.push({ name: pkgName, value: pkgValue });
    }
  }
  return overrides;
}

/** Format a value for display */
function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value || '""';
  if (typeof value === 'function') return '[Function]';
  return JSON.stringify(value);
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

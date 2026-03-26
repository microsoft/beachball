import { BeachballError } from '../types/BeachballError';
import type { BeachballOptions, PackageOptions, RepoOptions, VersionGroupOptions } from '../types/BeachballOptions';
import type { BasicCommandContext } from '../types/CommandContext';
import type { PackageInfos } from '../types/PackageInfo';
import { isPackageIncluded } from '../changefile/getChangedPackages';
import { bulletedList } from '../logging/bulletedList';
import { formatValue } from '../logging/formatValue';

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
  canaryName: true,
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

const groupOptionsKeys: Record<string, true> = {
  disallowedChangeTypes: true,
} satisfies Record<Exclude<keyof VersionGroupOptions, 'name' | 'include' | 'exclude'>, true>;

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
  const { originalPackageInfos: packageInfos, scopedPackages, packageGroups } = context;

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

  const isPackageOption = !!packageOptionKeys[name];
  const requestedPackages = options.package;

  if (requestedPackages) {
    // Show value for specific package(s)
    const packageNames = Array.isArray(requestedPackages) ? requestedPackages : [requestedPackages];
    let hasError = false;

    for (const pkgName of packageNames) {
      const pkgInfo = packageInfos[pkgName];
      const { isIncluded, reason } = isPackageIncluded(pkgInfo, scopedPackages);
      if (!isIncluded) {
        console.error(`Package "${pkgName}": ${reason}`);
        hasError = true;
        continue;
      }
      const pkgValue = isPackageOption ? pkgInfo.packageOptions?.[name as keyof PackageOptions] : undefined;
      const effectiveValue = pkgValue !== undefined ? pkgValue : (options as unknown as Record<string, unknown>)[name];
      console.log(`${pkgName}: ${_formatValue(effectiveValue)}`);
    }

    if (hasError) {
      throw new BeachballError('One or more packages not included', { alreadyLogged: true });
    }
  } else {
    // Collect overrides before printing so we know whether to add a prefix
    const packageOverrides = isPackageOption
      ? getPackageOverrides(packageInfos, name as keyof PackageOptions, scopedPackages)
      : [];

    let groupOverrides: typeof options.groups = [];
    let groupKey: keyof Omit<VersionGroupOptions, 'name' | 'include' | 'exclude'> | undefined;
    if (groupOptionsKeys[name] && options.groups?.length) {
      groupKey = name as typeof groupKey;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      groupOverrides = options.groups.filter(g => g[groupKey!] !== undefined);
    }

    const hasOverrides = packageOverrides.length > 0 || groupOverrides.length > 0;
    const formattedValue = _formatValue((options as unknown as Record<string, unknown>)[name]);

    // Show the repo-level value, with a prefix if there are overrides for context
    console.log(hasOverrides ? `Main value: ${formattedValue}` : formattedValue);

    if (packageOverrides.length) {
      console.log('\nPackage overrides:');
      for (const override of packageOverrides) {
        console.log(`  ${override.name}: ${_formatValue(override.value)}`);
      }
    }

    if (groupOverrides.length && groupKey) {
      console.log('\nGroup overrides:');
      for (const group of groupOverrides) {
        const packages = packageGroups[group.name]?.packageNames;
        console.log(`  ${group.name}: ${_formatValue(group[groupKey])}`);
        if (packages?.length) {
          console.log(`    packages in group:\n${bulletedList(packages, 3)}`);
        }
      }
    }
  }
}

function _formatValue(value: unknown): string {
  // go narrower with the width limit to account for likely keys before
  return formatValue(value, { widthLimit: 40 });
}

/** Find included packages that have overrides for a specific option */
function getPackageOverrides(
  packageInfos: PackageInfos,
  optionName: keyof PackageOptions,
  scopedPackages: ReadonlySet<string>
): { name: string; value: unknown }[] {
  const overrides: { name: string; value: unknown }[] = [];
  for (const pkgInfo of Object.values(packageInfos)) {
    if (!isPackageIncluded(pkgInfo, scopedPackages).isIncluded) continue;
    const pkgValue = pkgInfo.packageOptions?.[optionName];
    if (pkgValue !== undefined) {
      overrides.push({ name: pkgInfo.name, value: pkgValue });
    }
  }
  return overrides;
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

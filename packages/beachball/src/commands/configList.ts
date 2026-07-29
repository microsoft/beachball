import { isPackageIncluded } from '../changefile/isPackageIncluded';
import { formatValue } from '../logging/formatValue';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { BasicCommandContext } from '../types/CommandContext';

/** Option keys that hold credentials and must never be printed by `config list`. */
const secretOptions: (keyof BeachballOptions)[] = ['token', 'gitToken'];

/**
 * Handles the `beachball config list` command.
 * Prints all main settings, then any group overrides, then any per-package overrides.
 */
export function configList(options: BeachballOptions, context: BasicCommandContext): void {
  const { originalPackageInfos: packageInfos, scopedPackages, packageGroups } = context;
  const optionsRecord = options as unknown as Record<string, unknown>;

  // Print main settings (from repo options and defaults; CLI overrides aren't relevant
  // but would currently be included automatically since we don't validate args by command).
  // Redact secret options so credentials aren't printed to the console or logs.
  const sortedOptions = Object.fromEntries(
    Object.entries(optionsRecord)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [
        key,
        secretOptions.includes(key as keyof BeachballOptions) && value !== undefined ? '[hidden]' : value,
      ])
  );
  console.log('Main options (including defaults):');
  console.log(formatValue(sortedOptions, { level: 1 }));

  // Print group overrides, omitting any that just have include/exclude without settings
  // (need to filter by other keys too if added later)
  const groupsWithOverrides = Object.entries(packageGroups).filter(([_, group]) => 'disallowedChangeTypes' in group);
  if (groupsWithOverrides.length) {
    console.log('\nGroup overrides:');
    console.log(formatValue(Object.fromEntries(groupsWithOverrides), { level: 1 }));
  }

  // Print per-package overrides
  const packagesWithOverrides = Object.values(packageInfos)
    .filter(pkg => Object.keys(pkg.packageOptions || {}).length && isPackageIncluded(pkg, scopedPackages))
    .map(pkg => [pkg.name, pkg.packageOptions] as const);
  if (packagesWithOverrides.length) {
    console.log('\nPackage overrides:');
    console.log(formatValue(Object.fromEntries(packagesWithOverrides), { level: 1 }));
  }
}

import type { PackageInfo as WSPackageInfo } from 'workspace-tools';
import type { PackageOptions, CliOptions } from '../types/BeachballOptions';
import { getCliOptions } from './getCliOptions';
import { env } from '../env';
import { consideredDependencies, type PackageInfo, type PackageInfos } from '../types/PackageInfo';

/**
 * Fill in options to convert `workspace-tools` `PackageInfos` to the format used in this repo,
 * including any package-specific options merged with CLI overrides.
 * @param cliOptions Parsed CLI options. Can be null in tests to indicate no CLI options.
 * @param enableCombinedOptionsForTests For testing only: usually in tests, the combinedOptions
 * getter is not added to prevent jest exceptions when checking equality of objects.
 * Use this to force adding the getter for testing its behavior.
 */
export function getPackageInfosWithOptions(
  wsPackageInfos: WSPackageInfo[],
  cliOptions: Partial<CliOptions> | null,
  enableCombinedOptionsForTests?: boolean
): PackageInfos;
/** @deprecated Provide the pre-parsed options */
export function getPackageInfosWithOptions(wsPackageInfos: WSPackageInfo[]): PackageInfos;
export function getPackageInfosWithOptions(
  wsPackageInfos: WSPackageInfo[],
  cliOptions?: Partial<CliOptions> | null,
  enableCombinedOptionsForTests?: boolean
): PackageInfos {
  if (cliOptions === undefined) {
    // Don't use options from process.argv or the beachball repo in tests
    // eslint-disable-next-line beachball/no-deprecated
    cliOptions = env.isJest ? null : getCliOptions(process.argv);
  }

  const packageInfos: PackageInfos = {};

  for (const packageJson of wsPackageInfos) {
    const newPackageInfo: PackageInfo = {
      name: packageJson.name,
      version: packageJson.version,
      packageJsonPath: packageJson.packageJsonPath,
    };
    packageJson.private === true && (newPackageInfo.private = true);

    // Only copy dep types that are present to avoid creating/storing tons of undefined keys
    for (const depType of consideredDependencies) {
      const deps = packageJson[depType];
      deps && (newPackageInfo[depType] = deps);
    }

    if (!env.isJest || enableCombinedOptionsForTests) {
      // Use a non-enumerable property (won't be JSON.stringified) to throw on explicit combinedOptions access
      Object.defineProperty(newPackageInfo, 'combinedOptions', {
        enumerable: false,
        configurable: false,
        get: throwCombinedOptionsError,
      });
    }

    // Check for package-specific options in the "beachball" key of package.json and
    // merge any overrides from CLI options
    // TODO: merge group options too (group disallowedChangeTypes currently override package)
    const packageOptions = mergePackageOptions(packageJson.beachball as PackageOptions | undefined, cliOptions);
    packageOptions && (newPackageInfo.packageOptions = packageOptions);

    packageInfos[packageJson.name] = newPackageInfo;
  }

  return packageInfos;
}

const packageKeys = Object.keys({
  tag: true,
  defaultNpmTag: true,
  disallowedChangeTypes: true,
  gitTags: true,
  shouldPublish: true,
} satisfies Record<keyof PackageOptions, true>) as (keyof PackageOptions)[];

/**
 * Merge package-specific options (`beachball` field in package.json) with any CLI overrides.
 * @returns Merged options, or undefined if no package-specific options were set
 */
function mergePackageOptions(
  packageOptions: PackageOptions | undefined,
  cliOptions: Partial<CliOptions> | null
): PackageOptions | undefined {
  if (!packageOptions) return undefined;

  const mergedOptions = {} as PackageOptions;
  let hasOptions = false;
  for (const key of packageKeys) {
    // We only care about possible CLI overrides if the package option was set
    // (otherwise the standard merged option can be used)
    if (packageOptions[key] !== undefined) {
      // Prefer the CLI value if present, or fall back to package value
      // (cliOptions keys should never be null or undefined, so we can use ?? )
      // eslint-disable-next-line
      (mergedOptions as any)[key] = (cliOptions as any)?.[key] ?? packageOptions[key];
      hasOptions = true;
    }
  }
  return hasOptions ? mergedOptions : undefined;
}

/**
 * Shared helper to throw on `combinedOptions` access (one function without method scope
 * for all instances).
 */
function throwCombinedOptionsError() {
  throw new Error(
    'combinedOptions is no longer supported. Get package-specific options ' +
      '(plus any CLI overrides) via packageOptions, or other values via main options.'
  );
}

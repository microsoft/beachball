import semver from 'semver';
import { bumpInMemory } from '../bump/bumpInMemory';
import { performBump } from '../bump/performBump';
import { setDependentVersions } from '../bump/setDependentVersions';
import { hasPackageVersions } from '../packageManager/getPackageVersions';
import { publishToRegistry } from '../publish/publishToRegistry';
import { BeachballError } from '../types/BeachballError';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { CommandContext } from '../types/CommandContext';

/**
 * Bump and publish a "canary" prerelease version.
 * @param context Command context from `validate()`
 */
export async function canary(options: BeachballOptions, context: CommandContext): Promise<void> {
  const bumpInfo = context.bumpInfo || bumpInMemory(options, context);
  const { originalPackageInfos } = context;

  options.keepChangeFiles = true;
  options.generateChangelog = false;

  if (options.all) {
    // TODO this likely won't fully work as intended, and is adding private or out-of-scope packages
    for (const pkg of Object.keys(originalPackageInfos)) {
      bumpInfo.modifiedPackages.add(pkg);
    }
  }

  const tryPrereleaseInc = (pkg: string, version: string): string => {
    const canaryName = options.canaryName || 'canary';
    const newVersion = semver.inc(version, 'prerelease', canaryName);
    if (newVersion) return newVersion;
    throw new BeachballError(
      `Failed to increment prerelease version for ${pkg} (version ${version}, prerelease ${canaryName})`
    );
  };

  // Start each package at its next canary version.
  // TODO: once tag option precedence is fixed, try starting from the tag instead.
  let pendingVersions = Object.fromEntries(
    [...bumpInfo.modifiedPackages].map(pkg => [pkg, tryPrereleaseInc(pkg, originalPackageInfos[pkg].version)])
  );

  // Check candidates in batches, finalizing available versions and retrying only collisions.
  while (Object.keys(pendingVersions).length) {
    const packageVersions = await hasPackageVersions(pendingVersions, options);
    const nextPendingVersions: Record<string, string> = {};

    for (const [pkg, version] of Object.entries(pendingVersions)) {
      if (packageVersions[pkg]) {
        nextPendingVersions[pkg] = tryPrereleaseInc(pkg, version);
      } else {
        bumpInfo.packageInfos[pkg].version = version;
      }
    }

    pendingVersions = nextPendingVersions;
  }

  setDependentVersions({ bumpInfo, options });

  await performBump(bumpInfo, options);

  if (options.publish || options.packToPath) {
    await publishToRegistry(bumpInfo, options);
  } else {
    console.log('Skipping publish');
  }
}

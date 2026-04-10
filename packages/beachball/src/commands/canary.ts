import semver from 'semver';
import { bumpInMemory } from '../bump/bumpInMemory';
import { performBump } from '../bump/performBump';
import { setDependentVersions } from '../bump/setDependentVersions';
import { listPackageVersions } from '../packageManager/listPackageVersions';
import { publishToRegistry } from '../publish/publishToRegistry';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { CommandContext } from '../types/CommandContext';
import { createCommandContext } from '../monorepo/createCommandContext';

/**
 * Bump and publish a "canary" prerelease version.
 * @param context Command context from `validate()`
 */
export async function canary(options: BeachballOptions, context: CommandContext): Promise<void>;
/** @deprecated Use other signature */
export async function canary(options: BeachballOptions): Promise<void>;
export async function canary(options: BeachballOptions, context?: CommandContext): Promise<void> {
  // eslint-disable-next-line etc/no-deprecated -- compat code
  context ??= createCommandContext(options);

  const bumpInfo = context.bumpInfo || bumpInMemory(options, context);
  const { originalPackageInfos } = context;

  options.keepChangeFiles = true;
  options.generateChangelog = false;

  if (options.all) {
    for (const pkg of Object.keys(originalPackageInfos)) {
      bumpInfo.modifiedPackages.add(pkg);
    }
  }

  const packageVersions = await listPackageVersions([...bumpInfo.modifiedPackages], options);

  for (const pkg of bumpInfo.modifiedPackages) {
    let newVersion = originalPackageInfos[pkg].version;

    do {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      newVersion = semver.inc(newVersion, 'prerelease', options.canaryName || 'canary')!;
    } while (packageVersions[pkg].includes(newVersion));

    bumpInfo.packageInfos[pkg].version = newVersion;
  }

  setDependentVersions(bumpInfo, options);

  await performBump(bumpInfo, options);

  if (options.publish || options.packToPath) {
    await publishToRegistry(bumpInfo, options);
  } else {
    console.log('Skipping publish');
  }
}

import { bumpInMemory } from '../bump/bumpInMemory';
import { getPrereleaseVersion } from '../bump/getPrereleaseVersion';
import { performBump } from '../bump/performBump';
import { setDependentVersions } from '../bump/setDependentVersions';
import { listPackageVersions } from '../packageManager/listPackageVersions';
import { publishToRegistry } from '../publish/publishToRegistry';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { CommandContext } from '../types/CommandContext';
import { createCommandContext } from '../monorepo/createCommandContext';

/**
 * Bump and publish a prerelease version (e.g. for canary, beta, or per-PR releases).
 *
 * For each modified package, the new version is computed as
 * `${target}-${prereleasePrefix}.<n>`, where `target` is the result of applying the change
 * type from change files to the current release version (with any prerelease component
 * stripped), and `<n>` is the next available counter according to existing published
 * versions.
 *
 * Unlike `bump`/`publish`, this command does not commit changes back to git or delete
 * change files.
 */
export async function prerelease(options: BeachballOptions, context: CommandContext): Promise<void>;
/** @deprecated Use other signature */
export async function prerelease(options: BeachballOptions): Promise<void>;
export async function prerelease(options: BeachballOptions, context?: CommandContext): Promise<void> {
  // eslint-disable-next-line etc/no-deprecated -- compat code
  context ??= createCommandContext(options);

  // Default the suffix to "prerelease" so the command works with zero configuration.
  const prereleasePrefix = options.prereleasePrefix || 'prerelease';

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
    const currentVersion = originalPackageInfos[pkg].version;
    const changeType = bumpInfo.calculatedChangeTypes[pkg] || 'none';

    bumpInfo.packageInfos[pkg].version = getPrereleaseVersion({
      currentVersion,
      changeType,
      prereleasePrefix,
      identifierBase: options.identifierBase,
      existingVersions: packageVersions[pkg] || [],
    });
  }

  setDependentVersions({ bumpInfo, options });

  await performBump(bumpInfo, options);

  if (options.publish || options.packToPath) {
    await publishToRegistry(bumpInfo, options);
  } else {
    console.log('Skipping publish');
  }
}

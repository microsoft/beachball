import path from 'node:path';
import type { PGraph } from 'p-graph';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { PackageInfos } from '../types/PackageInfo';

/**
 * Call a hook for each affected package. Does nothing if the hook is undefined.
 *
 * @param hook The hook function to call for each affected package.
 * @param packageGraph Pre-built graph to reuse across multiple hook calls. Nodes are package names.
 * In real call scenarios, this will always be defined if `hook` is defined.
 */
export async function callHook(
  hookName: 'prebump' | 'postbump' | 'prepublish' | 'postpublish',
  packageGraph: PGraph | undefined,
  packageInfos: PackageInfos,
  options: Pick<BeachballOptions, 'hooks' | 'concurrency'>
): Promise<void> {
  if (!options.hooks?.[hookName] || !packageGraph) {
    return;
  }

  await packageGraph.run({
    concurrency: options.concurrency,
    continue: false,
    run: async (pkgName: string): Promise<void> => {
      // Ignore nonexistent packages in case of theoretical race conditions or something
      const packageInfo = packageInfos[pkgName];
      if (packageInfo) {
        const packagePath = path.dirname(packageInfo.packageJsonPath);
        if (hookName === 'prebump') {
          // prevent consumers from modifying packageInfos, which likely would not fully work
          // as they intended
          await options.hooks?.[hookName]?.(packagePath, packageInfo.name, packageInfo.version);
        } else {
          await options.hooks?.[hookName]?.(packagePath, packageInfo.name, packageInfo.version, packageInfos);
        }
      }
    },
  });
}

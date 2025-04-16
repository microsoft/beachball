import path from 'path';
import type { HooksOptions } from '../types/BeachballOptions';
import type { PackageInfo, PackageInfos } from '../types/PackageInfo';
import { getPackageGraph } from '../monorepo/getPackageGraph';

type HookName = 'prebump' | 'postbump' | 'prepublish' | 'postpublish';

/**
 * Call a hook for each affected package. Does nothing if the hook is undefined.
 */
export async function callHook(params: {
  hooks: HooksOptions | undefined;
  hookName: HookName;
  affectedPackages: Iterable<string>;
  packageInfos: PackageInfos;
  concurrency: number;
}): Promise<void> {
  const { hooks, hookName, affectedPackages, packageInfos, concurrency } = params;

  const hook = hooks?.[hookName];
  if (!hook) {
    return;
  }

  const callHookInternal = async (packageInfo: PackageInfo) => {
    const packagePath = path.dirname(packageInfo.packageJsonPath);
    try {
      await hook(packagePath, packageInfo.name, packageInfo.version, packageInfos);
    } catch (error) {
      console.error(
        `Error running ${hookName} hook for package ${packageInfo.name}:\n${(error as Error).stack || error}`
      );
      throw error;
    }
  };

  const packageGraph = getPackageGraph(affectedPackages, packageInfos, callHookInternal);

  // p-graph throws an array of errors, which isn't helpful for logging.
  // Instead, catch and log individual errors (above) then throw a single error.
  try {
    await packageGraph.run({
      concurrency: concurrency,
      continue: false,
    });
  } catch {
    const error = new Error(`Error running ${hookName} hook (see above for details)`);
    // The relevant call stack is above
    delete error.stack;
    throw error;
  }
}

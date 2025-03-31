import { getMaxChangeType, MinChangeType } from '../changefile/changeTypes';
import { ChangeType } from '../types/ChangeInfo';
import type { BumpInfo, PackageDependents } from '../types/BumpInfo';

/**
 * This is the core of the bumpInfo dependency bumping logic - done once per change file
 *
 * The algorithm is an iterative graph traversal algorithm (breadth first)
 * - it searches up the parent `dependents` and modifies the "calculatedChangeTypes" entries inside `BumpInfo`
 * - one single root entry from `pkgName` as given by a change file
 * - for all dependents
 *   - apply the `dependentChangeType` as change type
 * - this function is the primary way for package groups to get the same dependent change type by queueing up
 *   all packages within a group to be visited by the loop
 *
 * What it mutates:
 * - bumpInfo.calculatedChangeTypes: updates packages change type modifed by this function
 * - all dependents change types as part of a group update
 *
 * What it does not do:
 * - bumpInfo.calculatedChangeTypes: will not mutate the entryPoint `pkgName` change type
 */
export function updateRelatedChangeType(params: {
  changeFiles: string[];
  bumpInfo: Pick<BumpInfo, 'calculatedChangeTypes' | 'changeFileChangeInfos' | 'packageGroups' | 'packageInfos'>;
  dependents: PackageDependents;
  bumpDeps: boolean;
}): void {
  const { changeFiles, bumpInfo, dependents, bumpDeps } = params;
  const { calculatedChangeTypes, changeFileChangeInfos, packageGroups, packageInfos } = bumpInfo;

  const changeFileSet = new Set<string>(changeFiles);
  const initialPackages = new Set<string>();

  // This mapping of package name to the number of edges pointing to it is used
  // to determine when a package has been fully processed. When the in-degree
  // of a package is zero, it means that all of its dependencies have been
  // processed, and we can safely finalize its change type.
  const inDegree: Record<string, number> = {};

  // This mapping of package name to the list of packages that depend on it is used
  // to walk the dependency graph in reverse-topological order. This is how we know
  // which packages depend on a package that is being processed.
  const outEdges: Record<string, string[]> = {};

  // The queue will be for BFS traversal during graph exploration and
  // modifying inDegree and outEdges and initializing calculatedChangeTypes.
  const queue: string[] = [];
  const intermediateChangeTypes: Record<string, ChangeType> = {};

  const pkgToGroup: Record<string, ReadonlyArray<string>> = {};
  for (const group in packageGroups) {
    const info = packageGroups[group];
    for (const pkg of info.packageNames) {
      pkgToGroup[pkg] = info.packageNames;
    }
  }

  // Visited will be used to keep track of the packages that have
  // already been processed during our forward walk.
  const visited = new Set<string>();

  // Go through the starting packages and update their values.
  for (const info of changeFileChangeInfos) {
    console.log(info);
    if (!changeFileSet.has(info.changeFile)) {
      continue;
    }

    const {
      change: { packageName: pkg, dependentChangeType },
    } = info;

    // Do not do anything if packageInfo is not present: it means this was an invalid changefile that
    // somehow got checked in. (This should have already been caught by readChangeFiles, but just in case.)
    if (!packageInfos[pkg]) {
      continue;
    }

    // In case the caller sent the same package multiple times, we need to make sure we only process it once.
    if (visited.has(pkg)) {
      continue;
    }

    initialPackages.add(pkg);
    visited.add(pkg);
    queue.push(pkg);

    const disallowedChangeTypes = packageInfos[pkg].combinedOptions?.disallowedChangeTypes ?? [];
    intermediateChangeTypes[pkg] = getMaxChangeType(dependentChangeType, MinChangeType, disallowedChangeTypes);

    inDegree[pkg] = 0;
    outEdges[pkg] = [];
  }

  // Walk the dependency graph to construct the DAG again and initialize the topo walk.
  while (queue.length > 0) {
    const subjectPackage = queue.shift()!;
    const outEdgesForSubjectPackage = outEdges[subjectPackage] || [];
    outEdges[subjectPackage] = outEdgesForSubjectPackage;

    const dependentPackages = dependents[subjectPackage];

    if (bumpDeps && dependentPackages?.length) {
      for (const dependentPackage of dependentPackages) {
        if (!visited.has(dependentPackage)) {
          visited.add(dependentPackage);
          queue.push(dependentPackage);
        }
        outEdgesForSubjectPackage.push(dependentPackage);
        inDegree[dependentPackage] = (inDegree[dependentPackage] || 0) + 1;
      }
    }

    // TODO: when we do "locked", or "lock step" versioning, we could simply skip this grouped traversal,
    //       - set the version for all packages in the group in bumpPackageInfoVersion()
    //       - the main concern is how to capture the bump reason in grouped changelog

    const group = pkgToGroup[subjectPackage];

    if (group) {
      for (const packageNameInGroup of group) {
        if (packageNameInGroup === subjectPackage) {
          continue;
        }
        if (!visited.has(packageNameInGroup)) {
          visited.add(packageNameInGroup);
          queue.push(packageNameInGroup);
        }
      }
    }
  }

  // Done with top-down BFS traversal. Time for the topo-order walk.

  for (const pkg of visited) {
    // If the package has no in-degrees, it means that all of its dependencies have been processed.
    // We can safely finalize its change type.
    if ((inDegree[pkg] ?? 0) === 0) {
      queue.push(pkg);
    }
  }

  while (queue.length > 0) {
    const subjectPackage = queue.shift()!;

    const group = pkgToGroup[subjectPackage];

    // If we are part of a group, then we need to select the maximum from all
    // of the packages in the group. This may overwrite the group multiple times
    // if some packages in the group have not been fully explored yet.
    if (group) {
      var curMax = intermediateChangeTypes[subjectPackage];
      for (const packageNameInGroup of group) {
        if (packageNameInGroup === subjectPackage) {
          continue;
        }
        const compare = intermediateChangeTypes[packageNameInGroup];
        curMax = getMaxChangeType(curMax, compare, null);
      }

      for (const packageNameInGroup of group) {
        const disallowedChangeTypes = packageInfos[packageNameInGroup].combinedOptions?.disallowedChangeTypes ?? [];
        intermediateChangeTypes[packageNameInGroup] = getMaxChangeType(intermediateChangeTypes[packageNameInGroup], curMax, disallowedChangeTypes);

        if (!initialPackages.has(packageNameInGroup)) {
          calculatedChangeTypes[packageNameInGroup] = intermediateChangeTypes[packageNameInGroup];
        }
      }
    }

    const changeType = intermediateChangeTypes[subjectPackage] ?? MinChangeType;
    if (!initialPackages.has(subjectPackage)) {
      // If the package is not in the change file set, we need to update its change type
      calculatedChangeTypes[subjectPackage] = changeType;
    }

    for (const pkg of outEdges[subjectPackage]) {
      // Update the current maximum change type for this package.
      const disallowedChangeTypes = packageInfos[pkg].combinedOptions?.disallowedChangeTypes ?? [];

      intermediateChangeTypes[pkg] = getMaxChangeType(
        intermediateChangeTypes[pkg],
        changeType,
        disallowedChangeTypes
      );

      // Lower the in-degree because this "edge" is processed.
      inDegree[pkg] = inDegree[pkg] - 1;

      // If that lowered it to zero, then add to the queue.
      if (inDegree[pkg] === 0) {
        queue.push(pkg);
      }
    }
  }
}

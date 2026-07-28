import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { findPackageRoot, getPackageInfo } from 'workspace-tools';

/**
 * Prints the production dependency tree of a package using the versions actually
 * installed under `node_modules` (resolved via Node's module resolution).
 *
 * Usage:
 *   node scripts/showDependencyTree.ts <package-name> [--dev]
 *
 * - `<package-name>` may be a workspace package (e.g. `beachball`) or any
 *   installed dependency. Defaults to resolving from the current working dir.
 * - `--dev` includes the root package's devDependencies (transitive dev deps are
 *   never installed, so they can't be shown regardless).
 */

/**
 * Resolve the package directory of `depName` as installed relative to `fromDir`,
 * walking up parent `node_modules` folders (matching Node's resolution).
 * Returns undefined if it can't be resolved (e.g. an unmet optional dependency).
 */
function resolvePackage(depName: string, fromDir: string): string | undefined {
  const require = createRequire(path.join(fromDir, 'noop.js'));
  try {
    return path.dirname(require.resolve(`${depName}/package.json`));
  } catch {
    try {
      const resolved = require.resolve(depName);
      return findPackageRoot(resolved);
    } catch {
      // Some packages don't expose package.json via `exports`, so try walking node_modules
      let dir = fromDir;
      while (true) {
        const candidate = path.join(dir, 'node_modules', depName, 'package.json');
        if (fs.existsSync(candidate)) {
          return path.dirname(candidate);
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
          return undefined;
        }
        dir = parent;
      }
    }
  }
}

function printTree(params: {
  packageRoot: string;
  includeDev: boolean;
  prefix?: string;
  isLast: boolean;
  seenPaths?: Set<string>;
  seenIds?: Set<string>;
  isRoot?: boolean;
}): { deduped: boolean; duped: boolean } {
  const { packageRoot, includeDev, prefix = '', isLast, seenPaths = new Set(), seenIds = new Set(), isRoot } = params;
  const packageInfo = getPackageInfo(packageRoot)!;
  const id = `${packageInfo.name}@${packageInfo.version}`;
  // Key dedup on the package's real install location so that distinct copies of
  // the same name@version (installed at different paths) are each expanded.
  const seenKey = fs.realpathSync(packageRoot);

  // Whether any node in this render was collapsed (deduped) or flagged as a
  // duplicate copy of an already-shown version.
  let deduped = false;
  let duped = false;

  if (isRoot) {
    console.log(id);
  } else {
    const connector = isLast ? '└── ' : '├── ';
    // If this exact install location was already expanded elsewhere, show a
    // placeholder instead of repeating the (possibly large) subtree.
    if (seenPaths.has(seenKey)) {
      console.log(`${prefix}${connector}${id} (deduped)`);
      return { deduped: true, duped: false };
    }
    // New install path, but if this exact name@version was already shown at a
    // different path, it's a duplicate copy of the same version.
    duped = seenIds.has(id);
    console.log(`${prefix}${connector}${id}${duped ? ' (❗️ dupe)' : ''}`);
  }

  seenPaths.add(seenKey);
  seenIds.add(id);

  const deps = {
    ...packageInfo.dependencies,
    ...packageInfo.peerDependencies,
    ...packageInfo.optionalDependencies,
    ...(isRoot && includeDev ? packageInfo.devDependencies : undefined),
  };
  const names = Object.keys(deps).sort();

  const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');

  for (const depName of names) {
    const childIsLast = depName === names.at(-1);
    const childRoot = resolvePackage(depName, packageRoot);
    if (!childRoot) {
      const connector = childIsLast ? '└── ' : '├── ';
      console.log(`${childPrefix}${connector}${depName} (unmet)`);
continue;
    }
    const child = printTree({
      packageRoot: childRoot,
      includeDev,
      prefix: childPrefix,
      isLast: childIsLast,
      seenPaths,
      seenIds,
    });
    deduped = deduped || child.deduped;
    duped = duped || child.duped;
  }

  return { deduped, duped };
}

function main(): void {
  const args = process.argv.slice(2);
  const includeDev = args.includes('--dev');
  const target = args.find(arg => !arg.startsWith('--'));

  let packageRoot: string | undefined;
  if (target) {
    packageRoot = resolvePackage(target, process.cwd());
    if (!packageRoot) {
      console.error(`Unable to resolve installed package "${target}" from ${process.cwd()}`);
      process.exit(1);
    }
  } else {
    packageRoot = findPackageRoot(process.cwd());
    if (!packageRoot) {
      console.error(`No package.json found in ${process.cwd()}`);
      process.exit(1);
    }
  }

  const { deduped, duped } = printTree({ packageRoot, includeDev, isLast: true, isRoot: true });

  if (deduped) {
    console.log('\ndeduped = multiple references to a single copy on disk');
  }
  if (duped) {
    console.log('❗️ dupe = multiple copies of the same name@version installed at different paths');
  }
}

main();

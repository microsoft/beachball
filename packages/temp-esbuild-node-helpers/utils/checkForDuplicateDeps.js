import fs from 'fs';
import path from 'path';
import { bulletedList, colors, logError } from './logHelpers.js';
/**
 * Check the metafile to determine if there are any duplicate dependencies in the bundle
 * @param packageRoot The root directory of the package being bundled
 * @param inputPaths List of input paths detected by esbuild (keys of `metafile.inputs`)
 * @param errorDupePackages List of regex patterns for packages that should trigger an error if
 * duplicates are found
 */
export function checkForDuplicateDeps(packageRoot, inputPaths, errorDupePackages) {
  // Find all the paths to external dependencies.
  // There may be multiple files from the same dep, so the set dedupes them.
  const depPackages = new Set();
  for (const input of inputPaths) {
    const pathParts = input.split('/');
    const storeIndex = pathParts.indexOf('.store');
    const nodeModulesIndex = pathParts.indexOf('node_modules');
    if (storeIndex !== -1) {
      depPackages.add(pathParts.slice(0, storeIndex + 2).join('/') + '/package');
    } else if (nodeModulesIndex !== -1) {
      const pkgSegment = pathParts[nodeModulesIndex + 1];
      const depPath = pathParts.slice(0, nodeModulesIndex + (pkgSegment.startsWith('@') ? 3 : 2)).join('/');
      depPackages.add(depPath);
    }
  }
  if (depPackages.size) {
    console.log(`Included external dependencies:\n${bulletedList([...depPackages].sort())}\n`);
  }
  // Make a mapping from dependency name to versions in case there are multiple versions.
  const depPaths = {};
  for (const depPath of depPackages) {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(packageRoot, depPath, 'package.json'), 'utf8'));
    depPaths[pkg.name] ??= [];
    depPaths[pkg.name].push({ version: pkg.version, path: depPath });
  }
  // If there are multiple versions of a package, this isn't ideal but can sometimes be necessary
  // (different things depending on incompatible versions).
  const allDupeDeps = Object.entries(depPaths)
    .filter(([_, paths]) => paths.length > 1)
    .map(([name, versions]) => [name, [versions.map(pkg => `${pkg.version} ${pkg.path}`)]]);
  const errorDupeDeps = errorDupePackages
    ? allDupeDeps.filter(([name]) => errorDupePackages?.some(re => re.test(name)))
    : [];
  const warnDupeDeps = allDupeDeps.filter(d => !errorDupeDeps.includes(d));
  if (warnDupeDeps.length) {
    console.warn(
      colors.yellow(
        `${colors.bold('Warning:')} Found multiple versions of the following dependencies in the bundle ` +
          '(this is not ideal but may be unavoidable if deps in the tree use incompatible semver specs):'
      )
    );
    console.warn(colors.yellow(bulletedList(warnDupeDeps.flat(1)) + '\n'));
  }
  if (errorDupeDeps.length) {
    logError(colors.red(`${colors.bold('ERROR:')} Found multiple versions of the following critical dependencies:`));
    console.error(colors.red(bulletedList(errorDupeDeps.flat(1))));
    console.error(
      colors.red(
        // Exceptions can be added if it's not possible to avoid the duplicates.
        '\nPlease attempt to remove these dupes using "yarn set resolution", strategic dep upgrades, ' +
          'or possibly package.json resolutions.\n'
      )
    );
  }
  // Check for multiple physical copies of the same dependency version (usually caused by different
  // peer dependency permutations--see error message below for more details)
  const sameVersionDupes = Object.entries(depPaths)
    .map(([name, versions]) => {
      // most common case: there's only one of a given dep
      if (versions.length === 1) {
        return undefined;
      }
      // Get the version of each copy of the package and group by version.
      const versionsToPaths = {};
      for (const pkg of versions) {
        versionsToPaths[pkg.version] ??= [];
        versionsToPaths[pkg.version].push(pkg.path);
      }
      // Return versions with more than one physical copy.
      return Object.values(versionsToPaths).some(vpaths => vpaths.length > 1)
        ? [name, Object.entries(versionsToPaths)]
        : undefined;
    })
    .filter(Boolean);
  if (sameVersionDupes.length) {
    logError(colors.red(`${colors.bold('ERROR:')} Found multiple copies of the same dependency version:`));
    console.error(colors.red(bulletedList(sameVersionDupes.flat(1))));
    console.error(
      colors.red(
        // Past duplicated packages had peer deps on @opentelemetry/api, and the difference was that
        // for some reason the node_modules of one copy was missing @opentelemetry/api.
        // Using packageExtensions to add @opentelemetry/api as a *dependency* got rid of the dupes.
        '\nThis may be caused by the yarn pnpm linker making multiple "virtual" folders for the same package ' +
          'version when different permutations of peer deps and/or resolutions are present.' +
          '\n\nPossible fix: look in yarn.lock to see if the duplicated package has any peer deps, ' +
          'and use yarnrc.yml packageExtensions to add the peer as a dependency.\n'
      )
    );
  }
  return { errorDupeDeps, warnDupeDeps, sameVersionDupes };
}
//# sourceMappingURL=checkForDuplicateDeps.js.map

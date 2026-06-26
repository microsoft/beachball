import fs from 'fs';
import { fileURLToPath } from 'url';
import { findRealPackageJson } from "../utils/findRealPackageJson.js";
import { logError } from "../utils/logHelpers.js";
import { writeNotice } from "./writeNotice.js";
import { BundleError } from "../utils/BundleError.js";
import { analyzeLicenses } from "./analyzeLicenses.js";
/**
 * esbuild plugin to generate a NOTICE.txt file with license information for all dependencies
 * that are included in the bundle (excluding any packages from the same repo).
 *
 * This relies on the info published with the package (in package.json or certain predefined files)
 * and doesn't check github for other related files that aren't published.
 *
 * Other implementations:
 * - There's a service [ClearlyDefined](https://clearlydefined.io) which is made by Microsoft
 *   and used by CG to generate notices, and is more comprehensive with checking npm/github.
 *   However, the public API is badly-documented, subject to unclear rate limits, and not reliable
 *   (can't find some packages for the notice even though they exist in its database in the UI).
 * - https://github.com/upupming/esbuild-plugin-license (only writes name, version, license type)
 * - https://github.com/mhassan1/yarn-plugin-licenses (covers whole repo; similar formatting used here)
 * - https://github.com/codepunkt/webpack-license-plugin (json output for webpack only)
 */
export function licensePlugin(options) {
    const includedPackages = {};
    const packageCache = new Map();
    return {
        name: 'cloudpack-license-plugin',
        setup(build) {
            // On load, track all the packages that are included
            // (any errors will be caught and logged by esbuild itself)
            build.onLoad({ filter: /.*/ }, (args) => {
                // esbuild docs make it sound like this can be a file URL or arbitrary URL
                let filePath = args.path.startsWith('file://') ? fileURLToPath(args.path) : args.path;
                // if this is something besides a filesystem path, ignore it
                if (!fs.existsSync(filePath)) {
                    return null;
                }
                // use the realpath for deduping store files
                filePath = fs.realpathSync(filePath);
                if (!filePath.includes('node_modules')) {
                    return null;
                }
                const { packageRoot, packageJson } = findRealPackageJson(filePath, packageCache);
                if (!includedPackages[packageRoot] && packageJson.name !== options.packageName) {
                    includedPackages[packageRoot] = packageJson;
                }
                return null;
            });
            build.onEnd(() => {
                // We have to catch any errors and explicitly log them since esbuild doesn't automatically
                // log thrown errors at this point, and our wrapper that calls esbuild assumes errors have
                // already been logged.
                const licenseResult = analyzeLicenses(includedPackages, options);
                if ('error' in licenseResult) {
                    const errorStr = licenseResult.error;
                    logError(errorStr + '\n');
                    // Include the full text despite having logged it since this can make debugging easier
                    throw new BundleError(errorStr, { alreadyLogged: true });
                }
                writeNotice(licenseResult.dependencies, options.absOutDir, options.excludeFromNotice);
            });
        },
    };
}
//# sourceMappingURL=licensePlugin.js.map
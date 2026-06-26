import type { Plugin } from 'esbuild';
import type { LicensePluginOptions } from './types.ts';
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
export declare function licensePlugin(options: LicensePluginOptions): Plugin;
//# sourceMappingURL=licensePlugin.d.ts.map
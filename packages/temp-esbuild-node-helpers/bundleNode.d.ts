import * as esbuild from 'esbuild';
import type { LicensePluginOptions } from './license/types.ts';
import { type VerifyPackageJsonOptions } from './utils/verifyPackageJson.ts';
export interface BundleNodeOptions
  extends VerifyPackageJsonOptions, Pick<LicensePluginOptions, 'unacceptableLicenseTest' | 'excludeFromNotice'> {
  /** Working directory, usually the package root (it will find the actual root from here) */
  cwd: string;
  /** Clean output before building (highly recommended due to hashed filenames) @default true */
  clean?: boolean;
  /** Extra options for esbuild */
  esbuildOptions?: Omit<
    esbuild.BuildOptions,
    'absWorkingDir' | 'bundle' | 'entryPoints' | 'metafile' | 'outdir' | 'platform'
  >;
  /** Error if there are duplicate packages matching any of these regexps */
  errorDupePackages?: RegExp[];
  /** If true, write esbuild's metafile and analysis to disk under `<packageRoot>/temp` */
  writeMetafile?: boolean;
}
/**
 * Bundle a node package with esbuild. By default it creates an ESM bundle for Node 22+.
 * `dependencies` will be externalized, but all other referenced deps will be bundled.
 *
 * It also writes a `NOTICE.txt` file at the package root with license information for dependencies
 * from outside the current repo, and if `options.unacceptableLicenseTest` is provided, errors if
 * any packages have disallowed licenses. It also errors if a package is missing license info.
 *
 * Before bundling, it checks for proper configuration of `package.json`:
 * - `NOTICE.txt` and the output directory are included in `files`
 * - If `verifyExportPaths` is set, `exports` are correctly mapped
 * - If `verifyTypesInFiles` is true, `lib/** /*.d.ts` is included in `files`
 *
 * After bundling, it checks for duplicate dependencies:
 * - Always error if there are multiple copies of the same version of a dependency
 * - Optionally error if any dependencies match the regexps provided in `errorDupePackages`
 *
 * (Some of the current logic and messages assume the consuming repo is using yarn v4, likely
 * with `nodeLinker: 'pnpm'`, but it can be updated as needed for other linkers and/or managers.)
 */
export declare function bundleNode(options: BundleNodeOptions): Promise<void>;
//# sourceMappingURL=bundleNode.d.ts.map

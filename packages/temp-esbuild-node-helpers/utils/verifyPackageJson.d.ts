import type { PackageJson } from '../types.ts';
export interface VerifyPackageJsonOptions {
  /**
   * Mapping from path under `outDir` to original file path. Original paths are usually relative to
   * the package root (with forward slashes) but could also be files in other packages.
   */
  entryPoints: Record<string, string>;
  /** Relative directory for output files with forward slashes */
  outDir: string;
  /** Relative directory to write the NOTICE.txt file (default package root) */
  noticeDir?: string;
  /**
   * If set, verify that the output file is correctly referenced in package.json `exports`.
   * Top-level keys match `entry`. Next level keys match package.json `exports` keys.
   * Value is the condition for that export key (use `'default'` to allow paths with no condition).
   */
  verifyExportPaths?: {
    [entryKey: string]: {
      key: string;
      condition: string;
    };
  };
  /**
   * Verify contents of package.json `files` field
   * @default true
   */
  verifyFiles?: boolean;
  /**
   * If true, verify `lib/** /*.d.ts` (without the space) is included in package.json `files`.
   * If a string, verify it's included in `files`.
   */
  verifyTypesInFiles?: true | string;
}
export declare function verifyPackageJson(options: VerifyPackageJsonOptions, packageJson: PackageJson): void;
//# sourceMappingURL=verifyPackageJson.d.ts.map

import type { PackageJson } from '../types.ts';
import type { Dependency, LicensePluginOptions } from './types.ts';
/**
 * Analyze licenses for all included packages.
 * @param includedPackages Mapping from package root to package.json for all packages in the bundle
 */
export declare function analyzeLicenses(includedPackages: Record<string, PackageJson>, options: Pick<LicensePluginOptions, 'packageRoot' | 'unacceptableLicenseTest'>): {
    dependencies: Dependency[];
} | {
    error: string;
};
//# sourceMappingURL=analyzeLicenses.d.ts.map
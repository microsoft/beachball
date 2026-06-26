export interface LicensePluginOptions {
    /** Name of the package being bundled */
    packageName: string;
    /** Root directory of the package being bundled */
    packageRoot: string;
    /** Absolute output directory for the NOTICE.txt file */
    absOutDir: string;
    /** Function to determine if a dependency should be excluded from the NOTICE.txt file */
    excludeFromNotice?: (dependency: Dependency) => boolean;
    /**
     * Return true if the license is unacceptable.
     * You can use `unacceptableLicenseTest` exported from this package as a default.
     *
     * @param licenseName A valid SPDX license expression (without "LicenseRef"), "UNLICENSED",
     * "SEE LICENSE IN <filename>", or null if no valid license info was found in package.json.
     */
    unacceptableLicenseTest?: (licenseName: string | null) => boolean;
}
/** Dependency format used internally by `licensePlugin` */
export interface Dependency {
    name: string;
    version: string;
    author: string | undefined;
    maintainers: string | undefined;
    contributors: string | undefined;
    url: string | undefined;
    license: string | null;
    licenseText: string | undefined;
    noticeText: string | undefined;
}
export interface ErrorDependency extends Pick<Dependency, 'name' | 'version'> {
    path: string;
    issues: string[];
}
//# sourceMappingURL=types.d.ts.map
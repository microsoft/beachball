/**
 * Check the metafile to determine if there are any duplicate dependencies in the bundle
 * @param packageRoot The root directory of the package being bundled
 * @param inputPaths List of input paths detected by esbuild (keys of `metafile.inputs`)
 * @param errorDupePackages List of regex patterns for packages that should trigger an error if
 * duplicates are found
 */
export declare function checkForDuplicateDeps(
  packageRoot: string,
  inputPaths: string[],
  errorDupePackages: RegExp[] | undefined
): {
  errorDupeDeps: [string, string[][]][];
  warnDupeDeps: [string, string[][]][];
  sameVersionDupes: [string, string[][]][];
};
//# sourceMappingURL=checkForDuplicateDeps.d.ts.map

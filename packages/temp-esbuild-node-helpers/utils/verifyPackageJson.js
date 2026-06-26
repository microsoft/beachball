import { BundleError } from './BundleError.js';
import { noticeFilename } from '../license/writeNotice.js';
export function verifyPackageJson(options, packageJson) {
  const { entryPoints, outDir, verifyExportPaths, verifyTypesInFiles, verifyFiles = true, noticeDir = '' } = options;
  if (verifyFiles && !packageJson.files) {
    throw new BundleError('package.json is missing "files" field');
  }
  if (verifyTypesInFiles) {
    const typesGlob = typeof verifyTypesInFiles === 'string' ? verifyTypesInFiles : 'lib/**/*.d.ts';
    if (!packageJson.files?.includes(typesGlob)) {
      throw new BundleError(`package.json "files" must include "${typesGlob}"`);
    }
  }
  const noticePath = `${noticeDir ? `${noticeDir}/` : ''}${noticeFilename}`;
  if (verifyFiles && !packageJson.files?.includes(noticePath)) {
    throw new BundleError(`package.json "files" must include "${noticePath}"`);
  }
  if (
    verifyFiles &&
    !packageJson.files?.includes(outDir) &&
    !packageJson.files?.some(f => f.startsWith(`${outDir}/`))
  ) {
    throw new BundleError(`package.json "files" must include "${outDir}"`);
  }
  if (verifyExportPaths) {
    // Verify the package.json exports map and published files are set up properly
    const exports = packageJson.exports;
    if (!exports || typeof exports === 'string') {
      throw new BundleError(
        `package.json "exports" must be an object when verifyExportPaths option is enabled (current: ${exports && JSON.stringify(exports)})`
      );
    }
    const entryKeys = new Set(Object.keys(entryPoints));
    for (const [entryKey, { key, condition }] of Object.entries(verifyExportPaths)) {
      if (!entryKeys.delete(entryKey)) {
        throw new BundleError(`verifyExportPaths includes a key "${entryKey}" that is missing from entryPoints`);
      }
      const outFile = `${outDir}/${entryKey}.js`;
      const exportsValue = exports[key];
      const exportsFile =
        typeof exportsValue === 'string'
          ? condition === 'default'
            ? exportsValue
            : undefined
          : exportsValue?.[condition];
      if (exportsFile !== `./${outFile}`) {
        throw new BundleError(
          `package.json exports["${key}"] must include { "${condition}": "./${outFile}" } (current: ${exportsValue && JSON.stringify(exportsValue)})`
        );
      }
    }
    if (entryKeys.size) {
      throw new BundleError(
        `verifyExportPaths did not reference the following entry points: ${[...entryKeys].join(', ')}`
      );
    }
  }
}
//# sourceMappingURL=verifyPackageJson.js.map

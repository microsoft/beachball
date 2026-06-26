import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { licensePlugin } from './license/licensePlugin.js';
import { BundleError } from './utils/BundleError.js';
import { checkForDuplicateDeps } from './utils/checkForDuplicateDeps.js';
import { findRealPackageJson } from './utils/findRealPackageJson.js';
import { colors, logError } from './utils/logHelpers.js';
import { verifyPackageJson } from './utils/verifyPackageJson.js';
/**
 * This is added at the top of every file and makes CJS globals work in esbuild output.
 * We need `require()` for bundled CJS that loads Node internals or native packages.
 * The bundled CJS deps also use `__filename` and `__dirname` in a couple places.
 * https://github.com/evanw/esbuild/issues/946#issuecomment-814703190
 *
 * `var` is used instead of `const` to avoid re-declaration issues if a bundled package applies the
 * same workaround. The odd `createRequire` import name is for similar reasons.
 */
const cjsGlobalsHeader = `// @ts-nocheck
/* eslint-disable */
import { createRequire as esbuildNodeHelpersCreateRequire } from 'node:module';
var require = esbuildNodeHelpersCreateRequire(import.meta.url);
var __filename = import.meta.filename;
var __dirname = import.meta.dirname;`;
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
export async function bundleNode(options) {
  const { cwd, entryPoints, outDir, noticeDir, errorDupePackages, esbuildOptions, clean = true } = options;
  console.log();
  console.log('Bundling package with esbuild...\n');
  const { packageJson, packageRoot } = findRealPackageJson(cwd);
  verifyPackageJson(options, packageJson);
  if (clean) {
    // Remove old output. This is more important with esbuild due to hashed filenames.
    fs.rmSync(path.join(packageRoot, outDir), { force: true, recursive: true });
  }
  // The header defining require() is needed with ESM output, but not if the user changed the format
  const format = esbuildOptions?.format ?? 'esm';
  const jsBanner = format === 'esm' ? cjsGlobalsHeader : undefined;
  let result;
  try {
    result = await esbuild.build({
      splitting: format === 'esm',
      treeShaking: true,
      target: ['node22'],
      // some packages rely on specific names in instanceof checks
      keepNames: true,
      // log errors, warnings, and a summary (which includes the output file sizes)
      logLevel: 'info',
      // less important if not minifying, and bloats package size
      // sourcemap: true,
      ...esbuildOptions,
      // Critical options
      absWorkingDir: packageRoot,
      entryPoints: entryPoints,
      outdir: outDir,
      platform: 'node',
      bundle: true,
      format,
      // Exclude non-dev dependencies from the bundle. In a bundled package, generally the only
      // dependencies should be other internal packages and anything with native binaries.
      // (It appears node built-ins are automatically externalized with platform: 'node'.)
      external: [
        ...Object.keys({
          ...packageJson.dependencies,
          ...packageJson.peerDependencies,
          ...packageJson.optionalDependencies,
        }),
        ...(esbuildOptions?.external || []),
      ],
      plugins: [
        licensePlugin({
          packageName: packageJson.name,
          packageRoot,
          absOutDir: noticeDir ? path.join(packageRoot, noticeDir) : packageRoot,
          unacceptableLicenseTest: options.unacceptableLicenseTest,
          excludeFromNotice: options.excludeFromNotice,
        }),
        ...(esbuildOptions?.plugins || []),
      ],
      banner: {
        ...esbuildOptions?.banner,
        js: [esbuildOptions?.banner?.js, jsBanner].filter(Boolean).join('\n'),
      },
      metafile: true,
    });
  } catch (err) {
    const failure = err;
    if (failure.errors.some(e => e.text.includes('Could not resolve') && e.location?.file.includes('.store'))) {
      console.log(
        `\n${colors.red(colors.bold('NOTE:'))} Packages that could not be found are usually missing peers, ` +
          `which may not be specified properly for strict installation layouts. ` +
          `You can work around this by updating ${colors.bold('yarnrc.yml packageExtensions')} to ` +
          `include the missing package as a dependency or peerDependency of the importing package.`
      );
    }
    const msg = `Bundling failed with ${failure.errors.length} error(s)!`;
    logError(colors.red(colors.bold(msg + '\n')));
    throw new BundleError(msg, { alreadyLogged: true, cause: err });
  }
  if (options.writeMetafile) {
    // Write the metafile and analysis to disk for inspection.
    const tmpDir = path.join(packageRoot, 'temp');
    fs.mkdirSync(tmpDir, { recursive: true }); // do nothing if it exists
    fs.writeFileSync(path.join(tmpDir, 'esbuild-metafile.json'), JSON.stringify(result.metafile, null, 2));
    const analysis = await esbuild.analyzeMetafile(result.metafile, { verbose: true });
    fs.writeFileSync(path.join(tmpDir, 'esbuild-metafile-analysis.txt'), analysis);
  }
  // Check for duplicate dependencies in the bundle.
  const { errorDupeDeps, warnDupeDeps, sameVersionDupes } = checkForDuplicateDeps(
    packageRoot,
    Object.keys(result.metafile.inputs),
    errorDupePackages
  );
  if (errorDupeDeps.length || sameVersionDupes.length) {
    throw new BundleError('Duplicate dependencies detected (see above)', { alreadyLogged: true });
  }
  const hasDupeWarnings = !!warnDupeDeps.length;
  const hasWarnings = hasDupeWarnings || !!result.warnings.length;
  const color = hasWarnings ? 'yellow' : 'green';
  // With logLevel set to 'info', esbuild will handle the basic logging.
  console.log(colors[color](colors.bold(`Bundling completed${hasWarnings ? ' with warnings (see above)' : '!'}\n`)));
}
//# sourceMappingURL=bundleNode.js.map

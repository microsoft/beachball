import esbuild from 'esbuild';
// @ts-expect-error -- types are missing from exports (but we don't use the options anyway)
import licensePlugin from 'esbuild-plugin-license';
import fs from 'fs';
import path from 'path';
import { findPackageRoot } from '../findPackageRoot.js';

const entryFileRel = 'src/index.ts';
const outDirRel = 'dist';

const requireHeader = `
// @ts-nocheck
/* eslint-disable */
import { createRequire as topLevelCreateRequire } from 'node:module';
import topLevelPath from 'node:path';
import topLevelUrl from 'node:url';
const require = topLevelCreateRequire(import.meta.url);
const __filename = topLevelUrl.fileURLToPath(import.meta.url);
const __dirname = topLevelPath.dirname(__filename);`.trim();

export default async function bundle() {
  const packageRoot = findPackageRoot();
  if (packageRoot !== process.cwd()) {
    process.chdir(packageRoot);
  }

  fs.rmSync(path.join(packageRoot, outDirRel), { force: true, recursive: true });

  /** @type {import('esbuild').BuildResult} */
  let result;
  try {
    result = await esbuild.build({
      entryPoints: [entryFileRel],
      outdir: outDirRel,
      bundle: true,
      treeShaking: true,
      format: 'esm',
      platform: 'node',
      target: ['node24'],
      banner: {
        // This is added at the top of every file and makes CJS globals work in esbuild output.
        // We need require() for bundled CJS that loads Node internals or native packages.
        // The bundled CJS deps also use __filename and __dirname in a couple places.
        // https://github.com/evanw/esbuild/issues/946#issuecomment-814703190
        js: requireHeader,
      },
      minify: true,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      plugins: [licensePlugin()],
      // in case packages rely on specific names in instanceof checks
      keepNames: true,
      // log errors, warnings, and a summary (which includes the output file sizes)
      logLevel: 'info',
    });
  } catch {
    // The issue should already have been logged by esbuild
    process.exit(1);
  }

  const hasWarnings = !!result.warnings.length;
  // With logLevel set to 'info', esbuild will handle the basic logging.
  console.log(`\nBundling completed${hasWarnings ? ' with warnings (see above)' : '!'}\n`);
}

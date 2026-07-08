import { bundleNode, unacceptableLicenseTest, BundleError } from '@ms-cloudpack/esbuild-node-helpers';
import fs from 'fs';
import path from 'path';
import { findPackageRoot } from 'workspace-tools';

const packageRoot = findPackageRoot(process.cwd());
if (!packageRoot) {
  console.error('Unable to find package root from', process.cwd());
  process.exit(1);
}
// Don't use .mjs extension on actions (mainly to avoid touching a generated file and re-triggering
// a bunch of meaningless alerts).
// Use an explicit .mjs extension on the other bundles since they may be copied.
const useMjs = !fs.existsSync(path.join(packageRoot, 'action.yaml'));

// entry: relative path to entry file
// out: extensionless name of output file (relative to dist)
const [entry = 'src/index.ts', out = 'index'] = process.argv.slice(2);

await bundleNode({
  cwd: packageRoot,
  entryPoints: { [out]: entry },
  outDir: 'dist',
  noticeDir: 'dist',
  verifyFiles: false,
  esbuildOptions: {
    outExtension: useMjs ? { '.js': '.mjs' } : undefined,
    // currently for the packages in this repo, nothing is externalized
    external: [],
    // ensure files can be copy-pasted
    splitting: false,
  },
  unacceptableLicenseTest,
  excludeFromNotice: dep => dep.name.startsWith('@azure/') && dep.license === 'MIT',
}).catch(err => {
  if (!(err instanceof BundleError && err.alreadyLogged)) {
    console.error(err.stack || String(err));
  }
  process.exit(1);
});

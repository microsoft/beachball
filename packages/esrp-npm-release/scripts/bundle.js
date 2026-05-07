// @ts-check
import { bundleNode, unacceptableLicenseTest, BundleError } from '@ms-cloudpack/esbuild-node-helpers';
import path from 'path';

const packageRoot = path.resolve(import.meta.dirname, '..');

await bundleNode({
  cwd: packageRoot,
  entryPoints: {
    index: 'src/index.ts',
  },
  outDir: 'dist',
  unacceptableLicenseTest,
}).catch(err => {
  if (!(err instanceof BundleError && err.alreadyLogged)) {
    console.error(err.stack || String(err));
  }
  process.exit(1);
});

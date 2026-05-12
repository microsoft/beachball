import { bundleNode, unacceptableLicenseTest, BundleError } from '@ms-cloudpack/esbuild-node-helpers';
import { findPackageRoot } from 'workspace-tools';

const packageRoot = findPackageRoot(process.cwd());
if (!packageRoot) {
  console.error('Unable to find package root from', process.cwd());
  process.exit(1);
}

await bundleNode({
  cwd: packageRoot,
  entryPoints: {
    index: 'src/index.ts',
  },
  outDir: 'dist',
  noticeDir: 'dist',
  verifyFiles: false,
  esbuildOptions: { splitting: false },
  unacceptableLicenseTest,
  excludeFromNotice: dep => dep.name.startsWith('@azure/') && dep.license === 'MIT',
}).catch(err => {
  if (!(err instanceof BundleError && err.alreadyLogged)) {
    console.error(err.stack || String(err));
  }
  process.exit(1);
});

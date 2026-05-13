import fs from 'fs';
import nanoSpawn, { SubprocessError } from 'nano-spawn';
import path from 'path';
import { findPackageRoot } from '../findPackageRoot.js';

const outDirRel = 'lib';

export default async function build(/** @type {string[]} */ additionalArgs) {
  const packageRoot = findPackageRoot();

  fs.rmSync(path.join(packageRoot, outDirRel), { force: true, recursive: true });

  try {
    await nanoSpawn(
      'tsc',
      [
        '-p',
        'tsconfig.json',
        // --pretty must be manually specified when running programmitically (config is ignored)
        '--pretty',
        ...additionalArgs,
      ],
      { cwd: packageRoot, preferLocal: true, stdio: 'inherit' },
    );
  } catch (err) {
    if (err instanceof SubprocessError) {
      // error should have already been logged due to stdio: 'inherit'
      process.exit(err.exitCode || 1);
    } else {
      throw err;
    }
  }
}

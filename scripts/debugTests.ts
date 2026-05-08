import jest from 'jest';
import { findPackageRoot } from 'workspace-tools';

const args = process.argv.slice(2);

function start(): Promise<void> {
  const packagePath = findPackageRoot(process.cwd()) || process.cwd();

  process.chdir(packagePath);

  console.log(`Starting Jest debugging at: ${packagePath}`);

  return jest.run(['--runInBand', '--watch', '--testTimeout=999999999', ...args]);
}

start().catch((err: Error) => {
  console.error(err?.stack || err);
  process.exit(1);
});

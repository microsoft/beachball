import execa from 'execa';
import { paths } from './paths.ts';

const defaults: execa.Options = {
  preferLocal: true,
  cwd: paths.renovateRoot,
  stdio: 'inherit',
  all: true,
  reject: true,
};

/**
 * Run a binary provided by a node module (see {@link defaults})
 */
export function runBin(bin: string, args: string[], opts?: execa.Options): execa.ExecaChildProcess {
  console.log(`Running: ${bin} ${args.join(' ')}`);
  return execa(bin, args, { ...defaults, ...opts });
}

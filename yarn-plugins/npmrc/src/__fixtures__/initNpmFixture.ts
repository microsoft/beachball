import { tmpdir } from '@microsoft/beachball-test-utilities';
import fs from 'node:fs';
import path from 'node:path';
import which from 'which';

/**
 * Initialize npmrc files in a temporary directory for testing.
 * Returns the relevant paths and the env to pass to npm config init.
 */
export function initNpmFixture(params: {
  /** @default ''' */
  userNpmrc?: string;
  /** @default ''' */
  globalNpmrc?: string;
  /** Project npmrc is only created if this is set */
  projectNpmrc?: string;
}): {
  env: Record<string, string>;
  projectRoot: string;
  npmPath: string;
  userNpmrcPath: string;
  globalNpmrcPath: string;
  /** Only set if `projectNpmrc` was set */
  projectNpmrcPath?: string;
} {
  const projectRoot = tmpdir({ prefix: 'yarn-plugin-npmrc-' });
  const userNpmrcPath = path.join(projectRoot, 'user.npmrc');
  const globalNpmrcPath = path.join(projectRoot, 'global.npmrc');
  let projectNpmrcPath: string | undefined;

  if (params.userNpmrc) {
    fs.writeFileSync(userNpmrcPath, params.userNpmrc || '');
  }
  if (params.globalNpmrc) {
    fs.writeFileSync(globalNpmrcPath, params.globalNpmrc || '');
  }
  if (params.projectNpmrc) {
    projectNpmrcPath = path.join(projectRoot, '.npmrc');
    fs.writeFileSync(projectNpmrcPath, params.projectNpmrc);
  }

  return {
    env: {
      HOME: projectRoot,
      npm_config_globalconfig: globalNpmrcPath,
      npm_config_userconfig: userNpmrcPath,
    },
    npmPath: fs.realpathSync(which.sync('npm')),
    projectRoot,
    userNpmrcPath,
    globalNpmrcPath,
    projectNpmrcPath,
  };
}

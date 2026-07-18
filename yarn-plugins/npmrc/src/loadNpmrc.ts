import NpmConfig from '@npmcli/config';
import fs from 'fs';
import which from 'which';
import { pluginName } from './constants.js';
import { throwError } from './errors.js';

/**
 * Read the effective npm config, with the same logic as npm: applying `process.env.npm_config_*`,
 * project config, user config, global config.
 * @returns The loaded and validated config object
 */
export async function loadNpmrc(params: {
  /** Root of the whole project (location of `yarn.lock` and root `package.json`) */
  projectRoot: string;
  /** Root of the current workspace/package (may be same as `projectRoot`) */
  workspaceRoot: string;
}): Promise<NpmConfig> {
  let npmPath = '';
  try {
    npmPath = fs.realpathSync(which.sync('npm'));
  } catch {
    throwError(`Couldn't find "npm" executable to help read the config`);
  }

  // handle @npmcli/config's proc-log logging https://www.npmjs.com/package/proc-log
  // (respect the env to set the level in case it's needed for debugging)
  const logLevels = ['silly', 'verbose', 'info', 'http', 'timing', 'notice', 'warn', 'error'];
  const maxLevelIndex = logLevels.indexOf(process.env.NPM_CONFIG_LOGLEVEL || process.env.npm_config_loglevel || 'warn');
  const onLog = (level: string, ...args: unknown[]) => {
    if (logLevels.indexOf(level) < maxLevelIndex) {
      return;
    }
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[${pluginName}][${level}]`, ...args);
  };
  process.on('log', onLog);

  try {
    // NOTE: This is using a patched API!
    // The patch provides some options by default and adds pre-calculated projectRoot/workspaceRoot.
    const conf = new NpmConfig({ npmPath, ...params });
    await conf.load();
    // This returns false if there are non-auth-related validation issues, but we only care about
    // the auth-related validation here (which is thrown as an error)
    conf.validate();
    return conf;
  } catch (err) {
    throwError(err);
  } finally {
    process.off('log', onLog);
  }
}

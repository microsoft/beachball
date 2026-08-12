import NpmConfig from '@npmcli/config';
import fs from 'node:fs';
import which from 'which';
import { logMessage, throwError } from './helpers.ts';
import type { VerboseLogger } from './types.ts';

/**
 * Read the effective npm config, with the same logic as npm: applying `process.env.npm_config_*`,
 * project config, user config, global config.
 * @param params - Required params plus optional npm config constructor option overrides for testing.
 * @returns The loaded and validated config object
 */
export async function loadNpmrc(
  params: Partial<Pick<NpmConfig.Options, 'cwd' | 'env' | 'npmPath'>> & {
    /** Root of the whole project (location of `yarn.lock` and root `package.json`) */
    projectRoot: string;
    verboseLog: VerboseLogger;
  }
): Promise<NpmConfig> {
  const { verboseLog, ...configParams } = params;
  let npmPath = configParams.npmPath;
  try {
    npmPath ??= fs.realpathSync(which.sync('npm'));
  } catch {
    throwError(`Couldn't find "npm" executable to help read the config`);
  }

  // handle @npmcli/config's proc-log log events (ignore levels not listed)
  const logLevels = ['silly', 'verbose', 'info', 'notice', 'warn', 'error'];
  const maxLevelIndex = logLevels.indexOf(verboseLog.verbose ? 'silly' : 'warn');
  const onLog = (level: string, ...args: unknown[]) => {
    const levelIndex = logLevels.indexOf(level);
    if (levelIndex >= maxLevelIndex) {
      logMessage(level === 'error' || level === 'warn' ? level : 'log', [`[${level}]`, ...args].join(' '));
    }
  };
  process.on('log', onLog);

  try {
    // NOTE: This is using a patched API!
    // The patch provides some options by default and adds pre-calculated projectRoot.
    const conf = new NpmConfig({ ...configParams, npmPath });
    await conf.load();
    // This returns false if there are non-auth-related validation issues, but we only care about
    // the auth-related validation here (which is thrown as an error)
    conf.validate();

    if (verboseLog.verbose) {
      verboseLog('Loaded npm config successfully. Config sources:');
      // sources maps e.g. someNpmrcPath => "builtin" or "default values" => "default"
      for (const [pathOrDesc, loc] of conf.sources.entries()) {
        verboseLog(`  ${loc}: ${pathOrDesc}`);
      }

      const envKeys = Object.keys(conf.data.get('env')?.raw || {}).sort();
      if (envKeys.length) {
        verboseLog('Config loaded from environment variables:');
        for (const key of envKeys) {
          verboseLog(`  ${key}`);
        }
      }
    }

    return conf;
  } catch (err) {
    throwError(err);
  } finally {
    process.off('log', onLog);
  }
}

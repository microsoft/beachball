import NpmConfig from '@npmcli/config';
import fs from 'node:fs';
import which from 'which';
import { logMessage, throwError, type VerboseLogger } from './helpers.ts';

/**
 * Read the effective npm config, with the same logic as npm: applying `process.env.npm_config_*`,
 * project config, user config, global config.
 * @param params - Required params plus optional npm config constructor override for testing.
 * @returns The loaded and validated config object
 */
export async function loadNpmrc(
  params: Partial<Pick<NpmConfig.Options, 'npmPath' | 'cwd' | 'env'>> & {
    /** Root of the whole project (location of `yarn.lock` and root `package.json`) */
    projectRoot: string;
    /** Root of the current workspace/package (may be same as `projectRoot`) */
    workspaceRoot: string;
    verboseLog: VerboseLogger;
  }
): Promise<NpmConfig> {
  const { verboseLog, ...configParams } = params;
  let npmPath = '';
  try {
    npmPath = fs.realpathSync(which.sync('npm'));
  } catch {
    throwError(`Couldn't find "npm" executable to help read the config`);
  }

  // handle @npmcli/config's proc-log log events
  const logLevels = ['silly', 'verbose', 'info', 'notice', 'warn', 'error'];
  const maxLevelIndex = logLevels.indexOf(verboseLog.verbose ? 'silly' : 'warn');
  const onLog = (level: string, ...args: unknown[]) => {
    const levelIndex = logLevels.indexOf(level);
    if (levelIndex >= 0 && levelIndex <= maxLevelIndex) {
      logMessage(level === 'error' || level === 'warn' ? level : 'log', [`[${level}]`, ...args].join(' '));
    }
  };
  process.on('log', onLog);

  try {
    // NOTE: This is using a patched API!
    // The patch provides some options by default and adds pre-calculated projectRoot/workspaceRoot.
    const conf = new NpmConfig({ npmPath, ...configParams });
    await conf.load();
    // This returns false if there are non-auth-related validation issues, but we only care about
    // the auth-related validation here (which is thrown as an error)
    conf.validate();

    verboseLog.verbose && logConfigSources(conf, verboseLog);

    return conf;
  } catch (err) {
    throwError(err);
  } finally {
    process.off('log', onLog);
  }
}

function logConfigSources(conf: NpmConfig, verboseLog: VerboseLogger): void {
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

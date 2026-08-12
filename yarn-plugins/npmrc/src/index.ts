// NOTE: Only import types, required yarn internals, or lightweight files here!
// Auth isn't needed in many cases, so we shouldn't load bigger dependencies upfront.
import type NpmConfig from '@npmcli/config';
import {
  SettingsType,
  type ConfigurationDefinitionMap,
  type Plugin,
  type ConfigurationValueMap,
  type Hooks,
  type Configuration,
} from '@yarnpkg/core';
import type { Hooks as NpmHooks } from '@yarnpkg/plugin-npm';
import path from 'node:path';
import { makeVerboseLogger, type VerboseLogger } from './helpers.ts';
import { getAuthHeader } from './getAuthHeader.ts';

interface NpmrcAuthConfig {
  npmrcAuthEnabled: boolean;
  npmrcAuthVerbose: boolean;
}

const configurationMap: ConfigurationDefinitionMap<NpmrcAuthConfig> &
  // we don't provide any of these built-in properties; this just satisfies the plugin type later
  Partial<ConfigurationDefinitionMap<ConfigurationValueMap>> = {
  npmrcAuthEnabled: {
    description: 'Attempt to read auth info from .npmrc for all registry requests',
    type: SettingsType.BOOLEAN,
    default: false,
  },
  npmrcAuthVerbose: {
    description: 'Enable verbose logging',
    type: SettingsType.BOOLEAN,
    default: false,
  },
};

/** Cached result of reading .npmrc */
let npmrc: NpmConfig | undefined;
let npmrcError: unknown;
const cachedHeaders: Record<string, string | undefined> = {};
let workspaceRoot: string | undefined;
let verboseLog: VerboseLogger | undefined;

/**
 * Yarn formats Windows paths like `/C:/path/to/file` which is not valid.
 * Fix it for use with other tools (remove extra leading slash and normalize slashes).
 */
function fixWindowsPath(pth: string) {
  return pth && process.platform === 'win32' ? path.normalize(pth.replace(/^\/([a-z]:\/)/i, '$1')) : pth;
}

function getConfigValue<K extends keyof NpmrcAuthConfig>(config: Configuration, key: K): NpmrcAuthConfig[K] {
  return config.get(key) as NpmrcAuthConfig[K];
}

const validateProject: Hooks['validateProject'] = project => {
  // Slightly misuse this hook to find the local workspace/package root
  workspaceRoot = fixWindowsPath(project.getWorkspaceByCwd(project.cwd).cwd);
};

/**
 * Yarn v4 doesn't respect .npmrc, so this plugin reads the token from .npmrc matching a
 * specified registry and applies it as an auth header for requests against that registry.
 */
const getNpmAuthenticationHeader: NpmHooks['getNpmAuthenticationHeader'] = async (
  currentHeader,
  registry,
  { configuration }
) => {
  verboseLog ??= makeVerboseLogger(getConfigValue(configuration, 'npmrcAuthVerbose'));

  if (!getConfigValue(configuration, 'npmrcAuthEnabled')) {
    verboseLog('npmrcAuthEnabled is false/unset; skipping .npmrc auth header', true);
    return currentHeader;
  }
  if (!configuration.projectCwd) {
    verboseLog('No projectCwd; skipping .npmrc auth header', true);
    return currentHeader;
  }

  // Use 'in' because we might have cached undefined
  if (registry in cachedHeaders) {
    // Verbose logging here would get very noisy for every request
    return cachedHeaders[registry];
  }

  // This might be handled by yarn automatically, but ensure we don't repeatedly try to load the
  // .npmrc if there was an error on the first attempt and yarn doesn't exit immediately
  if (npmrcError) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw npmrcError;
  }

  if (!npmrc) {
    const projectCwd = fixWindowsPath(configuration.projectCwd);
    verboseLog(`Loading .npmrc for projectCwd=${projectCwd} workspaceRoot=${workspaceRoot}`);

    // Delay load this since auth is irrelevant for many commands
    const { loadNpmrc } = await import('./loadNpmrc.ts');
    try {
      npmrc = await loadNpmrc({
        projectRoot: projectCwd,
        workspaceRoot: workspaceRoot || projectCwd,
        verboseLog,
      });
    } catch (err) {
      npmrcError = err;
      throw npmrcError;
    }
  }

  const newHeader = getAuthHeader({ npmrc, verboseLog, registry, currentHeader });
  cachedHeaders[registry] = newHeader;
  return newHeader;
};

const plugin: Plugin = {
  hooks: { validateProject, getNpmAuthenticationHeader },
  configuration: configurationMap,
};

export default plugin;

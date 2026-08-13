// NOTE: Only import types, required yarn internals, or lightweight files here!
// Auth isn't needed in many cases, so we shouldn't load bigger dependencies upfront.
import {
  SettingsType,
  type Configuration,
  type ConfigurationDefinitionMap,
  type ConfigurationValueMap,
  type Plugin,
} from '@yarnpkg/core';
import type { Hooks as NpmHooks } from '@yarnpkg/plugin-npm';
import { getHeaderFromNpmConfig } from './getHeaderFromNpmConfig.ts';
import { makeVerboseLogger } from './helpers.ts';
import type { NpmrcAuthConfig, VerboseLogger } from './types.ts';

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

let verboseLog: VerboseLogger | undefined;

function getConfigValue<K extends keyof NpmrcAuthConfig>(config: Configuration, key: K): NpmrcAuthConfig[K] {
  return config.get(key) as NpmrcAuthConfig[K];
}

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

  return await getHeaderFromNpmConfig({
    currentHeader,
    registry,
    projectCwd: configuration.projectCwd,
    verboseLog,
  });
};

const plugin: Plugin = {
  hooks: { getNpmAuthenticationHeader },
  configuration: configurationMap,
};

export default plugin;

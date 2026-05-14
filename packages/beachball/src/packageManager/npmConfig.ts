// @ts-expect-error -- @npmcli/config does not ship TypeScript declarations
import Config from '@npmcli/config';

export const npmRegistryDefault = 'https://registry.npmjs.org/';

/** Credentials read from npm config (`.npmrc` files and environment). */
export interface NpmCredentials {
  token?: string;
  username?: string;
  password?: string;
  certfile?: string;
  keyfile?: string;
  email?: string;
  auth?: string;
}

/** Resolved npm configuration: registry URL and associated credentials. */
export interface NpmConfigResult {
  registry: string;
  credentials: NpmCredentials;
}

// Minimal definition for the `registry` config key.
// `@npmcli/config` uses `nopt`-style type arrays; `URL` here tells nopt to parse it as a URL.
const definitions = {
  registry: {
    type: [URL],
    default: npmRegistryDefault,
  },
};

/**
 * Load npm configuration using `@npmcli/config` and return the resolved registry
 * and any associated credentials.
 *
 * This reads configuration from all standard npm sources (project `.npmrc`, user `.npmrc`,
 * environment variables) with full environment variable substitution support.
 *
 * Results are cached per `cwd` so repeated calls are inexpensive.
 */
export async function getNpmConfig(cwd: string): Promise<NpmConfigResult> {
  const cached = configCache.get(cwd);
  if (cached) {
    return cached;
  }

  const config = new Config({
    definitions,
    shorthands: {},
    flatten: () => {},
    npmPath: __dirname, // won't have a builtin npmrc, which is fine
    cwd,
    argv: [],
    // Use a clone of process.env so @npmcli/config's setEnvs doesn't pollute the real environment
    env: { ...process.env },
    warn: false,
  });

  await config.load();

  const registry: string = config.get('registry') || npmRegistryDefault;
  const credentials: NpmCredentials = config.getCredentialsByURI(registry);

  const result: NpmConfigResult = { registry, credentials };
  configCache.set(cwd, result);
  return result;
}

const configCache = new Map<string, NpmConfigResult>();

/** Clear the cached npm config (for testing). */
export function clearNpmConfigCache(): void {
  configCache.clear();
}

/**
 * Resolve the npm registry and credentials on the given options object.
 *
 * If `registry` is already set (via CLI or config), only credentials are loaded.
 * If `registry` is not set, both registry and credentials are resolved from `.npmrc`.
 *
 * If `token` is already set (via CLI or `NPM_TOKEN`), the `.npmrc` token is not used.
 *
 * Returns the same options object with `registry` guaranteed to be set.
 */
export async function resolveNpmConfig<T extends { path: string; registry?: string; token?: string }>(
  options: T
): Promise<T & { registry: string }> {
  const npmConfig = await getNpmConfig(options.path);

  if (!options.registry) {
    options.registry = npmConfig.registry;
  }

  if (!options.token && npmConfig.credentials.token) {
    options.token = npmConfig.credentials.token;
  }

  return options as T & { registry: string };
}

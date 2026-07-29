import { git } from 'workspace-tools';
import { BeachballError } from '../types/BeachballError';
import type { BeachballOptions } from '../types/BeachballOptions';

/**
 * Git trace/debug env vars that can cause git or curl to print/log request headers.
 * These are forced off to prevent leaking credentials.
 */
const traceDisableEnv: NodeJS.ProcessEnv = {
  GIT_TRACE: '0',
  GIT_CURL_VERBOSE: '0',
  GIT_TRACE_CURL: '0',
};

/**
 * Cache of computed auth envs, keyed by `cwd + remote + token`. The full returned env (including the
 * caller-provided `env`) is cached so the same reference is returned for repeated identical calls.
 */
const authEnvCache = new Map<string, NodeJS.ProcessEnv>();

type GitAuthEnvParams = Pick<BeachballOptions, 'gitToken' | 'path'> & {
  /**
   * Name of the remote. Its URL is resolved to scope the header. Throws if a token is provided
   * but the remote's URL can't be resolved.
   */
  remote: string;
  /**
   * `process.env` or an override for testing.
   * This is NOT merged with the result, only used to check for existing `GIT_CONFIG_*` entries.
   */
  env: NodeJS.ProcessEnv;
};

/**
 * Build (or return cached) env vars that inject an auth header for git operations against `remote`,
 * reducing the chance of token exposure.
 *
 * The header is `Authorization: Basic ${base64('x-access-token:gitTokenHere')}`, which works with
 * GitHub PATs and GitHub App installation tokens.
 *
 * The header is scoped to the remote's actual URL (`http.<remoteUrl>.extraheader`), so it's only
 * sent to that remote and not to any cross-host redirect targets. Existing `extraheader` config that
 * applies to that URL is rebuilt so that:
 * - any `Authorization` headers (e.g. the token injected by a CI checkout step) are dropped,
 *   so an additional incorrect header isn't sent (git accumulates `extraHeader` values)
 * - any *non-auth* headers are preserved
 *
 * This is done by resetting each applicable `extraHeader` config (an empty value resets
 * the list) and re-adding just the relevant values. Config for other hosts is unchanged.
 * The returned env also disables tracing options that could cause git/curl to log headers.
 *
 * @returns A copy of `env` with the new auth-related parts added, or `undefined` if no token was
 * provided (nothing to inject). (Do NOT log the result, since it contains the encoded token.)
 */
export function getGitAuthEnv(params: GitAuthEnvParams): NodeJS.ProcessEnv | undefined {
  const { gitToken, path: cwd, remote, env } = params;
  if (!gitToken) {
    return undefined;
  }
  const cacheKey = `${cwd}\0${remote}\0${gitToken}`;
  const cached = authEnvCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Get the actual remote URL to figure out if any existing headers apply, and how to scope
  // the new auth header
  const remoteUrl = getRemoteUrl(params);

  // Scope the header to the exact remote URL (this means it's only sent to that remote, not redirect targets).
  // Could revisit later if needed.
  const extraheaderKey = `http.${remoteUrl}.extraheader`;

  // Non-auth headers that currently apply to the remote URL, which must be preserved.
  // Existing auth headers are intentionally omitted so only our token is sent.
  //
  // These must be re-added under the *remote URL* key (not their original keys): git accumulates
  // `extraHeader` values by specificity and an empty value resets the whole accumulated list, so the
  // empty reset below (at the most-specific remote URL key) wipes any header re-added under a
  // less-specific key (e.g. the base `http.extraheader`). Re-adding under the remote URL key is the
  // only placement that survives the reset. This narrows a base header to the remote URL, which is
  // acceptable (and safer against leaking to redirect targets) for a single-remote fetch/push.
  const preservedHeaders = getExistingHeaders(cwd)
    .filter(({ key, value }) => _doesHeaderApply({ key, remoteUrl }) && !/^\s*authorization\s*:/i.test(value))
    .map(({ value }) => value);

  // Rebuild the remote URL's extraHeader list, all under the remote URL config key:
  // 1. An empty value resets the accumulated list (dropping any existing headers that apply to the
  //    remote, including those often set by CI checkout).
  // 2. Re-add the preserved non-auth headers.
  // 3. Add our auth header last so it's always present.
  const values = ['', ...preservedHeaders, getAuthHeaderValue(gitToken)];

  // Respect any existing GIT_CONFIG_* env by appending our entries after the existing count.
  const startCount = Number(env.GIT_CONFIG_COUNT ?? '0') || 0;
  const configEnv: NodeJS.ProcessEnv = { ...traceDisableEnv, GIT_CONFIG_COUNT: String(startCount + values.length) };
  values.forEach((value, i) => {
    configEnv[`GIT_CONFIG_KEY_${startCount + i}`] = extraheaderKey;
    configEnv[`GIT_CONFIG_VALUE_${startCount + i}`] = value;
  });

  const result = { ...env, ...configEnv };
  authEnvCache.set(cacheKey, result);
  return result;
}

/** Clear the memoized auth env cache. Intended for tests. */
export function clearGitAuthEnvCache(): void {
  authEnvCache.clear();
}

/** Return the value for the Authorization header for the given git token. */
export function getAuthHeaderValue(gitToken: string): string {
  // "x-access-token" is the usual placeholder username (token auth doesn't use the provided username)
  return `Authorization: basic ${Buffer.from(`x-access-token:${gitToken}`).toString('base64')}`;
}

/**
 * Decode the `Authorization: basic <base64>` header and get the embedded token
 * (assuming the standard `x-access-token` placeholder username).
 */
export function getTokenFromAuthHeader(value: string | undefined): string {
  const encoded = value?.replace(/^Authorization: basic /i, '') ?? '';
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  // Strip the `x-access-token:` placeholder username to return just the token.
  return decoded.replace(/^x-access-token:/, '');
}

/**
 * Resolve the URL for `remote` (e.g. `origin` -> `https://github.com/org/repo`).
 * Throws if the remote can't be resolved to a URL (should never happen).
 */
function getRemoteUrl(params: GitAuthEnvParams): string {
  const { remote, path: cwd } = params;
  if (!remote) {
    // should never happen in real publishing scenarios
    throw new BeachballError('No git remote could be resolved, so git token auth is not supported.');
  }
  const result = git(['remote', 'get-url', remote], { cwd });
  const url = result.success ? result.stdout.trim() : '';
  if (!url) {
    throw new BeachballError(`The git remote "${remote}" could not be resolved, so git token auth is not supported.`);
  }
  return url;
}

/**
 * Read all currently-configured `*.extraheader` git config entries as ordered `{ key, value }`
 * pairs (a multi-valued key appears once per value, in config order).
 */
function getExistingHeaders(cwd: string): { key: string; value: string }[] {
  const gitResult = git(['config', '--get-regexp', '.*\\.extraheader'], { cwd });
  if (!gitResult.success) {
    // git config exits non-zero when there are no matches, which is fine
    return [];
  }

  // Each line is `<key><space><value>`; the value may itself contain spaces.
  const lines = gitResult.stdout.split('\n');
  const result: { key: string; value: string }[] = [];
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    const spaceIndex = line.indexOf(' ');
    const key = spaceIndex === -1 ? line : line.slice(0, spaceIndex);
    const value = spaceIndex === -1 ? '' : line.slice(spaceIndex + 1);
    result.push({ key, value });
  }
  return result;
}

/**
 * Whether an `extraheader` config key applies to requests to `remoteUrl`. This is true for the base
 * `http.extraHeader` (which applies to all URLs) and for any `http.<url>.extraHeader` whose URL
 * matches `remoteUrl` (approximating git's own longest-prefix URL matching).
 */
export function _doesHeaderApply(params: { key: string; remoteUrl: string }): boolean {
  const { key, remoteUrl } = params;
  const prefix = 'http.';
  const suffix = '.extraheader';
  // The URL is the subsection between the section (`http`) and key (`extraheader`).
  // For the base `http.extraheader` (no subsection), this is empty, and the base applies to all URLs.
  const url = key.slice(prefix.length, key.length - suffix.length);
  if (!url) {
    return true;
  }
  return urlMatchesRemote(url, remoteUrl);
}

/**
 * Approximate git's `http.<url>.*` URL matching: the config URL matches the remote URL if they share
 * a scheme, host, and port, and the config URL's path is a prefix of the remote URL's path on `/`
 * segment boundaries. (An empty/`/` config path matches any path on the same host.)
 */
function urlMatchesRemote(configUrl: string, remoteUrl: string): boolean {
  let config: URL;
  let remote: URL;
  try {
    config = new URL(configUrl);
    remote = new URL(remoteUrl);
  } catch {
    return false;
  }

  if (config.protocol !== remote.protocol) return false;
  if (config.hostname.toLowerCase() !== remote.hostname.toLowerCase()) return false;

  const configPort = config.port || defaultPort(config.protocol);
  const remotePort = remote.port || defaultPort(remote.protocol);
  if (configPort !== remotePort) return false;

  const configPath = config.pathname.replace(/\/+$/, '');
  return !configPath || remote.pathname === configPath || remote.pathname.startsWith(`${configPath}/`);
}

function defaultPort(protocol: string): string {
  return protocol === 'https:' ? '443' : protocol === 'http:' ? '80' : '';
}

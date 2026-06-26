const defaultRefreshWindowMs = 5 * 60 * 1000;
const defaultGitHubApiUrl = 'https://api.github.com';
const transientRetryCount = 3;

export type PermissionLevel = 'read' | 'write' | 'admin';
export type Permissions = Record<string, PermissionLevel>;

/**
 * Signs the JWT signing input and returns the base64url-encoded raw RSA signature.
 */
export type GitHubAppJwtSigner = (signingInput: string) => Promise<string>;

export interface GitHubAppAuthOptions {
  appClientId: string;
  signer: GitHubAppJwtSigner;
  defaultOwner?: string;
  refreshWindowMs?: number;
  githubApiUrl?: string;
}

export interface GetInstallationTokenOptions {
  owner?: string;
  repositories?: string[] | string;
  repositoryNames?: string[] | string;
  enterprise?: string;
  permissions?: Permissions;
}

export interface InstallationToken {
  token: string;
  expiresAt: string;
  installationId: number;
  appSlug: string;
  repositories: string[];
  permissions: Permissions | Record<string, unknown>;
}

export interface GitHubAppAuth {
  getInstallationToken(options: GetInstallationTokenOptions): Promise<InstallationToken>;
  getToken(options: GetInstallationTokenOptions): Promise<string>;
  revokeToken(token: string): Promise<void>;
}

class GitHubRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function assertValue<T>(value: T | null | undefined, message: string): T {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function base64url(value: string | Uint8Array): string {
  return Buffer.from(value).toString('base64url');
}

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  return error instanceof GitHubRequestError ? error.status >= 500 : error instanceof TypeError;
}

async function retryTransient<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= transientRetryCount || !isRetryableError(error)) {
        throw error;
      }
      await sleep(2 ** attempt * 1000);
    }
  }
}

export function splitRepositoryNames(repositories: string[] | string | undefined): string[] {
  if (Array.isArray(repositories)) {
    return repositories.map(repo => `${repo}`.trim()).filter(Boolean);
  }
  if (typeof repositories === 'string') {
    return repositories
      .split(/[,\n]/)
      .map(repo => repo.trim())
      .filter(Boolean);
  }
  return [];
}

function stableObject(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableObject(entry)])
  );
}

function githubHeaders(token: string, json = false): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredIntegerProperty(value: unknown, property: string, failureMessage: string): number {
  const propertyValue = isRecord(value) ? value[property] : undefined;
  if (typeof propertyValue !== 'number' || !Number.isInteger(propertyValue)) {
    throw new Error(failureMessage);
  }
  return propertyValue;
}

function requiredStringProperty(value: unknown, property: string, failureMessage: string): string {
  const propertyValue = isRecord(value) ? value[property] : undefined;
  if (typeof propertyValue !== 'string' || !propertyValue) {
    throw new Error(failureMessage);
  }
  return propertyValue;
}

function validatePermissionName(key: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw new Error(`Invalid permission name: ${key}`);
  }
}

function validatePermissionLevel(key: string, level: unknown): PermissionLevel {
  if (level !== 'read' && level !== 'write' && level !== 'admin') {
    throw new Error(`Invalid permission level for ${key}: ${level}`);
  }
  return level;
}

function validatePermissions(value: unknown): Permissions | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error('permissions must be an object');
  }

  const permissions: Permissions = {};
  for (const [key, level] of Object.entries(value)) {
    validatePermissionName(key);
    permissions[key] = validatePermissionLevel(key, level);
  }

  return Object.keys(permissions).length === 0 ? undefined : permissions;
}

async function requestJson(url: string | URL, init: RequestInit, failureMessage: string): Promise<unknown> {
  const response = await fetch(url, init);
  const body = await response.text();
  if (!response.ok) {
    throw new GitHubRequestError(
      `${failureMessage}: ${response.status} ${response.statusText}: ${body}`,
      response.status
    );
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${failureMessage}: GitHub returned invalid JSON`);
  }
}

async function requestNoContent(url: string | URL, init: RequestInit, failureMessage: string): Promise<void> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new GitHubRequestError(
      `${failureMessage}: ${response.status} ${response.statusText}: ${body}`,
      response.status
    );
  }
}

type InstallationTarget =
  | { type: 'enterprise'; enterprise: string }
  | { type: 'owner'; owner: string }
  | { type: 'repository'; owner: string; repositories: string[] };

export function parseRepositoryInput(input: string): { input: string; owner?: string; name: string } {
  const parts = input.split('/');
  if (parts.length === 1 && parts[0]) {
    return { input, name: parts[0] };
  }
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { input, owner: parts[0], name: parts[1] };
  }
  throw new Error(`Invalid repository '${input}'. Expected 'repository' or 'owner/repository'.`);
}

export function normalizeRepositoryTarget(
  owner: string | undefined,
  repositories: string[],
  defaultOwner: string | undefined
): { owner: string; repositories: string[] } {
  const parsedRepositories = repositories.map(parseRepositoryInput);
  const repositoryOwner = parsedRepositories.find(repository => repository.owner)?.owner;
  const parsedOwner = owner || defaultOwner || repositoryOwner;
  if (!parsedOwner) {
    throw new Error('owner is required when repositories are provided');
  }

  const mismatchedRepository = parsedRepositories.find(
    repository => repository.owner && repository.owner.toLowerCase() !== parsedOwner.toLowerCase()
  );

  if (mismatchedRepository) {
    throw new Error(
      `Repository '${mismatchedRepository.input}' includes owner '${mismatchedRepository.owner}', which does not match the resolved owner '${parsedOwner}'.`
    );
  }

  return {
    owner: parsedOwner,
    repositories: parsedRepositories.map(repository => repository.name),
  };
}

export async function revokeToken(params: { githubApiUrl: string; token: string }): Promise<void> {
  const { githubApiUrl, token } = params;
  await requestNoContent(
    `${githubApiUrl}/installation/token`,
    {
      method: 'DELETE',
      headers: githubHeaders(token),
    },
    'Could not revoke GitHub App installation token'
  );
}

function resolveInstallationTarget(
  options: GetInstallationTokenOptions,
  defaultOwner: string | undefined
): InstallationTarget {
  const repositories = splitRepositoryNames(options.repositories ?? options.repositoryNames);

  if (options.enterprise) {
    if (options.owner || repositories.length > 0) {
      throw new Error("Cannot use 'enterprise' with 'owner' or 'repositories'");
    }
    return { type: 'enterprise', enterprise: options.enterprise };
  }

  const owner = assertValue(options.owner ?? defaultOwner, 'owner is required to discover installation ID');

  if (repositories.length === 0) {
    return { type: 'owner', owner };
  }

  return { type: 'repository', owner, repositories };
}

export function createGitHubAppAuth(options: GitHubAppAuthOptions): GitHubAppAuth {
  assertValue(options.appClientId, 'appClientId is required');
  assertValue(options.signer, 'signer is required');

  const appClientId = options.appClientId;
  const signer = options.signer;
  const defaultOwner = options.defaultOwner;
  const refreshWindowMs = options.refreshWindowMs ?? defaultRefreshWindowMs;
  const githubApiUrl = options.githubApiUrl ?? defaultGitHubApiUrl;
  const installationCache = new Map<string, { id: number; appSlug: string }>();
  const tokenCache = new Map<string, InstallationToken>();

  async function createJwt(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const iat = now - 60;
    const exp = now + 9 * 60;
    const header = base64url(JSON.stringify({ typ: 'JWT', alg: 'RS256' }));
    const payload = base64url(JSON.stringify({ iat, exp, iss: appClientId }));
    const signingInput = `${header}.${payload}`;
    const signature = await signer(signingInput);
    return `${signingInput}.${signature}`;
  }

  async function discoverInstallation(target: InstallationTarget): Promise<{ id: number; appSlug: string }> {
    const cacheKey = JSON.stringify(target);
    const cached = installationCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const jwt = await createJwt();
    let installation: unknown;
    switch (target.type) {
      case 'enterprise':
        installation = await requestJson(
          `${githubApiUrl}/enterprises/${target.enterprise}/installation`,
          { headers: githubHeaders(jwt) },
          'Could not discover GitHub App installation ID'
        );
        break;
      case 'owner':
        try {
          installation = await requestJson(
            `${githubApiUrl}/orgs/${target.owner}/installation`,
            { headers: githubHeaders(jwt) },
            'Could not discover GitHub App installation ID'
          );
        } catch (error) {
          if (!(error instanceof GitHubRequestError) || error.status !== 404) {
            throw error;
          }

          installation = await requestJson(
            `${githubApiUrl}/users/${target.owner}/installation`,
            { headers: githubHeaders(jwt) },
            'Could not discover GitHub App installation ID'
          );
        }
        break;
      case 'repository':
        installation = await requestJson(
          `${githubApiUrl}/repos/${target.owner}/${assertValue(
            target.repositories[0],
            'repository is required'
          )}/installation`,
          { headers: githubHeaders(jwt) },
          'Could not discover GitHub App installation ID'
        );
        break;
    }

    const result = {
      id: requiredIntegerProperty(installation, 'id', 'GitHub did not return an installation ID'),
      appSlug: requiredStringProperty(installation, 'app_slug', 'GitHub did not return an App slug'),
    };
    installationCache.set(cacheKey, result);
    return result;
  }

  async function getInstallationToken(opts: GetInstallationTokenOptions): Promise<InstallationToken> {
    const target = resolveInstallationTarget(opts, defaultOwner);
    const permissions = validatePermissions(opts.permissions);
    return retryTransient(async () => {
      const installation = await discoverInstallation(target);
      const repositories = target.type === 'repository' ? target.repositories : [];
      const cacheKey = JSON.stringify({
        installationId: installation.id,
        repositories: [...repositories].sort(),
        permissions: stableObject(permissions),
      });
      const cached = tokenCache.get(cacheKey);
      if (cached && Date.now() < new Date(cached.expiresAt).getTime() - refreshWindowMs) {
        return cached;
      }

      const jwt = await createJwt();
      const body = {
        ...(repositories.length > 0 ? { repositories } : {}),
        ...(permissions ? { permissions } : {}),
      };
      const token = await requestJson(
        `${githubApiUrl}/app/installations/${installation.id}/access_tokens`,
        {
          method: 'POST',
          headers: githubHeaders(jwt, true),
          body: JSON.stringify(body),
        },
        'Could not create GitHub App installation token'
      );

      const result: InstallationToken = {
        token: requiredStringProperty(token, 'token', 'GitHub did not return an installation token'),
        expiresAt: requiredStringProperty(
          token,
          'expires_at',
          'GitHub did not return an installation token expiration'
        ),
        installationId: installation.id,
        appSlug: installation.appSlug,
        repositories,
        permissions: isRecord(token) && isRecord(token['permissions']) ? token['permissions'] : (permissions ?? {}),
      };
      tokenCache.set(cacheKey, result);
      return result;
    });
  }

  async function getToken(opts: GetInstallationTokenOptions): Promise<string> {
    return (await getInstallationToken(opts)).token;
  }

  return {
    getInstallationToken,
    getToken,
    revokeToken: (token: string) => revokeToken({ githubApiUrl, token }),
  };
}

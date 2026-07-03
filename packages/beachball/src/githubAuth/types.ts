export type PermissionLevel = 'read' | 'write' | 'admin';
export type Permissions = Record<string, PermissionLevel>;

/**
 * Signs the JWT signing input and returns the base64url-encoded raw RSA signature.
 */
export type GitHubAppJwtSigner = (signingInput: string) => Promise<string>;

export interface GitHubAppAuthOptions {
  /**
   * GitHub App client ID (a value like `Iv23...`), used as JWT issuer.
   *
   * To find the client ID (which is not a secret), open the app's settings page and copy the
   * **Client ID** field from the **General** tab:
   * - **Org-owned app:** GitHub → your org → **Settings** → **Developer settings** → **GitHub Apps** → your app → **Edit**.
   * - **User-owned app:** GitHub → your profile **Settings** → **Developer settings** → **GitHub Apps** → your app.
   */
  appClientId: string;
  /**
   * If no custom `signer` is provided, this Azure Key Vault key ID used to sign the JWT.
   * @example 'https://my-vault.vault.azure.net/keys/my-github-app-key'
   */
  keyId?: string;
  /**
   * Callback that signs the app JWT and returns the base64url-encoded RSA signature.
   * Default comes from `createAzureCliKeyVaultSigner` using the `keyId` option.
   * If no custom `signer` is provided, `keyId` is required.
   */
  signer?: GitHubAppJwtSigner;
  /**
   * Safety margin (in milliseconds) subtracted from a cached token's expiration when deciding
   * whether it can be reused. A cached token is only returned while the current time is before
   * `expiresAt - refreshWindowMs`; once it is within this window of expiring, a fresh token is
   * minted instead. This guarantees returned tokens have at least `refreshWindowMs` of remaining
   * validity, so callers don't receive a token that expires mid-operation.
   *
   * Note: this does not change how long the token is valid — GitHub always issues installation
   * tokens with a fixed 60-minute lifetime (see {@link InstallationToken.expiresAt}). It only
   * controls how early this client stops reusing a cached token. Defaults to 5 minutes.
   */
  refreshWindowMs?: number;
  /** Base URL of the GitHub REST API. Defaults to `https://api.github.com`. Set for GitHub Enterprise Server. */
  githubApiUrl?: string;
}

export interface GetInstallationTokenOptions {
  /**
   * Installation owner (organization or user). Required unless `enterprise` is set or the
   * `repositories` entries include an `owner/repo` prefix. If set without `repositories`, the
   * token can access every repository the installation was granted.
   */
  owner?: string;
  /**
   * Repositories the token should be scoped to, as a string array or a comma-/newline-separated
   * string. Entries may be `repo` or `owner/repo`. Omit to grant access to all repositories the
   * installation can access.
   */
  repositories?: string[] | string;
  /** Enterprise slug for an enterprise installation. Mutually exclusive with `owner` and `repositories`. */
  enterprise?: string;
  /**
   * Permissions to grant the token, e.g. `{ contents: 'read', pull_requests: 'write' }`. Cannot
   * exceed the permissions granted to the app. Omit to inherit all of the installation's permissions.
   */
  permissions?: Permissions;
}

export interface InstallationToken {
  /** The installation access token. Authenticate REST/GraphQL requests with `Authorization: Bearer <token>`. */
  token: string;
  /**
   * ISO 8601 expiration timestamp returned by GitHub. Installation tokens always expire 60 minutes
   * after they are created; this lifetime is fixed by GitHub and cannot be configured on the
   * create-token request (the endpoint only accepts `repositories`, `repository_ids`, and
   * `permissions`). Requesting a shorter or longer validity is not supported by the API, so this
   * client instead re-mints tokens early via {@link GitHubAppAuthOptions.refreshWindowMs}.
   */
  expiresAt: string;
  /** ID of the resolved GitHub App installation. */
  installationId: number;
  /** Slug of the GitHub App that issued the token. */
  appSlug: string;
  /** Repositories the token was scoped to, or an empty array when scoped to the whole installation. */
  repositories: string[];
  /** Permissions granted to the token, as reported by GitHub. */
  permissions: Record<string, unknown>;
}

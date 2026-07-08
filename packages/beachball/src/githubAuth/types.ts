export type PermissionLevel = 'read' | 'write' | 'admin';
export type Permissions = Record<string, PermissionLevel>;

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
   * Azure Key Vault key ID used to sign the app JWT (via the Azure CLI `az keyvault key sign`).
   * @example 'https://my-vault.vault.azure.net/keys/my-github-app-key'
   */
  keyId: string;
  /** Base URL of the GitHub REST API. Defaults to `https://api.github.com`. Set for GitHub Enterprise Server. */
  githubApiUrl?: string;
}

export interface GetInstallationTokenOptions {
  /**
   * Repository the token should be scoped to, in `owner/repo` format. Used both to discover the
   * GitHub App installation and to scope the resulting token to that single repository.
   */
  repository: string;
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
   * client instead re-mints tokens early once they are within a fixed refresh window of expiring.
   */
  expiresAt: string;
  /** ID of the resolved GitHub App installation. */
  installationId: number;
  /** Slug of the GitHub App that issued the token. */
  appSlug: string;
  /** Repositories the token was scoped to. */
  repositories: string[];
  /** Permissions granted to the token, as reported by GitHub. */
  permissions: Record<string, unknown>;
}

export type PermissionLevel = 'read' | 'write' | 'admin';
export type Permissions = Record<string, PermissionLevel>;

export interface CreateAppTokenOptions {
  /**
   * GitHub App client ID (a value like `Iv23...`), used as JWT issuer.
   *
   * To find the client ID (which is not a secret), open the app's settings page and copy the
   * **Client ID** field from the **General** tab:
   * - **Org-owned app:** GitHub → your org → **Settings** → **Developer settings** → **GitHub Apps** → your app → **Edit**.
   * - **User-owned app:** GitHub → your profile **Settings** → **Developer settings** → **GitHub Apps** → your app.
   */
  appClientId: string;
  /** Base URL of the GitHub REST API. Defaults to `https://api.github.com`. Set for GitHub Enterprise Server. */
  githubApiUrl?: string;
  /**
   * Repository the token should be scoped to. Used both to discover the GitHub App installation
   * and to scope the resulting token to that single repository.
   */
  repository: { owner: string; name: string };
  /**
   * Permissions to grant the token, e.g. `{ contents: 'read', pull_requests: 'write' }`. Cannot
   * exceed the permissions granted to the app. Omit to inherit all of the installation's permissions.
   */
  permissions?: Permissions;
  /** Where to find the app's private key. */
  keyInfo: AppPrivateKeyInfo;
}

export type AppPrivateKeyInfo =
  | {
      /**
       * Azure Key Vault key ID used to sign the app JWT (via the Azure CLI `az keyvault key sign`).
       * @example 'https://my-vault.vault.azure.net/keys/my-github-app-key'
       */
      keyId: string;
    }
  | {
      /** PEM-encoded GitHub App private key. Escaped newlines are accepted. */
      privateKey: string;
    };

export interface RevokeAppTokenOptions {
  /** Token to revoke */
  token: string;
  /** Base URL of the GitHub REST API. Defaults to `https://api.github.com`. Set for GitHub Enterprise Server. */
  githubApiUrl?: string;
}

import { createHash } from 'node:crypto';
import execa from 'execa';
import type { GitHubAppJwtSigner } from './types';

function base64ToBase64url(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signDigest(keyId: string, digest: string): Promise<string> {
  try {
    // execa (via cross-spawn) handles PATH lookup and Windows `.cmd`/`.bat`/`.exe` resolution.
    const { stdout } = await execa(
      'az',
      [
        'keyvault',
        'key',
        'sign',
        '--id',
        keyId,
        '--algorithm',
        'RS256',
        '--digest',
        digest,
        '--query',
        'signature',
        '--output',
        'tsv',
        '--only-show-errors',
      ],
      { all: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return stdout.trim();
  } catch (error) {
    // `code` is the spawn error code (e.g. `ENOENT`), which isn't on the `ExecaError` type.
    const execaError = error as execa.ExecaError & { code?: string };
    if (execaError.code === 'ENOENT') {
      throw new Error('Azure CLI (`az`) was not found on PATH');
    }

    const output = execaError.all || '';
    throw new Error(`Azure Key Vault signing failed. ${output ? `Output:\n${output}` : execaError.shortMessage}`);
  }
}

/**
 * Creates a JWT signer that signs with an Azure Key Vault RSA key via the Azure CLI
 * (`az keyvault key sign` with the `RS256` algorithm). This is the low-dependency signing path:
 * it shells out to `az` rather than using the Azure SDK, so the Azure CLI must be installed and
 * already authenticated (e.g. `az login` or running within an `AzureCLI@2` pipeline task) as an
 * identity with `sign` permission on the key.
 *
 * @param keyId Azure Key Vault key ID for the key holding the GitHub App private key, for example
 * `https://my-vault.vault.azure.net/keys/my-github-app-key`
 * @returns A function that returns the base64url-encoded RSA signature.
 */
export function createAzureCliKeyVaultSigner(keyId: string): GitHubAppJwtSigner {
  if (!keyId) {
    throw new Error('keyId is required');
  }
  return async (signingInput: string): Promise<string> => {
    const digest = createHash('sha256').update(signingInput).digest('base64');
    const signature = await signDigest(keyId, digest);
    if (!signature) {
      throw new Error('Azure Key Vault did not return a signature');
    }
    return base64ToBase64url(signature);
  };
}

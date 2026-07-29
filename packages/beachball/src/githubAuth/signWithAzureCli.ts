import { createHash } from 'node:crypto';
import { spawn } from '../spawn';
import { BeachballError } from '../types/BeachballError';

function base64ToBase64url(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signDigest(keyId: string, digest: string): Promise<string> {
  const result = await spawn(
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
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  if (result.success) {
    return result.stdout.trim();
  }

  // `code` is the original spawn error code (e.g. `ENOENT`)
  const cause = result.cause as (Error & { code?: string }) | undefined;
  if (cause?.code === 'ENOENT' || cause?.message?.includes('ENOENT')) {
    throw new BeachballError('Azure CLI (`az`) was not found on PATH');
  }

  throw new BeachballError(
    `Azure Key Vault signing failed. ${result.output ? `Output:\n${result.output}` : result.message}`
  );
}

/**
 * Signs a JWT signing input with an Azure Key Vault RSA key via the Azure CLI
 * (`az keyvault key sign` with the `RS256` algorithm). This is the low-dependency signing path:
 * it shells out to `az` rather than using the Azure SDK, so the Azure CLI must be installed and
 * already authenticated (e.g. `az login` or running within an `AzureCLI@2` pipeline task) as an
 * identity with `sign` permission on the key.
 *
 * @param keyId Azure Key Vault key ID for the key holding the GitHub App private key, for example
 * `https://my-vault.vault.azure.net/keys/my-github-app-key`
 * @param signingInput The JWT signing input (`header.payload`) to sign.
 * @returns The base64url-encoded RSA signature.
 */
export async function signWithAzureCli(keyId: string, signingInput: string): Promise<string> {
  const digest = createHash('sha256').update(signingInput).digest('base64');
  const signature = await signDigest(keyId, digest);
  if (!signature) {
    throw new BeachballError('Azure Key Vault did not return a signature');
  }
  return base64ToBase64url(signature);
}

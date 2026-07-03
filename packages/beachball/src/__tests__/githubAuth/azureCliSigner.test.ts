import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createHash } from 'node:crypto';
import _execa from 'execa';
import { createAzureCliKeyVaultSigner } from '../../githubAuth/azureCliSigner';

jest.mock('execa');

// execa's overloaded types are too complex for jest.Mock, so we cast it to the signature that's used.
const mockExeca = _execa as unknown as jest.MockedFunction<
  (file: string, args?: readonly string[], options?: _execa.Options) => Promise<{ stdout: string; all?: string }>
>;

const keyId = 'https://my-vault.vault.azure.net/keys/my-github-app-key';
const signingInput = 'header.payload';

/** The base64 SHA-256 digest the signer should compute for `signingInput`. */
const expectedDigest = createHash('sha256').update(signingInput).digest('base64');

describe('createAzureCliKeyVaultSigner', () => {
  beforeEach(() => {
    mockExeca.mockReset();
  });

  it('rejects a missing keyId', () => {
    expect(() => createAzureCliKeyVaultSigner('')).toThrow(/keyId is required/);
  });

  it('signs the sha256 digest and returns a base64url signature', async () => {
    // Azure CLI returns standard base64 (with +, /, =), which must be converted to base64url.
    mockExeca.mockResolvedValue({ stdout: 'ab+/cd==\n' });

    const signer = createAzureCliKeyVaultSigner(keyId);
    const signature = await signer(signingInput);

    expect(signature).toBe('ab-_cd');

    expect(mockExeca).toHaveBeenCalledTimes(1);
    const [file, args] = mockExeca.mock.calls[0];
    expect(file).toBe('az');
    expect(args).toEqual([
      'keyvault',
      'key',
      'sign',
      '--id',
      keyId,
      '--algorithm',
      'RS256',
      '--digest',
      expectedDigest,
      '--query',
      'signature',
      '--output',
      'tsv',
      '--only-show-errors',
    ]);
  });

  it('throws a helpful error when the Azure CLI is not installed', async () => {
    mockExeca.mockRejectedValue(Object.assign(new Error('spawn az ENOENT'), { code: 'ENOENT' }));

    const signer = createAzureCliKeyVaultSigner(keyId);
    await expect(signer(signingInput)).rejects.toThrow(/Azure CLI \(`az`\) was not found on PATH/);
  });

  it('includes the CLI output when signing fails', async () => {
    mockExeca.mockRejectedValue(Object.assign(new Error('Command failed'), { all: 'ERROR: forbidden' }));

    const signer = createAzureCliKeyVaultSigner(keyId);
    await expect(signer(signingInput)).rejects.toThrow(/Azure Key Vault signing failed\. Output:\nERROR: forbidden/);
  });

  it('falls back to the short message when there is no output', async () => {
    mockExeca.mockRejectedValue(Object.assign(new Error('Command failed'), { shortMessage: 'Command failed: az' }));

    const signer = createAzureCliKeyVaultSigner(keyId);
    await expect(signer(signingInput)).rejects.toThrow(/Azure Key Vault signing failed\. Command failed: az/);
  });

  it('throws when Azure Key Vault returns an empty signature', async () => {
    mockExeca.mockResolvedValue({ stdout: '   \n' });

    const signer = createAzureCliKeyVaultSigner(keyId);
    await expect(signer(signingInput)).rejects.toThrow(/did not return a signature/);
  });
});

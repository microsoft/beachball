import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { mockSpawnSuccess, MockSubprocessError } from '../../__fixtures__/mockSpawnResult';
import { signWithAzureCli } from '../../githubAuth/signWithAzureCli';
import { spawn as _spawn } from '../../spawn';

jest.mock('../../spawn');

const mockSpawn = _spawn as jest.MockedFunction<typeof _spawn>;

const keyId = 'https://my-vault.vault.azure.net/keys/my-github-app-key';
const signingInput = 'header.payload';

/** The base64 SHA-256 digest the signer should compute for `signingInput`. */
const expectedDigest = createHash('sha256').update(signingInput).digest('base64');

describe('signWithAzureCli', () => {
  beforeEach(() => {
    mockSpawn.mockReset();
  });

  it('signs the sha256 digest and returns a base64url signature', async () => {
    // Azure CLI returns standard base64 (with +, /, =), which must be converted to base64url.
    mockSpawn.mockResolvedValue(mockSpawnSuccess({ output: 'ab+/cd==\n' }));

    const signature = await signWithAzureCli(keyId, signingInput);

    expect(signature).toBe('ab-_cd');

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const [file, args] = mockSpawn.mock.calls[0];
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
    const cause = new Error('spawn az ENOENT');
    (cause as { code?: string }).code = 'ENOENT';
    mockSpawn.mockResolvedValue(new MockSubprocessError({ cause }));

    await expect(signWithAzureCli(keyId, signingInput)).rejects.toThrow(/Azure CLI \(`az`\) was not found on PATH/);
  });

  it('includes the CLI output when signing fails', async () => {
    mockSpawn.mockResolvedValue(new MockSubprocessError({ output: 'ERROR: forbidden' }));

    await expect(signWithAzureCli(keyId, signingInput)).rejects.toThrow(
      /Azure Key Vault signing failed\. Output:\nERROR: forbidden/
    );
  });

  it('falls back to the short message when there is no output', async () => {
    mockSpawn.mockResolvedValue(new MockSubprocessError());

    await expect(signWithAzureCli(keyId, signingInput)).rejects.toThrow(
      /Azure Key Vault signing failed\. Command failed/
    );
  });

  it('throws when Azure Key Vault returns an empty signature', async () => {
    mockSpawn.mockResolvedValue(mockSpawnSuccess({ output: '   \n' }));

    await expect(signWithAzureCli(keyId, signingInput)).rejects.toThrow(/did not return a signature/);
  });
});

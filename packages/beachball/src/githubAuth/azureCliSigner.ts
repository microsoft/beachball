import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import type { GitHubAppJwtSigner } from './api.js';

interface CommandSpec {
  command: string;
  argsPrefix: string[];
}

let cachedAzCommand: CommandSpec | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function base64ToBase64url(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function commandExists(command: string): boolean {
  try {
    execFileSync('where.exe', [command], {
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

function azCommand(): CommandSpec {
  if (cachedAzCommand) {
    return cachedAzCommand;
  }

  if (process.platform !== 'win32') {
    cachedAzCommand = { command: 'az', argsPrefix: [] };
    return cachedAzCommand;
  }

  for (const command of ['az.exe', 'az.cmd', 'az.bat', 'az']) {
    if (commandExists(command)) {
      cachedAzCommand = command.endsWith('.exe')
        ? { command, argsPrefix: [] }
        : { command: process.env['ComSpec'] || 'cmd.exe', argsPrefix: ['/d', '/s', '/c', command] };
      return cachedAzCommand;
    }
  }

  throw new Error('Azure CLI (`az`) was not found on PATH');
}

function signDigest(keyId: string, digest: string): string {
  const { command, argsPrefix } = azCommand();
  try {
    return execFileSync(
      command,
      [
        ...argsPrefix,
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
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    ).trim();
  } catch (error) {
    if (isRecord(error)) {
      if (error['code'] === 'ENOENT') {
        throw new Error('Azure CLI (`az`) was not found on PATH');
      }

      const errorStderr = error['stderr'];
      const stderr = typeof errorStderr === 'string' ? errorStderr.trim() : '';
      if (typeof error['status'] === 'number') {
        throw new Error(
          `Azure Key Vault signing failed with exit code ${error['status']}${stderr ? `: ${stderr}` : ''}`
        );
      }
    }

    throw new Error('Azure Key Vault signing failed');
  }
}

export function createAzureCliKeyVaultSigner(keyId: string): GitHubAppJwtSigner {
  if (!keyId) {
    throw new Error('keyId is required');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  return async (signingInput: string): Promise<string> => {
    const digest = createHash('sha256').update(signingInput).digest('base64');
    const signature = signDigest(keyId, digest);
    if (!signature) {
      throw new Error('Azure Key Vault did not return a signature');
    }
    return base64ToBase64url(signature);
  };
}

import { InvalidArgumentError } from 'commander';
import type { PermissionLevel, Permissions } from './types';

/** Generic error thrown from this code (don't show the stack) */
export class AuthError extends Error {}

const permissionLevels = Object.keys({
  read: true,
  write: true,
  admin: true,
} satisfies Record<PermissionLevel, boolean>);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requiredIntegerProperty(value: unknown, property: string, failureMessage: string): number {
  const propertyValue = isRecord(value) ? value[property] : undefined;
  if (typeof propertyValue !== 'number' || !Number.isInteger(propertyValue)) {
    throw new AuthError(failureMessage);
  }
  return propertyValue;
}

export function requiredStringProperty(value: unknown, property: string, failureMessage: string): string {
  const propertyValue = isRecord(value) ? value[property] : undefined;
  if (typeof propertyValue !== 'string' || !propertyValue) {
    throw new AuthError(failureMessage);
  }
  return propertyValue;
}

export function parsePermissions(value: string | undefined): Permissions | undefined {
  if (!value) {
    return undefined;
  }

  const permissions: Permissions = {};
  for (const entry of splitList(value)) {
    const parts = entry.split(':');
    if (parts.length !== 2) {
      throw new AuthError(`Permission entry must include an explicit level: ${entry}`);
    }

    const key = parts[0]?.trim();
    const rawLevel = parts[1]?.trim();
    if (!key) {
      throw new AuthError(`Permission entry must include a permission name: ${entry}`);
    }
    if (!/^[A-Za-z_]\w*$/.test(key)) {
      throw new AuthError(`Invalid permission name: ${key}`);
    }
    if (Object.hasOwn(permissions, key)) {
      throw new AuthError(`Duplicate permission: ${key}`);
    }

    if (!permissionLevels.includes(rawLevel)) {
      throw new AuthError(`Invalid permission level for ${key}: ${rawLevel}`);
    }
    permissions[key] = rawLevel as PermissionLevel;
  }

  return Object.keys(permissions).length === 0 ? undefined : permissions;
}

/** Parse a `--permissions` value and throw a commander argument error if invalid. */
export function parsePermissionsArg(value: string): Permissions | undefined {
  try {
    return parsePermissions(value);
  } catch (error) {
    throw new InvalidArgumentError((error as Error).message);
  }
}

/**
 * Splits a list of strings or a single string into an array of trimmed, non-empty strings.
 * If the input is a single string, it's split on commas and newlines.
 */
export function splitList(list: string[] | string | undefined): string[] {
  if (Array.isArray(list)) {
    return list.map(repo => `${repo}`.trim()).filter(Boolean);
  }
  if (typeof list === 'string') {
    return list
      .split(/[,\n]/)
      .map(repo => repo.trim())
      .filter(Boolean);
  }
  return [];
}

export function parseRepository(repository: string): { owner: string; name: string } {
  const parts = repository.split('/');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { owner: parts[0], name: parts[1] };
  }
  throw new AuthError(`Invalid repository '${repository}'. Expected 'owner/repository'.`);
}

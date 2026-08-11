import { InvalidArgumentError } from 'commander';
import { BeachballError } from '../types/BeachballError';
import type { PermissionLevel, Permissions } from './types';

const permissionLevels = Object.keys({
  read: true,
  write: true,
  admin: true,
} satisfies Record<PermissionLevel, boolean>);

/** Returns whether the value is a record object */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Verifies that the property exists and is an integer, or throws `BeachballError` if not. */
export function requiredIntegerProperty(value: unknown, property: string, failureMessage: string): number {
  const propertyValue = isRecord(value) ? value[property] : undefined;
  if (typeof propertyValue !== 'number' || !Number.isInteger(propertyValue)) {
    // This is used to validate API responses, not CLI arguments
    throw new BeachballError(failureMessage);
  }
  return propertyValue;
}

/** Verifies that the property exists and is a non-empty string, or throws `BeachballError` if not. */
export function requiredStringProperty(value: unknown, property: string, failureMessage: string): string {
  const propertyValue = isRecord(value) ? value[property] : undefined;
  if (typeof propertyValue !== 'string' || !propertyValue) {
    // This is used to validate API responses, not CLI arguments
    throw new BeachballError(failureMessage);
  }
  return propertyValue;
}

/**
 * Parses comma-separated permission entries into a Permissions object and throws
 * `InvalidArgumentError` if any entries are invalid.
 *
 * Example: `"contents:read, issues:write"` becomes `{ contents: 'read', issues: 'write' }`
 */
export function parsePermissions(value: string): Permissions | undefined {
  const permissions: Permissions = {};
  const values = value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
  for (const entry of values) {
    const parts = entry.split(':').map(v => v.trim());
    if (parts.length !== 2) {
      throw new InvalidArgumentError(`Permission entry must include an explicit level: ${entry}`);
    }

    const [key, rawLevel] = parts;
    if (!key) {
      throw new InvalidArgumentError(`Permission entry must include a permission name: ${entry}`);
    }
    if (!/^[A-Za-z_]\w*$/.test(key)) {
      throw new InvalidArgumentError(`Invalid permission name: ${key}`);
    }
    if (Object.hasOwn(permissions, key)) {
      throw new InvalidArgumentError(`Duplicate permission: ${key}`);
    }

    if (!permissionLevels.includes(rawLevel)) {
      throw new InvalidArgumentError(`Invalid permission level for ${key}: ${rawLevel}`);
    }
    permissions[key] = rawLevel as PermissionLevel;
  }

  return Object.keys(permissions).length === 0 ? undefined : permissions;
}

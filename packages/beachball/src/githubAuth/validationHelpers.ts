import type { PermissionLevel, Permissions } from './types';

const permissionLevels = Object.keys({
  read: true,
  write: true,
  admin: true,
} satisfies Record<PermissionLevel, boolean>);

export const defaultGitHubApiUrl = 'https://api.github.com';

export function assertValue<T>(value: T | null | undefined, message: string): T {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requiredIntegerProperty(value: unknown, property: string, failureMessage: string): number {
  const propertyValue = isRecord(value) ? value[property] : undefined;
  if (typeof propertyValue !== 'number' || !Number.isInteger(propertyValue)) {
    throw new Error(failureMessage);
  }
  return propertyValue;
}

export function requiredStringProperty(value: unknown, property: string, failureMessage: string): string {
  const propertyValue = isRecord(value) ? value[property] : undefined;
  if (typeof propertyValue !== 'string' || !propertyValue) {
    throw new Error(failureMessage);
  }
  return propertyValue;
}

function validatePermissionName(key: string): void {
  if (!/^[A-Za-z_]\w*$/.test(key)) {
    throw new Error(`Invalid permission name: ${key}`);
  }
}

function validatePermissionLevel(key: string, level: unknown): PermissionLevel {
  if (!permissionLevels.includes(level as PermissionLevel)) {
    throw new Error(`Invalid permission level for ${key}: ${level}`);
  }
  return level as PermissionLevel;
}

/**
 * Validate an object which probably contains permissions.
 */
export function validatePermissions(value: unknown): Permissions | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error('permissions must be an object');
  }

  const permissions: Permissions = {};

  for (const [key, level] of Object.entries(value)) {
    validatePermissionName(key);
    permissions[key] = validatePermissionLevel(key, level);
  }

  return Object.keys(permissions).length === 0 ? undefined : permissions;
}

export function parsePermissions(value: string | undefined): Permissions | undefined {
  if (!value) {
    return undefined;
  }

  const permissions: Permissions = {};
  for (const entry of splitList(value)) {
    const parts = entry.split(':');
    if (parts.length !== 2) {
      throw new Error(`Permission entry must include an explicit level: ${entry}`);
    }

    const key = parts[0]?.trim();
    const rawLevel = parts[1]?.trim();
    if (!key) {
      throw new Error(`Permission entry must include a permission name: ${entry}`);
    }
    validatePermissionName(key);
    if (Object.hasOwn(permissions, key)) {
      throw new Error(`Duplicate permission: ${key}`);
    }
    permissions[key] = validatePermissionLevel(key, rawLevel);
  }

  return Object.keys(permissions).length === 0 ? undefined : permissions;
}

export function splitList(repositories: string[] | string | undefined): string[] {
  if (Array.isArray(repositories)) {
    return repositories.map(repo => `${repo}`.trim()).filter(Boolean);
  }
  if (typeof repositories === 'string') {
    return repositories
      .split(/[,\n]/)
      .map(repo => repo.trim())
      .filter(Boolean);
  }
  return [];
}

export function parseRepositoryInput(input: string): { input: string; owner?: string; name: string } {
  const parts = input.split('/');
  if (parts.length === 1 && parts[0]) {
    return { input, name: parts[0] };
  }
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { input, owner: parts[0], name: parts[1] };
  }
  throw new Error(`Invalid repository '${input}'. Expected 'repository' or 'owner/repository'.`);
}

export function normalizeRepositoryTarget(
  owner: string | undefined,
  repositories: string[]
): { owner: string; repositories: string[] } {
  const parsedRepositories = repositories.map(parseRepositoryInput);
  const parsedOwner = owner || parsedRepositories.find(repository => repository.owner)?.owner;
  if (!parsedOwner) {
    throw new Error('owner is required when repositories are provided');
  }

  const mismatchedRepository = parsedRepositories.find(
    repository => repository.owner && repository.owner.toLowerCase() !== parsedOwner.toLowerCase()
  );

  if (mismatchedRepository) {
    throw new Error(
      `Repository '${mismatchedRepository.input}' includes owner '${mismatchedRepository.owner}', which does not match the resolved owner '${parsedOwner}'.`
    );
  }

  return {
    owner: parsedOwner,
    repositories: parsedRepositories.map(repository => repository.name),
  };
}

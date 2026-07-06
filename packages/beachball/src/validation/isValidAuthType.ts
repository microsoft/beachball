import type { AuthType } from '../types/Auth';

export const authTypes: AuthType[] = ['authtoken', 'password'] as const;

export function isValidAuthType(authType: string): boolean {
  return authTypes.includes(authType as AuthType);
}

import { AuthType } from '../types/Auth';

export function isValidAuthType(authType: string): boolean {
  const authTypes: AuthType[] = ['authtoken', 'password'];
  return authTypes.includes(authType as AuthType);
}

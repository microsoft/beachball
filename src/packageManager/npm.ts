import execa from 'execa';
import { AuthType } from '../types/Auth';

export function npm(
  args: string[],
  options: execa.SyncOptions = {}
): execa.ExecaSyncReturnValue & { success: boolean } {
  try {
    const result = execa.sync('npm', args, { ...options });
    return {
      ...result,
      success: !result.failed,
    };
  } catch (e) {
    return {
      ...(e as execa.ExecaSyncError),
      success: false,
    };
  }
}

export async function npmAsync(
  args: string[],
  options: execa.Options = {}
): Promise<execa.ExecaReturnValue & { success: boolean }> {
  try {
    const result = await execa('npm', args, { ...options });
    return {
      ...result,
      success: !result.failed,
    };
  } catch (e) {
    return {
      ...(e as execa.ExecaError),
      success: false,
    };
  }
}

export function getNpmAuthArgs(registry: string, token?: string, authType?: AuthType): string[] {
  const authArgs: string[] = [];

  if (token) {
    const npmKeyword = authType === 'password' ? '_password' : '_authToken';
    const shorthand = registry.substring(registry.indexOf('//'));
    authArgs.push(`--${shorthand}:${npmKeyword}=${token}`);
  }
  return authArgs;
}

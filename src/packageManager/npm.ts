import execa from 'execa';

/**
 * Run an npm command. Returns the error result instead of throwing on failure.
 */
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

/**
 * Run an npm command. Returns the error result instead of throwing on failure.
 */
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

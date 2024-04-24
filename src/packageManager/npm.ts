import execa from 'execa';

export type NpmResult = Awaited<ReturnType<typeof npm>>;

/**
 * Run an npm command. Returns the error result instead of throwing on failure.
 */
export async function npm(
  args: string[],
  options: execa.Options = {}
): Promise<execa.ExecaReturnValue & { success: boolean }> {
  try {
    const result = await execa('npm', args, { ...options, shell: true });
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

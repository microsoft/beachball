import execa from 'execa';

export type PnpmResult = Awaited<ReturnType<typeof pnpm>>;

/**
 * Run an pnpm command. Returns the error result instead of throwing on failure.
 */
export async function pnpm(
  args: string[],
  options: execa.Options = {}
): Promise<execa.ExecaReturnValue & { success: boolean }> {
  try {
    const result = await execa('pnpm', args, { ...options });
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

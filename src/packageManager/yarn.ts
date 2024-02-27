import execa from 'execa';

export type YarnResult = Awaited<ReturnType<typeof yarn>>;

/**
 * Run an yarn command. Returns the error result instead of throwing on failure.
 */
export async function yarn(
  args: string[],
  options: execa.Options = {}
): Promise<execa.ExecaReturnValue & { success: boolean }> {
  try {
    const result = await execa('yarn', args, { ...options });
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

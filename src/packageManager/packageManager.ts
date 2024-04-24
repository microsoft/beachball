import execa from 'execa';

export type PackageManagerResult = execa.ExecaReturnValue & { success: boolean };

/**
 * Run a package manager command. Returns the error result instead of throwing on failure.
 * @param manager The package manager to use
 * @param args Package manager command and arguments
 * @param options cwd must be specified in options to reduce the chance of accidentally running
 * commands in the wrong place. If it's definitely irrelevant in this case, use undefined.
 */
export async function packageManager(
  manager: 'npm' | 'yarn' | 'pnpm',
  args: string[],
  options: execa.Options & { cwd: string | undefined }
): Promise<execa.ExecaReturnValue & { success: boolean }> {
  try {
    const result = await execa(manager, args, {
      ...options,
      // This is required for Windows due to https://nodejs.org/en/blog/vulnerability/april-2024-security-releases-2
      shell: true,
    });
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

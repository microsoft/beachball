/**
 * Get an environment variable and throw if it's missing.
 *
 * ADO variables reference:
 * https://learn.microsoft.com/en-us/azure/devops/pipelines/build/variables?view=azure-devops&tabs=yaml
 */
export function getEnv(name: string): string {
  const result = process.env[name];

  if (typeof result !== 'string') {
    throw new Error(`Missing env: ${name}`);
  }

  return result;
}

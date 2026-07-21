import { logError } from './github.ts';

/**
 * @param envName name of value from `process.env`
 * @returns the value
 */
export function getEnv(envName: string, required?: boolean): string | undefined {
  const env = process.env[envName];
  if (required && !env) {
    logError(`process.env.${envName} is missing`);
    process.exit(1);
  }
  return env;
}

import { AuthError } from './validationHelpers';

export const defaultGitHubApiUrl = 'https://api.github.com';

const transientRetryCount = 3;

export class GitHubRequestError extends AuthError {
  public readonly status: number;
  public constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function isRetryableError(error: unknown): boolean {
  return error instanceof GitHubRequestError ? error.status >= 500 : error instanceof TypeError;
}

export async function retryTransient<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= transientRetryCount || !isRetryableError(error)) {
        throw error;
      }
      const timeout = 2 ** attempt * 1000;
      await new Promise(resolve => setTimeout(resolve, timeout));
    }
  }
}

export async function requestJson<T = unknown>(
  url: string | URL,
  init: RequestInit,
  failureMessage: string
): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.text();
  if (!response.ok) {
    throw new GitHubRequestError(
      `${failureMessage}: ${response.status} ${response.statusText}: ${body}`,
      response.status
    );
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new AuthError(`${failureMessage}: GitHub returned invalid JSON`);
  }
}

export async function requestNoContent(url: string | URL, init: RequestInit, failureMessage: string): Promise<void> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new GitHubRequestError(
      `${failureMessage}: ${response.status} ${response.statusText}: ${body}`,
      response.status
    );
  }
}

export function githubHeaders(token: string, json = false): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

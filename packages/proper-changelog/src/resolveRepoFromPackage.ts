import { ChangelogError, type RepoId } from './types.ts';

/** The `repository` field of an npm package manifest, in object form. */
interface NpmRepository {
  type?: string;
  url?: string;
  directory?: string;
}

/** Minimal npm registry manifest shape (only the fields we read). */
interface NpmManifest {
  repository?: NpmRepository | string;
}

const registryBase = 'https://registry.npmjs.org';

/** Resolve the GitHub repository for an npm package from its latest published version. */
export async function resolveRepoFromPackage(packageName: string): Promise<RepoId> {
  // Encode the package name for the URL path. The leading `@` in scoped names is allowed
  // unencoded, but the `/` separator must be encoded.
  const encodedName = packageName.startsWith('@')
    ? `@${encodeURIComponent(packageName.slice(1))}`
    : encodeURIComponent(packageName);

  const url = `${registryBase}/${encodedName}/latest`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new ChangelogError(
      `Failed to look up npm package "${packageName}": ${response.status} ${response.statusText}`
    );
  }

  const manifest = (await response.json()) as NpmManifest;
  return _parseGitHubRepo(manifest.repository, packageName);
}

/**
 * Parse a GitHub `owner/repo` from an npm `repository` field. Only github.com is supported:
 * github.com URLs (`git+https`, `https`, `git://`, `git@github.com:`) and the `github:`
 * shorthand. Throws if the repository refers to any other host or can't be parsed.
 * @internal Exported for testing
 */
export function _parseGitHubRepo(repository: NpmRepository | string | undefined, packageName: string): RepoId {
  const raw = typeof repository === 'string' ? repository : repository?.url;
  if (!raw) {
    throw new ChangelogError(`npm package "${packageName}" does not specify a repository.`);
  }

  // `github:owner/repo` shorthand always refers to github.com.
  const shorthandMatch = raw.match(/^github:([^/#]+)\/([^/#]+?)(?:\.git)?(?:#.*)?$/);
  if (shorthandMatch) {
    return { owner: shorthandMatch[1], repo: shorthandMatch[2] };
  }

  // A bare `owner/repo` string shorthand also defaults to github.com.
  const bareMatch = raw.match(/^([^/#:]+)\/([^/#]+?)(?:\.git)?(?:#.*)?$/);
  if (bareMatch) {
    return { owner: bareMatch[1], repo: bareMatch[2] };
  }

  // Any other host shorthand (e.g. `gitlab:`/`bitbucket:`) is unsupported.
  if (/^\w+:[^/]+\/[^/]+$/i.test(raw) && !raw.startsWith('github:')) {
    throw new ChangelogError(
      `npm package "${packageName}" repository is "${raw}" which does not appear to be on github.com`
    );
  }

  // URL forms: https, git+https, git://, ssh (git@github.com:owner/repo).
  const urlMatch = raw.match(/github\.com[/:]([^/#]+)\/([^/#]+?)(?:\.git)?(?:#.*)?$/);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }

  throw new ChangelogError(
    `npm package "${packageName}" repository is "${raw}" which does not appear to be on github.com`
  );
}

import { PackageInfo } from '../types/PackageInfo';
import path from 'path';
import { npm, NpmResult } from './npm';
import { BeachballOptions } from '../types/BeachballOptions';
import { getNpmPublishArgs } from './npmArgs';
import { NpmOptions } from '../types/NpmOptions';

/**
 * Attempt to publish the package with retries. Returns the result of the final npm publish call
 * (mainly for tests; the real code just checks `result.success`).
 */
export async function packagePublish(
  packageInfo: PackageInfo,
  options: NpmOptions & Pick<BeachballOptions, 'retries'>
): Promise<NpmResult> {
  const publishArgs = getNpmPublishArgs(packageInfo, options);

  const publishTag = publishArgs[publishArgs.indexOf('--tag') + 1];
  const pkg = packageInfo.name;
  console.log(`\nPublishing - ${pkg}@${packageInfo.version} with tag ${publishTag}`);

  console.log(`  publish command: ${publishArgs.join(' ')}`);

  let result: NpmResult;

  // Unclear whether `options.retries` should be interpreted as "X attempts" or "initial attempt + X retries"...
  // It was previously implemented as the latter, so keep that for now.
  for (let retries = 0; retries <= options.retries; retries++) {
    if (retries > 0) {
      console.log(`Retrying... (${retries}/${options.retries})\n`);
    }

    result = await npm(publishArgs, {
      // Run npm publish in the package directory
      cwd: path.dirname(packageInfo.packageJsonPath),
      timeout: options.timeout,
      all: true,
    });

    if (result.success) {
      console.log('Published!');
      return result;
    }

    const output = `Output:\n\n${result.all}\n`;

    // First check for specific cases where retries are unlikely to help
    if (result.all!.includes('EPUBLISHCONFLICT')) {
      console.error(`${pkg}@${packageInfo.version} already exists in the registry. ${output}`);
      break;
    }
    if (result.all!.includes('ENEEDAUTH')) {
      // ENEEDAUTH only happens if no auth was attempted (no token/password provided).
      console.error(`Publishing ${pkg} failed due to an auth error. ${output}`);
      break;
    }
    if (result.all!.includes('code E404')) {
      // All types of invalid credentials appear to cause E404.
      // validate() already checks for the most common ways invalid variable names might show up,
      // so log a slightly more generic message instead of details about the token.
      console.error(
        `Publishing ${pkg} returned E404. Contrary to the output, this usually indicates an issue ` +
          'with an auth token (expired, improper scopes, or incorrect variable name).'
      );
      // demote the output on this one due to the misleading message
      console.log(output);
      break;
    }

    const timedOutMessage = result.timedOut ? ' (timed out)' : '';
    const log = retries < options.retries ? console.warn : console.error;
    log(`Publishing ${pkg} failed${timedOutMessage}. ${output}`);
  }

  return result!;
}

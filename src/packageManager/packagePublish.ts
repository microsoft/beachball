import type { PackageInfo } from '../types/PackageInfo';
import path from 'path';
import { npm, type NpmResult } from './npm';
import type { BeachballOptions } from '../types/BeachballOptions';
import { getNpmPublishArgs } from './npmArgs';
import type { NpmOptions } from '../types/NpmOptions';

/**
 * Attempt to publish the package with retries. Returns the result of the final npm publish call
 * (mainly for tests; the real code just checks `result.success`).
 */
export async function packagePublish(
  packageInfo: PackageInfo,
  options: NpmOptions & Pick<BeachballOptions, 'retries'>
): Promise<NpmResult> {
  const publishArgs = getNpmPublishArgs(packageInfo, options);

  const packageRoot = path.dirname(packageInfo.packageJsonPath);
  const publishTag = publishArgs[publishArgs.indexOf('--tag') + 1];
  const packageSpec = `${packageInfo.name}@${packageInfo.version}`;
  console.log(`\nPublishing - ${packageSpec} with tag ${publishTag}`);

  console.log(`  publish command: ${publishArgs.join(' ')}`);
  console.log(`  (cwd: ${packageRoot})`);

  let result: NpmResult;

  // Unclear whether `options.retries` should be interpreted as "X attempts" or "initial attempt + X retries"...
  // It was previously implemented as the latter, so keep that for now.
  for (let retries = 0; retries <= options.retries; retries++) {
    if (retries > 0) {
      console.log(`Retrying... (${retries}/${options.retries})\n`);
    }

    result = await npm(publishArgs, {
      // Run npm publish in the package directory
      cwd: packageRoot,
      timeout: options.timeout,
      all: true,
    });

    if (result.success) {
      console.log(`Published! - ${packageSpec}`);
      return result;
    }

    console.log();
    const output = `Output:\n\n${result.all}\n`;

    // First check the output for specific cases where retries are unlikely to help.
    // NOTE: much of npm's output is localized, so it's best to only check for error codes.
    if (result.all?.includes('EPUBLISHCONFLICT') || result.all?.includes('E409')) {
      console.error(`${packageSpec} already exists in the registry. ${output}`);
      break;
    }
    if (result.all?.includes('code E403')) {
      // This is apparently a less common variant of trying to publish over an existing version
      // (not sure when this error is used vs. EPUBLISHCONFLICT). Keep the message generic since
      // there may be other possible causes for 403 errors.
      //   npm ERR! code E403
      //   npm ERR! 403 403 Forbidden - PUT https://registry.npmjs.org/pkg-name - You cannot publish over the previously published versions: 0.1.6.
      //   npm ERR! 403 In most cases, you or one of your dependencies are requesting
      //   npm ERR! 403 a package version that is forbidden by your security policy, or
      //   npm ERR! 403 on a server you do not have access to.
      console.error(`Publishing ${packageSpec} failed due to a 403 error. ${output}`);
      break;
    }
    if (result.all?.includes('ENEEDAUTH')) {
      // ENEEDAUTH only happens if no auth was attempted (no token/password provided).
      console.error(`Publishing ${packageSpec} failed due to an auth error. ${output}`);
      break;
    }
    if (result.all?.includes('code E404')) {
      // All types of invalid credentials appear to cause E404.
      // validate() already checks for the most common ways invalid variable names might show up,
      // so log a slightly more generic message instead of details about the token.
      console.error(
        `Publishing ${packageSpec} failed with E404. Contrary to the output, this usually indicates an issue ` +
          'with an auth token (expired, improper scopes, or incorrect variable name).'
      );
      // demote the output on this one due to the misleading message
      console.log(output);
      break;
    }

    const timedOutMessage = result.timedOut ? ' (timed out)' : '';
    const log = retries < options.retries ? console.warn : console.error;
    log(`Publishing ${packageSpec} failed${timedOutMessage}. ${output}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return result!;
}

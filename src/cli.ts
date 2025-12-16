import { findGitRoot } from 'workspace-tools';
import { bump } from './commands/bump';
import { canary } from './commands/canary';
import { change } from './commands/change';
import { init } from './commands/init';
import { publish } from './commands/publish';
import { sync } from './commands/sync';

import { showVersion, showHelp } from './help';
import { getPackageInfos } from './monorepo/getPackageInfos';
import { getParsedOptions } from './options/getOptions';
import { validate } from './validation/validate';

(async () => {
  try {
    // eslint-disable-next-line no-restricted-properties -- top-level call
    findGitRoot(process.cwd());
  } catch {
    console.error('beachball only works in a git repository. Please initialize git and try again.');
    // eslint-disable-next-line no-restricted-properties
    process.exit(1);
  }

  // eslint-disable-next-line no-restricted-properties -- this is the top level
  const parsedOptions = getParsedOptions({ cwd: process.cwd(), argv: process.argv });
  const options = parsedOptions.options;

  if (options.help) {
    showHelp();
    return;
  }

  if (options.version) {
    showVersion();
    return;
  }

  // Run the commands
  switch (options.command) {
    case 'check': {
      validate(options, { checkChangeNeeded: true, checkDependencies: true }, getPackageInfos(parsedOptions));
      console.log('No change files are needed');
      break;
    }

    case 'publish': {
      const packageInfos = getPackageInfos(parsedOptions);
      const { bumpInfo } = validate(options, { checkDependencies: true }, packageInfos);

      // set a default publish message
      options.message = options.message || 'applying package updates';
      await publish(options, packageInfos, bumpInfo);
      break;
    }

    case 'bump': {
      const packageInfos = getPackageInfos(parsedOptions);
      const { bumpInfo } = validate(options, { checkDependencies: true }, packageInfos);
      await bump(options, packageInfos, bumpInfo);
      break;
    }

    case 'canary': {
      const packageInfos = getPackageInfos(parsedOptions);
      const { bumpInfo } = validate(options, { checkDependencies: true }, packageInfos);
      await canary(options, packageInfos, bumpInfo);
      break;
    }

    case 'init': {
      await init(options);
      break;
    }

    case 'sync': {
      await sync(options, getPackageInfos(parsedOptions));
      break;
    }

    case 'change': {
      const packageInfos = getPackageInfos(parsedOptions);
      const { isChangeNeeded } = validate(
        options,
        { checkChangeNeeded: true, allowMissingChangeFiles: true },
        packageInfos
      );

      if (!isChangeNeeded && !options.package) {
        console.log('No change files are needed');
        return;
      }

      await change(options, packageInfos);

      break;
    }

    default:
      throw new Error('Invalid command: ' + options.command);
  }
})().catch(e => {
  showVersion();
  console.error('An error has been detected while running beachball!');
  console.error((e as Error)?.stack || e);

  // eslint-disable-next-line no-restricted-properties -- this is the top level
  process.exit(1);
});

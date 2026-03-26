import { findGitRoot } from 'workspace-tools';
import { bump } from './commands/bump';
import { canary } from './commands/canary';
import { change } from './commands/change';
import { configGet } from './commands/configGet';
import { init } from './commands/init';
import { publish } from './commands/publish';
import { sync } from './commands/sync';

import { showVersion, showHelp } from './help';
import { getPackageInfos } from './monorepo/getPackageInfos';
import { getParsedOptions } from './options/getOptions';
import { validate } from './validation/validate';
import { getScopedPackages } from './monorepo/getScopedPackages';
import { BeachballError } from './types/BeachballError';

(async () => {
  try {
    // eslint-disable-next-line no-restricted-properties -- top-level call
    findGitRoot(process.cwd());
  } catch {
    throw new BeachballError('beachball only works in a git repository. Please initialize git and try again.');
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
      validate(parsedOptions, { checkChangeNeeded: true, checkDependencies: true });
      console.log('No change files are needed');
      break;
    }

    case 'publish': {
      const { context } = validate(parsedOptions, { checkDependencies: true });

      // set a default publish message
      options.message = options.message || 'applying package updates';
      await publish(options, context);
      break;
    }

    case 'bump': {
      const { context } = validate(parsedOptions, { checkDependencies: true });
      await bump(options, context);
      break;
    }

    case 'canary': {
      const { context } = validate(parsedOptions, { checkDependencies: true });
      await canary(options, context);
      break;
    }

    case 'init': {
      await init(options);
      break;
    }

    case 'sync': {
      // This one is a special case where it doesn't run validate, so calculate the context here
      const originalPackageInfos = getPackageInfos(parsedOptions);
      const scopedPackages = getScopedPackages(options, originalPackageInfos);
      await sync(options, { originalPackageInfos, scopedPackages });
      break;
    }

    case 'change': {
      const { isChangeNeeded, context } = validate(parsedOptions, {
        checkChangeNeeded: true,
        allowMissingChangeFiles: true,
      });

      if (!isChangeNeeded && !options.package) {
        console.log('No change files are needed');
        return;
      }

      await change(options, context);

      break;
    }

    case 'config': {
      const extraArgs = options._extraPositionalArgs || [];
      if (extraArgs[0] !== 'get' || extraArgs.length !== 2) {
        throw new BeachballError(
          'Usage: beachball config get <setting>\n\nGets the value of the specified config setting.'
        );
      }
      configGet(options, extraArgs[1], parsedOptions);
      break;
    }

    default:
      throw new Error('Invalid command: ' + options.command);
  }
})().catch(e => {
  if (e instanceof BeachballError && e.alreadyLogged) {
    // Error details were already printed -- just exit
  } else if (e instanceof BeachballError) {
    // Expected error, not yet logged -- print the message (no stack trace)
    console.error(e.message);
  } else {
    // Unexpected error -- print full details including stack
    showVersion();
    console.error('Unexpected error while running beachball!');
    console.error((e as Error)?.stack || e);
  }

  // eslint-disable-next-line no-restricted-properties -- this is the only place that should call process.exit
  process.exit(1);
});

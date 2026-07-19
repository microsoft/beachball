import { findGitRoot, findPackageRoot, getPackageInfo } from 'workspace-tools';
import { bump } from './commands/bump';
import { canary } from './commands/canary';
import { change } from './commands/change';
import { configGet } from './commands/configGet';
import { configList } from './commands/configList';
import { init } from './commands/init';
import { migrate } from './commands/migrate';
import { publish } from './commands/publish';
import { sync } from './commands/sync';
import { updateLockFileRegistry } from './commands/updateLockFileRegistry';

import { getOptions } from './options/getOptions';
import { validate } from './validation/validate';
import { BeachballError } from './types/BeachballError';
import { createBasicCommandContext } from './monorepo/createCommandContext';

// eslint-disable-next-line no-restricted-properties -- top-level call
const processCwd = process.cwd();
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const version = getPackageInfo(findPackageRoot(__dirname)!)?.version;

(async () => {
  try {
    findGitRoot(processCwd);
  } catch {
    throw new BeachballError('beachball only works in a git repository. Please initialize git and try again.');
  }

  const parsedOptions = getOptions({ cwd: processCwd, argv: process.argv, env: process.env, version });
  const options = parsedOptions.options;

  // TODO port remaining help elements and remove help.ts
  // if (options.help) {
  //   showHelp();
  //   return;
  // }

  // Run the commands
  switch (options.command) {
    case 'check': {
      validate(parsedOptions, { checkChangeNeeded: true, checkDependencies: true });
      console.log('No change files are needed');
      break;
    }

    case 'publish': {
      const { context } = validate(parsedOptions, { checkDependencies: true });

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

    case 'migrate': {
      migrate(parsedOptions);
      break;
    }

    case 'sync':
      // This one is a special case where it doesn't run validate, so calculate the context here
      await sync(options, createBasicCommandContext(parsedOptions));
      break;

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

    case 'config get':
      configGet(options, createBasicCommandContext(parsedOptions));
      break;

    case 'config list':
      configList(options, createBasicCommandContext(parsedOptions));
      break;

    case 'publish-helpers update-lock-registry':
      updateLockFileRegistry(options);
      break;

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
    console.log(`beachball v${version}`);
    console.error('Unexpected error while running beachball!');
    console.error((e as Error)?.stack || e);
  }

  // eslint-disable-next-line no-restricted-properties -- this is the only place that should call process.exit
  process.exit(1);
});

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
  const parsedOptions = getParsedOptions({ cwd: process.cwd(), argv: process.argv });
  const options = parsedOptions.options;

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (options.version) {
    showVersion();
    process.exit(0);
  }

  // Run the commands
  switch (options.command) {
    case 'check': {
      validate(options, { checkChangeNeeded: true, checkDependencies: true }, getPackageInfos(parsedOptions));
      console.log('No change files are needed');
      break;
    }

    case 'publish': {
      await publish(options);
      break;
    }

    case 'bump': {
      await bump(options);
      break;
    }

    case 'canary': {
      await canary(options);
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
      await change(options);
      break;
    }

    default:
      throw new Error('Invalid command: ' + options.command);
  }
})().catch(e => {
  showVersion();
  console.error('An error has been detected while running beachball!');
  console.error((e as Error)?.stack || e);

  process.exit(1);
});

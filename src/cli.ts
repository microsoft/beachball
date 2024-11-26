import { bump } from './commands/bump';
import { canary } from './commands/canary';
import { change } from './commands/change';
import { init } from './commands/init';
import { publish } from './commands/publish';
import { sync } from './commands/sync';

import { showVersion, showHelp } from './help';
import { getOptions } from './options/getOptions';
import { validate } from './validation/validate';

(async () => {
  const options = getOptions(process.argv);

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
    case 'check':
      validate(options, { checkChangeNeeded: true, checkDependencies: true });
      console.log('No change files are needed');
      break;

    case 'publish':
      validate(options, { checkDependencies: true });

      // set a default publish message
      options.message = options.message || 'applying package updates';
      await publish(options);
      break;

    case 'bump':
      validate(options, { checkDependencies: true });
      await bump(options);
      break;

    case 'canary':
      validate(options, { checkDependencies: true });
      await canary(options);
      break;

    case 'init':
      await init(options);
      break;

    case 'sync':
      await sync(options);
      break;

    case 'change': {
      const { isChangeNeeded } = validate(options, { checkChangeNeeded: true, allowMissingChangeFiles: true });

      if (!isChangeNeeded && !options.package) {
        console.log('No change files are needed');
        return;
      }

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

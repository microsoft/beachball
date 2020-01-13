import { bump } from './commands/bump';
import { change } from './commands/change';
import { publish } from './commands/publish';

import { showVersion, showHelp } from './help';
import { getOptions } from './options/getOptions';
import { validate } from './validation/validate';

(async () => {
  const options = getOptions();

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
      validate();
      console.log('No change files are needed');
      break;

    case 'publish':
      validate();
      // set a default publish message
      options.message = options.message || 'applying package updates';
      publish(options);
      break;

    case 'bump':
      validate();
      bump(options);
      break;

    default:
      const { isChangeNeeded } = validate({ allowMissingChangeFiles: true });

      if (!isChangeNeeded && !options.package) {
        console.log('No change files are needed');
        return;
      }

      change(options);

      break;
  }
})().catch(e => {
  showVersion();
  console.error('An error has been detected while running beachball!');
  console.error(e);

  process.exit(1);
});

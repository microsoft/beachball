import { bump } from './bump';
import { getUntrackedChanges } from './git';
import {
  isChangeFileNeeded as checkChangeFileNeeded,
  isGitAvailable,
  isValidPackageName,
  isValidChangeType,
} from './validation';
import { promptForChange, writeChangeFiles } from './changefile';
import { publish } from './publish';
import { showVersion } from './help';
import { getOptions } from './options';

(async () => {
  const options = getOptions();

  // Validation Steps
  if (!isGitAvailable(options.path)) {
    console.error('ERROR: Please make sure git is installed and initialize the repository with "git init".');
    process.exit(1);
  }

  const untracked = getUntrackedChanges(options.path);

  if (untracked && untracked.length > 0) {
    console.warn('WARN: There are untracked changes in your repository:');
    console.warn('- ' + untracked.join('\n- '));
    console.warn('Changes in these files will not trigger a prompt for change descriptions');
  }

  const isChangeNeeded = checkChangeFileNeeded(options.branch, options.path, options.fetch);

  if (isChangeNeeded && options.command !== 'change') {
    console.error('ERROR: Change files are needed!');
    console.log(options.changehint);
    process.exit(1);
  }

  if (options.package && !isValidPackageName(options.package, options.path)) {
    console.error('ERROR: Specified package name is not valid');
    process.exit(1);
  }

  if (options.type && !isValidChangeType(options.type)) {
    console.error(`ERROR: change type ${options.type} is not valid`);
    process.exit(1);
  }

  // Run the commands
  switch (options.command) {
    case 'check':
      console.log('No change files are needed');
      break;

    case 'publish':
      // set a default publish message
      options.message = options.message || 'applying package updates';
      publish(options);
      break;

    case 'bump':
      bump(options.path, options.bumpDeps);
      break;

    default:
      if (!isChangeNeeded && !options.package) {
        console.log('No change files are needed');
        return;
      }

      const changes = await promptForChange(options);

      if (changes) {
        writeChangeFiles(changes, options.path);
      }

      break;
  }
})().catch(e => {
  showVersion();
  console.error('An error has been detected while running beachball!');
  console.error(e);

  process.exit(1);
});

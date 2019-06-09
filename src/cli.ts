import { promptForChange, writeChangeFiles } from './changefile';
import { getUncommittedChanges } from './git';
import { isChangeFileNeeded, isGitAvailable } from './validation';
import { bump } from './bump';
import parser from 'yargs-parser';
import { findPackageRoot } from './paths';
import { publish } from './publish';

let argv = process.argv.splice(2);
let args = parser(argv, {
  alias: {
    path: ['p']
  }
});

const defaultCommand = 'change';
const command = args._.length === 0 ? defaultCommand : args._[0];
const cwd = args.path || findPackageRoot(process.cwd());

(async () => {
  if (!isGitAvailable(cwd)) {
    console.error('Please make sure git is installed and initialize the repository with "git init".');
    process.exit(1);
  }

  const uncommitted = getUncommittedChanges(cwd);

  if (uncommitted && uncommitted.length > 0) {
    console.warn('There are uncommitted changes in your repository. Please commit these files first:');
    console.warn('- ' + uncommitted.join('\n- '));
    return;
  }

  if (isChangeFileNeeded(cwd) && command !== 'change') {
    console.log('Change files are needed!');
    process.exit(1);
  }

  switch (command) {
    case 'check':
      console.log('No change files are needed');
      break;

    case 'publish':
      publish(cwd);
      break;

    case 'bump':
      bump(cwd);
      break;

    default:
      if (!isChangeFileNeeded(cwd)) {
        console.log('No change files are needed');
        return;
      }

      const changes = await promptForChange(cwd);

      if (changes) {
        writeChangeFiles(changes, cwd);
      }

      break;
  }
})();

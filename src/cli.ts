import { promptForChange, writeChangeFiles } from './changefile';
import { getUncommittedChanges } from './git';
import { isChangeFileNeeded } from './validation';

const argv = process.argv.splice(2);

const commands = ['check', 'bump'];
let command = null;

if (commands.includes(argv[0])) {
  command = argv[0];
  argv.unshift();
}

const cwd = argv[0] || process.cwd();

(async () => {
  switch (command) {
    case 'check':
      break;

    case 'bump':
      break;

    default:
      const uncommitted = getUncommittedChanges(cwd);

      if (uncommitted && uncommitted.length > 0) {
        console.warn('There are uncommitted changes in your repository. Please commit these files first:');
        console.warn('- ' + uncommitted.join('\n- '));
        return;
      }

      if (!isChangeFileNeeded(cwd)) {
        console.log('No change files are needed!');
        return;
      }

      const changes = await promptForChange(cwd);

      if (changes) {
        writeChangeFiles(changes, cwd);
      }

      break;
  }
})();

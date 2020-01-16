import { isGitAvailable } from './isGitAvailable';
import { getUntrackedChanges } from '../git';
import { isValidPackageName } from './isValidPackageName';
import { isValidChangeType } from './isValidChangeType';
import { isChangeFileNeeded } from './isChangeFileNeeded';
import { isValidGroupOptions } from './isValidGroupOptions';
import { BeachballOptions } from '../types/BeachballOptions';

export function validate(
  options: BeachballOptions,
  validateOptions: { allowMissingChangeFiles: boolean } = { allowMissingChangeFiles: false }
) {
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

  if (options.package && !isValidPackageName(options.package, options.path)) {
    console.error('ERROR: Specified package name is not valid');
    process.exit(1);
  }

  if (options.type && !isValidChangeType(options.type)) {
    console.error(`ERROR: change type ${options.type} is not valid`);
    process.exit(1);
  }

  const isChangeNeeded = isChangeFileNeeded(options.branch, options.path, options.fetch);

  if (isChangeNeeded && !validateOptions.allowMissingChangeFiles) {
    console.error('ERROR: Change files are needed!');
    console.log(options.changehint);
    process.exit(1);
  }

  if (options.groups && !isValidGroupOptions(options.path, options.groups)) {
    console.error('ERROR: Groups defined inside the configuration is invalid');
    console.log(options.groups);
    process.exit(1);
  }

  return {
    isChangeNeeded,
  };
}

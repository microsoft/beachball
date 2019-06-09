import { bump } from './bump';
import { packagePublish } from './packageManager';
import path from 'path';
import { git } from './git';

export function publish(cwd?: string) {
  cwd = cwd || process.cwd();

  // checkout publish branch
  const publishBranch = 'publish_' + String(new Date().getTime());
  git(['checkout', '-b', publishBranch]);

  // bump the version
  const bumpInfo = bump(cwd);

  // npm / yarn publish
  Object.keys(bumpInfo.packageChangeTypes).forEach(pkg => {
    const packageInfo = bumpInfo.packageInfos[pkg];
    console.log(`Publishing - ${packageInfo.name}@${packageInfo.version}`);
    packagePublish(path.dirname(packageInfo.packageJsonPath));
  });

  // reset
  git(['reset', '--hard'], { cwd });

  // fetch and merge from latest
  git(['fetch', 'origin'], { cwd });
  git(['merge', '--theirs', 'origin/master'], { cwd });

  // bump the version
  bump(cwd);

  // checkin
  git(['add', '.'], { cwd });
  git(['commit', '-m', '"applying package updates"'], { cwd });
  git(['checkout', 'master'], { cwd });
  git(['merge', publishBranch], { cwd });

  // push
  // git(['push']);
}

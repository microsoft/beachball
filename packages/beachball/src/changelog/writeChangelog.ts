import path from 'path';
import fs from 'fs';
import { ChangeSet } from '../types/ChangeInfo';
import { PackageInfo } from '../types/PackageInfo';
import { getPackageChangelogs } from "./getPackageChangelogs";
import { renderChangelog } from "./renderChangelog";
import { renderJsonChangelog } from "./renderJsonChangelog";
export function writeChangelog(changeSet: ChangeSet, packageInfos: {
  [pkg: string]: PackageInfo;
}) {
  const changelogs = getPackageChangelogs(changeSet, packageInfos);
  Object.keys(changelogs).forEach(pkg => {
    const packagePath = path.dirname(packageInfos[pkg].packageJsonPath);
    if (changelogs[pkg].comments.major ||
      changelogs[pkg].comments.minor ||
      changelogs[pkg].comments.patch ||
      changelogs[pkg].comments.prerelease) {
      const changelogFile = path.join(packagePath, 'CHANGELOG.md');
      const previousContent = fs.existsSync(changelogFile) ? fs.readFileSync(changelogFile).toString() : '';
      const nextContent = renderChangelog(previousContent, changelogs[pkg]);
      fs.writeFileSync(changelogFile, nextContent);
    }
    try {
      const changelogJsonFile = path.join(packagePath, 'CHANGELOG.json');
      const previousJson = fs.existsSync(changelogJsonFile)
        ? JSON.parse(fs.readFileSync(changelogJsonFile).toString())
        : { entries: [] };
      const nextJson = renderJsonChangelog(previousJson, changelogs[pkg]);
      fs.writeFileSync(changelogJsonFile, JSON.stringify(nextJson, null, 2));
    }
    catch (e) {
      console.warn('The CHANGELOG.json file is invalid, skipping writing to it', e);
    }
  });
}

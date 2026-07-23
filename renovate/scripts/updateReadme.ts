import fs from 'fs';
import path from 'path';
import { git } from 'workspace-tools';
import { logError } from './utils/github.ts';
import { getComments, getHeadingText, getMarkedSection, slugify, splitByHeading } from './utils/markdown.ts';
import { paths } from './utils/paths.ts';
import { readPresets } from './utils/readPresets.ts';
import { updateAndFormat } from './utils/runBin.ts';
import { repoPresetPrefix } from './utils/extends.ts';

const readmePath = path.join(paths.renovateRoot, 'README.md');

type PresetSection = {
  name: string;
  nameWithArgs: string;
  content: string;
};
type PresetGroup = {
  name: string;
  presets: (string | RegExp)[];
  rest?: boolean;
};
type PresetExtraTexts = { [presetName: string]: string };

const presetGroups: PresetGroup[] = [
  {
    name: 'Full config presets',
    presets: ['default', 'base', 'beachball'],
  },
  {
    name: 'Compatibility presets',
    presets: ['disableEsmVersions', 'restrictNode'],
  },
  {
    name: 'Scheduling and control presets',
    presets: ['keepFresh', 'scheduleNoisy', 'dependencyDashboardMajor'],
  },
  {
    name: 'Grouping presets',
    presets: ['groupMore', /^group/],
  },
  {
    // This group MUST be last!
    name: 'Other presets',
    presets: [],
    rest: true,
  },
];

const comments = {
  /** Wraps all the generated presets content (except the table of contents) */
  main: getComments('presets'),
  /** Wraps the presets table of contents (should be *outside* the main comments) */
  toc: getComments('presets TOC'),
  /** Wraps extra content within each preset's docs */
  extra: getComments('extra content', 'EDITABLE between these comments'),
};
const requiredComments: string[] = ([] as string[]).concat(
  ...[comments.main, comments.toc].map(({ start, end }) => [start, end])
);

/**
 * Get any extra text added for each preset
 */
function getPresetExtraTexts(presetNames: string[], presetsSection: string) {
  const presetExtraTexts: PresetExtraTexts = {};
  splitByHeading(presetsSection, 4)
    .slice(1) // remove the first part, which will be an h3
    .forEach(text => {
      const presetName = getHeadingText(text, 4)
        .replace(/`/g, '')
        .replace(/\(.*\)$/, ''); // remove args
      if (!presetName) {
        console.warn('Section REMOVED since it did not match expected format:\n', text);
      } else if (!presetNames.includes(presetName)) {
        console.warn(`Section "${presetName}" REMOVED since a matching file was not found`);
      } else if (!text.includes(comments.extra.start) || !text.includes(comments.extra.end)) {
        console.warn(`Section "${presetName}" REMOVED since marker comments are missing`);
      } else {
        presetExtraTexts[presetName] = getMarkedSection(text, comments.extra);
      }
    });
  return presetExtraTexts;
}

/**
 * @param check If true, throw if the readme is out of date. Otherwise, update it.
 */
export async function updateReadme(check?: boolean): Promise<void> {
  // read the readme and replace newlines for ease of processing
  const originalReadme = fs.readFileSync(readmePath, 'utf8').replace(/\r?\n/g, '\n');

  const missingComments = requiredComments.filter(comment => !originalReadme.includes(comment));
  if (missingComments.length) {
    console.error(`Readme is missing section marker comment(s):\n  ${missingComments.join('  \n')}`);
    process.exit(1);
  }

  const presets = readPresets();
  const presetNames = presets.map(p => p.name);

  const presetsSection = getMarkedSection(originalReadme, comments.main);

  const presetExtraTexts = getPresetExtraTexts(presetNames, presetsSection);

  // Generate preset sections based on the descriptions, custom text, and other JSON
  const newPresets = presets.map(({ name, content, json }): PresetSection => {
    const presetArgs = content.match(/{{arg\d}}/g);
    const presetNameWithArgs = presetArgs
      ? `${name}(${presetArgs.map(arg => `<${arg.slice(2, -2)}>`).join(', ')})`
      : name;
    const extraContent = presetExtraTexts[name] || '';

    const { description, $schema, ...otherJson } = json;
    const modifiedJson = JSON.stringify(otherJson, null, 2);
    const hasInRepoExtends = !!json.extends?.some((e: string) => e.startsWith(repoPresetPrefix));

    return {
      name,
      nameWithArgs: presetNameWithArgs,
      content: `
#### \`${presetNameWithArgs}\`

\`\`\`jsonc${hasInRepoExtends ? "\n// ⚠️ This preset can't be pinned to a #tag" : ''}
"extends": ["${repoPresetPrefix}${name}"]
\`\`\`

${description || ''}

<details><summary><b>Show config JSON</b></summary>

\`\`\`json
${modifiedJson}
\`\`\`

</details>

${comments.extra.start}
${extraContent}

${comments.extra.end}

---
`,
    };
  });

  // Group the presets into sections
  const remainingPresets = [...newPresets];
  const newPresetGroups = presetGroups.map(group => {
    const { name, presets: presetsToGroup, rest } = group;
    const includedPresets: PresetSection[] = [];

    if (rest) {
      // catch-all case: add all remaining presets to the group
      includedPresets.push(...remainingPresets);
    } else {
      // normal case: find the matching preset names and add to the group
      for (const presetName of presetsToGroup) {
        if (typeof presetName === 'string') {
          const presetIndex = remainingPresets.findIndex(p => p.name === presetName);
          if (presetIndex === -1) {
            console.warn(`Missing preset "${presetName}" for group "${name}"`);
          } else {
            includedPresets.push(remainingPresets.splice(presetIndex, 1)[0]);
          }
        } else {
          // presetName is a regex, so find the matching items
          const matchingPresets = remainingPresets.filter(p => presetName.test(p.name));
          includedPresets.push(...matchingPresets);
          // remove them from the remaining items
          matchingPresets.forEach(p => remainingPresets.splice(remainingPresets.indexOf(p), 1));
        }
      }
    }

    return {
      name,
      presets: includedPresets,
      content: [`### ${name}`, '', ...includedPresets.map(p => p.content)].join('\n'),
    };
  });

  // Generate the TOC for the presets
  const oldToc = getMarkedSection(originalReadme, comments.toc);
  const newToc = newPresetGroups
    .map(group =>
      [
        `- [${group.name}](#${slugify(group.name)})`,
        ...group.presets.map(p => `  - [${p.name}](#${slugify(p.nameWithArgs)})`),
      ].join('\n')
    )
    .join('\n');

  // Update readme and format
  await updateAndFormat(
    readmePath,
    originalReadme.replace(presetsSection, newPresetGroups.map(g => g.content).join('\n')).replace(oldToc, newToc)
  );
  const newReadme = fs.readFileSync(readmePath, 'utf8').replace(/\r?\n/g, '\n');

  if (newReadme.trim() === originalReadme.trim()) {
    console.log('\nReadme is up to date!\n');
  } else {
    if (check) {
      git(['--no-pager', 'diff', readmePath]);
      throw new Error(
        "Readme is out of date (see above for diff). Please run 'yarn update-readme' and commit the changes."
      );
    } else {
      console.log('\nUpdated readme!\n');
    }
  }
}

if (import.meta.main) {
  const check = process.argv.includes('--check');
  updateReadme(check).catch(err => {
    logError((err as Error).stack || err);
    process.exit(1);
  });
}

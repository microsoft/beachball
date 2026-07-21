import assert from 'assert';
import fs from 'fs';
import jju from 'jju';
import path from 'path';
import { Transform } from 'stream';
import { updateAndFormat } from './utils/updateAndFormat.ts';
import { isGithub, logEndGroup, logError, logOther, logGroup } from './utils/github.ts';
import { paths } from './utils/paths.ts';
import { readPresetsAndConfigs, specialConfigNames } from './utils/readPresets.ts';
import { formatRenovateLog } from './utils/renovateLogs.ts';
import { verifyRenovate, runRenovate } from './utils/runRenovate.ts';
import type { ConfigData, LocalPresetData, RenovateLog } from './utils/types.ts';

const presetArgIndex = process.argv.indexOf('--preset');
const presetArg = presetArgIndex >= 0 ? process.argv[presetArgIndex + 1] : undefined;

type Result = 'error' | 'unknown' | 'ok';

/**
 * Validate a preset or config file.
 */
async function checkFile(preset: ConfigData, hasInvalidRepoConfig: boolean): Promise<Result> {
  const { absolutePath, filename } = preset;

  // Use renovate-config-validator to test for blatantly invalid configuration
  // and for configs needing migration.
  const configProcess = runRenovate('renovate-config-validator', {
    args: ['--no-global', absolutePath],
    logLevel: 'warn',
    // log as JSON to make it easier to determine if migration is needed
    logFormat: 'json',
    logFile: paths.logFileBasic,
    logFileLevel: 'debug',
    options: { stdio: 'pipe' },
  });

  let migratedConfig: unknown;
  let newConfig: unknown;
  const errorMessages = new Set<string>();
  // Format the JSON logs as nice text (to be sent to stdout) and detect special properties,
  // including `migratedConfig` (or `newConfig`) indicating that the config needs migration
  const logTransform = new Transform({
    transform(chunk, _encoding, callback) {
      let logJson: RenovateLog;
      try {
        logJson = JSON.parse(String(chunk)) as RenovateLog;
      } catch {
        return callback(null, String(chunk));
      }

      if (logJson.migratedConfig) {
        // Config migration message
        migratedConfig = logJson.migratedConfig;
        callback(null, '');
      } else if (logJson.newConfig) {
        // Alternate config migration message...?
        // (not sure why it's logged twice, but capture both in case it changes in the future)
        newConfig = logJson.newConfig;
        callback(null, '');
      } else if (logJson.errors?.[0]?.message) {
        // The errors are from this preset/config, so save them to log later
        // (for the repo config it logs the same errors twice, so use a set)
        for (const error of logJson.errors) {
          errorMessages.add(error.message);
        }
        callback(null, '');
      } else {
        // Unknown log
        callback(null, formatRenovateLog(logJson, true) + '\n');
      }
    },
  });

  // Redirect formatted logs to stdout, and wait for the process
  configProcess.all?.pipe(logTransform).pipe(process.stdout);
  const processFailed = (await configProcess).failed;

  if (errorMessages.size > 0) {
    logError(`❌ Found errors in ${filename}:\n` + [...errorMessages].map(msg => `    - ${msg}`).join('\n'), filename);
    return 'error';
  }

  if (processFailed) {
    // No errors specific to this preset were logged in the expected format, but the process
    // exited non-0. If the repo config also failed to validate, that's probably why.
    // Otherwise it's hard to say or might be a bug in this test.
    if (hasInvalidRepoConfig) {
      logOther(
        'warning',
        `Validation exited non-0, but this was probably due to repo config errors. ` + 'See logs for details.',
        filename
      );
      return 'unknown';
    }

    logError(`Unknown error validating ${filename}. See logs for details.`, filename);
    return 'error';
  }

  const updatedConfig = migratedConfig || newConfig;
  if (updatedConfig) {
    if (preset.json && preset.content) {
      return migrateConfig(preset as LocalPresetData, updatedConfig);
    }

    // The server config can't be auto-migrated because it's JS
    logError(`❌ ${filename} requires migration, but must be updated manually (see logs).`, filename);
    console.log(JSON.stringify(updatedConfig, null, 2));
    return 'error';
  }

  return 'ok';
}

/**
 * Write migrated config content to a file and format it if appropriate.
 */
async function migrateConfig(preset: LocalPresetData, migratedConfig: unknown): Promise<Result> {
  const { name, filename, absolutePath, content } = preset;
  const migratedContent = jju.update(content, migratedConfig, {
    indent: 2,
    mode: path.extname(filename) === '.json5' ? 'cjson' : 'json',
  });

  // Update the file if running locally or this is the repo config (to prevent others from failing).
  // There's no point in updating other configs in CI since they can't be committed.
  const isRepoConfig = name === specialConfigNames.repoConfig;
  let result: Result = 'ok';

  if (isGithub) {
    result = 'error';
    // Log errors for CI
    logError(
      `❌ ${filename} requires migration.\n` +
        (isRepoConfig ? 'This will be done locally in CI so the other presets can be validated, but you ' : 'You ') +
        'must update this config by either running this test locally or manually copying the following content.',
      filename
    );
    console.log(migratedContent);
  }

  if (!isGithub || isRepoConfig) {
    // Actually update and format the file
    console.log(`Migrating ${filename} (see git diff for details)`);
    await updateAndFormat(absolutePath, migratedContent);
  }

  return result;
}

async function runTests() {
  await verifyRenovate();

  // Create an empty log file before the tests start (renovate will append to this file)
  fs.writeFileSync(paths.logFileBasic, '');

  const presets = readPresetsAndConfigs();

  // The repo config must be checked first (and migrated if necessary) because Renovate will
  // always include it in the other configs
  assert(
    presets[0].name === specialConfigNames.repoConfig,
    'Repo config must be first in the list returned by readPresets'
  );

  const allPresetNames = presets.map(p => p.name);
  if (presetArg && !allPresetNames.includes(presetArg)) {
    logError(`Invalid preset name "${presetArg}"`);
    process.exit(1);
  }

  const maybeFailedPresets: string[] = [];
  const failedPresets: string[] = [];

  for (let i = 0; i < presets.length; i++) {
    const preset = presets[i];
    if (presetArg && preset.name !== presetArg) {
      continue;
    }

    logGroup(`Validating ${preset.filename}`);

    const configResult = await checkFile(preset, failedPresets.includes(paths.repoRenovateConfigRel));

    if (configResult === 'error') {
      failedPresets.push(preset.filename);
    } else if (configResult === 'unknown') {
      maybeFailedPresets.push(preset.filename);
    }

    if (i === 0 && configResult !== 'ok') {
      console.error('The repo config is invalid, so skipping the other presets.');
      break;
    }

    logEndGroup();
  }

  if (maybeFailedPresets.length) {
    logOther(
      'warning',
      'Validating the following preset(s)/config(s) failed, but this may be due to errors in the repo config:\n' +
        maybeFailedPresets.map(p => `    - ${p}`).join('\n')
    );
  }

  if (failedPresets.length) {
    logError(
      '❌ Validating the following preset(s)/config(s) failed (see logs above for details):\n' +
        failedPresets.map(p => `    - ${p}`).join('\n')
    );
  }

  console.log();
  process.exit(failedPresets.length + maybeFailedPresets.length > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error((err as Error).stack || err);
  process.exit(1);
});

import fs from 'fs';
import jju from 'jju';
import path from 'path';
import { isGithub, logEndGroup, logError, logGroup, logOther } from './utils/github.ts';
import { paths } from './utils/paths.ts';
import { readPresets, readRepoConfig, getServerConfig, specialConfigNames } from './utils/readPresets.ts';
import { parseRenovateLogs } from './utils/renovateLogs.ts';
import { runRenovate, updateAndFormat, verifyRenovate } from './utils/runBin.ts';
import type { ConfigData, LocalPresetData } from './utils/types.ts';

const presetArgIndex = process.argv.indexOf('--preset');
const presetArg = presetArgIndex >= 0 ? process.argv[presetArgIndex + 1] : undefined;

const logLocation = isGithub ? 'log artifact' : `log file at ${paths.logFileBasic}`;

type Result = 'error' | 'unknown' | 'ok';

async function runTests() {
  await verifyRenovate();

  // Create an empty log file before the tests start (renovate will append to this file)
  fs.writeFileSync(paths.logFileBasic, '');

  const repoConfig = readRepoConfig();
  const serverConfig = getServerConfig();
  const presets = [repoConfig, ...readPresets(), serverConfig];

  if (presetArg && !presets.some(p => p.name === presetArg)) {
    logError(`Invalid preset name "${presetArg}"`);
    process.exit(1);
  }

  const maybeFailedPresets: string[] = [];
  const failedPresets: string[] = [];

  for (const preset of presets) {
    if (presetArg && preset.name !== presetArg) {
      continue;
    }

    const isServerConfig = preset === serverConfig;
    if (isServerConfig && failedPresets.includes(repoConfig.name)) {
      // The server config validation would probably check the repo config automatically
      logOther('warning', 'Skipping server config validation because the repo config validation failed.');
      maybeFailedPresets.push(preset.name);
      continue;
    }

    logGroup(`Validating ${preset.name}`);

    const configResult = await checkFile(preset, isServerConfig);

    if (configResult === 'error') {
      failedPresets.push(preset.name);
    } else if (configResult === 'unknown') {
      maybeFailedPresets.push(preset.name);
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
      `❌ Validating the following preset(s)/config(s) failed (see logs above or ${logLocation} for details):\n` +
        failedPresets.map(p => `    - ${p}`).join('\n')
    );
  }

  console.log();
  process.exit(failedPresets.length + maybeFailedPresets.length > 0 ? 1 : 0);
}

/**
 * Validate a preset or config file.
 */
async function checkFile(preset: ConfigData, isServerConfig: boolean): Promise<Result> {
  const { absolutePath, name } = preset;
  const relPath = path.relative(paths.root, absolutePath);

  // The log file is reused, so include a marker for each config
  fs.appendFileSync(paths.logFileBasic, JSON.stringify({ customStartMarker: preset.absolutePath }) + '\n');

  // Use renovate-config-validator to test for blatantly invalid configuration
  // and for configs needing migration.
  const runResult = await runRenovate('renovate-config-validator', {
    args: [
      '--strict',
      // The server config should be validated as a self-hosted config; others shouldn't
      ...(isServerConfig ? [] : ['--no-global']),
      absolutePath,
    ],
    logLevel: 'warn',
    logFile: paths.logFileBasic,
  });

  const { migratedConfig, newConfig, errors, warnings } = parseRenovateLogs(paths.logFileBasic, absolutePath);

  // there could be both errors and migration, so show both
  let hasError = false;
  if (errors?.length || warnings?.length) {
    const allMessages = [...(errors || []), ...(warnings || []).map(w => `[warning] ${w}`)];
    logError(`❌ Found issues in ${name}:\n${allMessages.map(msg => `    - ${msg}`).join('\n')}`);
    hasError = true;
  }

  const updatedConfig = migratedConfig || newConfig;
  if (updatedConfig) {
    if (preset.json && preset.content) {
      const migrateResult = await migrateConfig(preset as LocalPresetData, updatedConfig);
      return hasError ? 'error' : migrateResult;
    }

    // The server config can't be auto-migrated because it's JS
    logError(`❌ ${name} requires migration, but must be updated manually (see logs).`, relPath);
    console.log(JSON.stringify(updatedConfig, null, 2));
    hasError = true;
  }

  if (hasError) {
    return 'error';
  }

  if (runResult.failed) {
    // No errors specific to this preset were logged in the expected format, but the process
    // exited non-0. Most likely the log format has changed and parsing has failed.
    logError(`Unknown error validating ${relPath}. See logs for details.`, relPath);
    return 'error';
  }

  return 'ok';
}

/**
 * Write migrated config content to a file and format it if appropriate.
 */
async function migrateConfig(preset: LocalPresetData, migratedConfig: unknown): Promise<Result> {
  const { name, absolutePath, content } = preset;
  const relPath = path.relative(paths.root, absolutePath);
  const migratedContent = jju.update(content, migratedConfig, {
    indent: 2,
    mode: path.extname(absolutePath) === '.json5' ? 'cjson' : 'json',
  });

  // Update the file if running locally or this is the repo config (to prevent others from failing).
  // There's no point in updating other configs in CI since they can't be committed.
  const isRepoConfig = name === specialConfigNames.repoConfig;
  let result: Result = 'ok';

  if (isGithub) {
    result = 'error';
    // Log errors for CI
    logError(
      `❌ ${name} requires migration.\n` +
        (isRepoConfig ? 'This will be done locally in CI so the other presets can be validated, but you ' : 'You ') +
        'must update this config by either running this test locally or manually copying the following content.',
      relPath
    );
    console.log(migratedContent);
  }

  if (!isGithub || isRepoConfig) {
    // Actually update and format the file
    console.log(`Migrating ${name} (see git diff for details)`);
    await updateAndFormat(absolutePath, migratedContent);
  }

  return result;
}

runTests().catch(err => {
  console.error((err as Error).stack || err);
  process.exit(1);
});

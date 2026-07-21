import path from 'path';
import { findProjectRoot } from 'workspace-tools';

const root = findProjectRoot(process.cwd());
const renovateRoot = path.join(root, 'renovate');
const repoRenovateConfigRel = 'renovate.json5';
const serverConfigRel = 'scripts/serverConfig.ts';

/** Useful paths, all absolute unless otherwise noted */
export const paths = {
  /** Repo root */
  root,
  /** `renovate` directory */
  renovateRoot,
  /** `renovate/presets` directory */
  presetsRoot: path.join(renovateRoot, 'presets'),
  /** Relative path from repo root to renovate config */
  repoRenovateConfigRel,
  /** The repo's own renovate config */
  repoRenovateConfig: path.join(root, repoRenovateConfigRel),
  /** Relative path from repo root to test server config */
  serverConfigRel,
  /** Test server config */
  serverConfig: path.join(renovateRoot, serverConfigRel),
  /** Config validation log file for basic tests, uploaded as an artifact */
  logFileBasic: path.join(renovateRoot, 'renovate.validate.log'),
  /** Dry run log file for full tests, uploaded as an artifact */
  logFileFull: path.join(renovateRoot, 'renovate.log'),
};

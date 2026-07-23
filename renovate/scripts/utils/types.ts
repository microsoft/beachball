export type RenovateLogLevels = {
  trace: 10;
  debug: 20;
  info: 30;
  warn: 40;
  error: 50;
  fatal: 60;
};

export type RenovateLogLevelName = keyof RenovateLogLevels;

/** Entry in Renovate's log file */
export type RenovateLog = {
  msg: string;
  /**
   * - 10 = trace
   * - 20 = debug
   * - 30 = info
   * - 40 = warn
   * - 50 = error
   * - 60 = fatal
   */
  level: RenovateLogLevels[keyof RenovateLogLevels];
  time: string;
  err?: Error & { err?: Error };

  // boring
  name: 'renovate';
  hostname: string;
  pid: number;
  logContext: string;
  v: 0;

  // properties for some log types
  /** migrated config */
  newConfig?: unknown;
  /** old or different context name for migrated config (see `newConfig`) */
  migratedConfig?: unknown;
  /** Config file path or config type for certain logs */
  configType?: string;
  /** Errors in config validation logs (for general caught exceptions, see `err`) */
  errors?: Array<{ topic: string; message: string }>;
  /** Warnings in config validation logs */
  warnings?: Array<{ topic: string; message: string }>;
  /** Errors while running renovate */
  loggerErrors?: RenovateLog[];
  /** Summary of problems at end of logs */
  repoProblems?: string[];
  /** Result code (msg: "Repository finished") on one of the last logs */
  result?: string;
  /** Preset debug log */
  preset?: string;

  /** Custom preset start marker from `testPresetsBasic` */
  customStartMarker?: string;

  // arbitrary properties allowed
  [key: string]: unknown;
};

/** Basic data for a config file or preset */
export type ConfigData = {
  /** Absolute path to the preset file */
  absolutePath: string;
  /** Friendly name of the preset (no extension) */
  name: string;
  /** Content of the preset file. Undefined for server config. */
  content?: string;
  /**
   * Parsed content of the preset file. Undefined for server config.
   * @see https://docs.renovatebot.com/configuration-options/
   */
  json?: BasicRenovateConfig;
};

/**
 * Subset of Renovate config properties used (types are exported from `renovate/dist/config/types.js`
 * but the explicit renovate dep was removed to decrease maintenance overhead)
 * @see https://docs.renovatebot.com/configuration-options/
 */
export type BasicRenovateConfig = {
  $schema?: string;
  description?: string | string[];
  extends?: string[];
  ignorePresets?: string[];
  customManagers?: CustomManagerConfig[];
  packageRules?: PackageRule[];
};

type CustomManagerConfig = {
  customType?: 'regex' | 'jsonata'; // props below are for regex
  managerFilePatterns: string[];
  matchStrings?: string[]; // required for regex
  datasourceTemplate?: string;
  versioningTemplate?: string;
};

// just includes the ones currenly used in tests/etc
type PackageRule = {
  matchManagers?: string[];
  matchCurrentValue?: string;
  enabled?: boolean;
};

export type LocalPresetData = Required<ConfigData>;

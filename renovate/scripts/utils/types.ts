export type RenovateLogLevels = {
  trace: 10;
  debug: 20;
  info: 30;
  warn: 40;
  error: 50;
  fatal: 60;
};

export type RenovateLogLevelName = keyof RenovateLogLevels;

/**
 * - 10 = trace
 * - 20 = debug
 * - 30 = info
 * - 40 = warn
 * - 50 = error
 * - 60 = fatal
 */
export type RenovateLogLevelValue = RenovateLogLevels[keyof RenovateLogLevels];

/** Entry in Renovate's log file */
export type RenovateLog = {
  msg: string;
  level: RenovateLogLevelValue;
  time: string;
  err?: Error & { err?: Error };

  // boring
  name: 'renovate';
  hostname: string;
  pid: number;
  logContext: string;
  v: 0;

  // properties for some log types
  migratedConfig?: unknown;
  newConfig?: unknown; // seems equivalent to migratedConfig
  /** Config file path or config type for certain logs */
  configType?: string;
  /** Errors in config validation logs (for general caught exceptions, see `err`) */
  errors?: Array<{ topic: string; message: string }>;
  /** Errors while running renovate */
  loggerErrors?: RenovateLog[];

  // arbitrary properties allowed
  [key: string]: unknown;
};

/** Renovate log file entry for preset validation */
export type RenovatePresetDebugLog = RenovateLog & { preset: string };

/** Basic data for a config file or preset */
export type ConfigData = {
  /** Absolute path to the preset file */
  absolutePath: string;
  /** Name of the preset (no extension) */
  name: string;
  /** Filename with extension (relative path in the case of .github/renovate.json5) */
  filename: string;
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
  description?: string;
  extends?: string[];
  ignorePresets?: string[];
};

export type LocalPresetData = Required<ConfigData>;

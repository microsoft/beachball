export interface NpmrcAuthConfig {
  npmrcAuthEnabled: boolean;
  npmrcAuthVerbose: boolean;
}

/**
 * If the verbose option is true, log a message to the console with the plugin name as a prefix.
 * @param once If true, only log the message once (subsequent calls with the same message will be ignored)
 */
export type VerboseLogger = ((msg: string, once?: boolean) => void) & {
  /** whether verbose logging is enabled */
  verbose: boolean;
};

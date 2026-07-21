// Wrapper for serverConfig.ts so renovate-config-validator can load it
// (Renovate doesn't recognize .ts files, but Node 24 strips types when the .ts is imported).
export { default } from './serverConfig.ts';

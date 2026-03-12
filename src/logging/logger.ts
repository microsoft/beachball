export type LogLevel = 'log' | 'warn' | 'error';
export type LogTransport = (level: LogLevel, args: unknown[]) => void;

const consoleTransport: LogTransport = (level, args) => {
  const method = level === 'log' ? 'log' : level;
  console[method](...args);
};

let transports: LogTransport[] = [consoleTransport];

export const logger = {
  log(...args: unknown[]): void {
    for (const transport of transports) transport('log', args);
  },
  warn(...args: unknown[]): void {
    for (const transport of transports) transport('warn', args);
  },
  error(...args: unknown[]): void {
    for (const transport of transports) transport('error', args);
  },
};

/** Replace active transports with the given list. */
export function setTransports(newTransports: LogTransport[]): void {
  transports = newTransports;
}

/** Restore the default console transport. */
export function restoreTransports(): void {
  transports = [consoleTransport];
}

import type { LoggerService, LogLevel } from '@nestjs/common';
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context?: string;
  message: string;
  trace?: string;
}
interface JsonLoggerOptions {
  pretty?: boolean;
}
const RESET = '\x1b[0m';
const DIM = '\x1b[90m';
const YELLOW = '\x1b[33m';
const LEVEL_COLOR: Record<LogLevel, string> = {
  log: '\x1b[32m',
  error: '\x1b[31m',
  warn: '\x1b[33m',
  debug: '\x1b[35m',
  verbose: '\x1b[36m',
  fatal: '\x1b[31m',
};
export class JsonLogger implements LoggerService {
  private readonly pretty: boolean;
  constructor(options?: JsonLoggerOptions) {
    this.pretty = options?.pretty ?? Boolean(process.stdout.isTTY);
  }
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('log', message, optionalParams);
  }
  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }
  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }
  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }
  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }
  private write(
    level: LogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const context =
      typeof optionalParams.at(-1) === 'string'
        ? (optionalParams.at(-1) as string)
        : undefined;
    const trace =
      level === 'error' &&
      optionalParams.length > 1 &&
      optionalParams[0] !== undefined
        ? String(optionalParams[0])
        : undefined;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      ...(context ? { context } : {}),
      message: this.stringifyMessage(message),
      ...(trace ? { trace } : {}),
    };
    const stream = level === 'error' ? process.stderr : process.stdout;
    stream.write(
      this.pretty ? this.formatPretty(entry) : `${JSON.stringify(entry)}\n`,
    );
  }
  private formatPretty(entry: LogEntry): string {
    const levelColor = LEVEL_COLOR[entry.level];
    const levelLabel = levelColor + entry.level.toUpperCase().padEnd(7) + RESET;
    const timestamp = DIM + entry.timestamp + RESET;
    const context = entry.context ? ` ${YELLOW}[${entry.context}]${RESET}` : '';
    const trace = entry.trace ? `\n${levelColor}${entry.trace}${RESET}` : '';
    return `${timestamp} ${levelLabel}${context} ${entry.message}${trace}\n`;
  }
  private stringifyMessage(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }
    if (message instanceof Error) {
      return message.stack ?? message.message;
    }
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }
}

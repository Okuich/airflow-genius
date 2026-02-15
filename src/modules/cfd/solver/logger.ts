export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  context: Record<string, unknown>;
}

export class StructuredLogger {
  private readonly service: string;

  constructor(service: string) {
    this.service = service;
  }

  debug(message: string, context: Record<string, unknown> = {}): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context: Record<string, unknown> = {}): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context: Record<string, unknown> = {}): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context: Record<string, unknown> = {}): void {
    this.log(LogLevel.ERROR, message, context);
  }

  private log(level: LogLevel, message: string, context: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      context,
    };

    const output = JSON.stringify(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.DEBUG:
        console.debug(output);
        break;
      default:
        console.log(output);
    }
  }
}

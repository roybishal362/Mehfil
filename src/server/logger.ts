/**
 * Structured JSON logging. One line per event, so Vercel and Cloud Logging can index fields.
 * Never log request bodies, prompts, model output or personal data: only IDs, timings and counts.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Readonly<Record<LogLevel, number>> = { debug: 10, info: 20, warn: 30, error: 40 };

export type LogFields = Readonly<Record<string, string | number | boolean | null | undefined>>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

export type LogSink = (line: string, level: LogLevel) => void;

const defaultSink: LogSink = (line, level) => {
  (level === 'error' || level === 'warn' ? process.stderr : process.stdout).write(`${line}\n`);
};

export function createLogger(minLevel: LogLevel, sink: LogSink = defaultSink): Logger {
  const log = (level: LogLevel, message: string, fields: LogFields = {}) => {
    if (ORDER[level] < ORDER[minLevel]) return;
    const entry: Record<string, unknown> = {
      severity: level.toUpperCase(),
      time: new Date().toISOString(),
      message,
    };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) entry[key] = value;
    }
    sink(JSON.stringify(entry), level);
  };
  return {
    debug: (message, fields) => {
      log('debug', message, fields);
    },
    info: (message, fields) => {
      log('info', message, fields);
    },
    warn: (message, fields) => {
      log('warn', message, fields);
    },
    error: (message, fields) => {
      log('error', message, fields);
    },
  };
}

/** A logger that discards everything (tests). */
export const silentLogger: Logger = createLogger('error', () => undefined);

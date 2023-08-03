/**
 * @public
 */
export type QpMongoDbLogLevel = 'info' | 'debug' | 'verbose';

/**
 * @public
 */
export class QpMongoDbLogConfig {
  public static LogLevel: QpMongoDbLogLevel =
    (process.env.NODE_ENV ?? 'production') !== 'production' ? 'debug' : 'info';
}

/**
 * @public
 */
export interface IQpMongoDbLogger {
  scope(name: string): IQpMongoDbLogger;

  info(...anything: unknown[]): void;

  warn(...anything: unknown[]): void;

  verbose(...anything: unknown[]): void;

  debug(...anything: unknown[]): void;

  error(...anything: unknown[]): void;
}

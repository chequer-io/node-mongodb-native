import { IQpMongoDbLogger, QpMongoDbLogConfig } from './logger';

/**
 * @public
 */
export class QpMongoDbLoggerDefault implements IQpMongoDbLogger {
  public static create(name: string): QpMongoDbLoggerDefault {
    return new QpMongoDbLoggerDefault([name]);
  }

  private readonly _parts: string[];
  private readonly _name: string;

  public constructor(parts: string[]) {
    this._parts = parts;
    this._name = `<${parts.join('/')}>`;
  }

  public scope(name: string): IQpMongoDbLogger {
    return new QpMongoDbLoggerDefault([...this._parts, name]);
  }

  public info(...anything: unknown[]): void {
    // eslint-disable-next-line no-console
    console.info('[INF]', this._name, ...anything);
  }

  public warn(...anything: unknown[]): void {
    // eslint-disable-next-line no-console
    console.warn('[WRN]', this._name, ...anything);
  }

  public debug(...anything: unknown[]): void {
    switch (QpMongoDbLogConfig.LogLevel) {
      case 'info':
        return;
    }

    // eslint-disable-next-line no-console
    console.debug('[DBG]', this._name, ...anything);
  }

  public verbose(...anything: unknown[]): void {
    switch (QpMongoDbLogConfig.LogLevel) {
      case 'info':
      case 'debug':
        return;
    }

    // eslint-disable-next-line no-console
    console.log('[VRB]', this._name, ...anything);
  }

  public error(...anything: unknown[]): void {
    // eslint-disable-next-line no-console
    console.error('[ERR]', this._name, ...anything);
  }
}

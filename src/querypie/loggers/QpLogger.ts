/**
 * Internal
 */
import { QpLogLevel } from './QpLogLevel';

export class QpLogger {
  public static readonly Global = new QpLogger();

  private _logLevel: QpLogLevel;

  constructor() {
    const logLevel = (process.env.QP_LOGGER_LOG_LEVEL ?? '').toLowerCase();

    switch (logLevel) {
      case 'error':
        this._logLevel = QpLogLevel.Error;
        break;

      case 'warn':
        this._logLevel = QpLogLevel.Warn;
        break;

      case 'info':
        this._logLevel = QpLogLevel.Info;
        break;

      case 'debug':
        this._logLevel = QpLogLevel.Debug;
        break;

      default:
        if (process.env.NODE_ENV !== 'development') {
          this._logLevel = QpLogLevel.Info;
        } else {
          this._logLevel = QpLogLevel.Debug;
        }
        break;
    }
  }

  Info(...args: any[]) {
    this.Log('Info', ...args);
  }

  Warn(...args: any[]) {
    this.Log('Warn', ...args);
  }

  Debug(...args: any[]) {
    this.Log('Debug', ...args);
  }

  Error(...args: any[]) {
    this.Log('Error', ...args);
  }

  private Log(type: string, ...args: any[]) {
    // eslint-disable-next-line no-console
    console.log(type, ...args);
  }
}

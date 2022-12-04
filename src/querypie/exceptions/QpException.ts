import type { QpExceptionLevel } from './QpExceptionLevel';

/**
 * @public
 */
export class QpException extends Error {
  private _level: QpExceptionLevel;

  constructor(level: QpExceptionLevel, message: string) {
    super(`[QueryPie MongoShell] ${message}`);

    this._level = level;
  }
}

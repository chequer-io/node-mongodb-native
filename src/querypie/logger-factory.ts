import type { IQpMongoDbLogger } from './logger';
import { QpMongoDbLoggerDefault } from './logger-default';

/**
 * @public
 */
export class QpMongoDbLoggerFactory {
  private static _factory: ((name: string) => IQpMongoDbLogger) | undefined;

  public static setFactory(factory: (name: string) => IQpMongoDbLogger): void {
    this._factory = factory;
  }

  /**
   * @internal
   */
  public static create(name: string): IQpMongoDbLogger {
    if (!this._factory) return QpMongoDbLoggerDefault.create(name);

    return this._factory(name);
  }
}

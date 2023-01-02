import type { Document } from 'bson';

import type { WriteProtocolMessageType } from '../../../cmap/commands';
import type { CommandOptions } from '../../../cmap/connection';
import type { IQpWriteProtocolMessageTypeContext } from './IQpWriteProtocolMessageTypeContext';

export class QpWriteProtocolMessageTypePassContext implements IQpWriteProtocolMessageTypeContext {
  private readonly _protocol: WriteProtocolMessageType;
  private readonly _options: CommandOptions;

  private _result: Document | undefined = undefined;
  private _exception: any | undefined = undefined;

  constructor(protocol: WriteProtocolMessageType, options: CommandOptions) {
    this._protocol = protocol;
    this._options = options;
  }

  GetProtocol(): WriteProtocolMessageType {
    return this._protocol;
  }

  GetOptions(): CommandOptions {
    return this._options;
  }

  GetResult(): Document | undefined {
    return this._result;
  }

  RaisePre(): Promise<void> {
    return Promise.resolve();
  }

  RaisePost(originalResult: Document | undefined): Promise<void> {
    this._result = originalResult;
    return Promise.resolve();
  }

  RaiseException(exception: any): Promise<void> {
    this._exception = exception;

    return Promise.resolve();
  }

  RaiseComplete(): Promise<void> {
    return Promise.resolve();
  }
}

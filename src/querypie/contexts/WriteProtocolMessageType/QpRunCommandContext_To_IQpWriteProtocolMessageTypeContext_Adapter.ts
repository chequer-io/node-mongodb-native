import type { Document } from 'bson';

import type { Msg } from '../../../cmap/commands';
import type { CommandOptions } from '../../../cmap/connection';
import type { IQpRunCommandContext } from '../Command/IQpRunCommandContext';
import type { IQpWriteProtocolMessageTypeContext } from './IQpWriteProtocolMessageTypeContext';

/**
 * @internal
 */
export class QpRunCommandContext_To_IQpWriteProtocolMessageTypeContext_Adapter
  implements IQpWriteProtocolMessageTypeContext
{
  private readonly _context: IQpRunCommandContext;
  private readonly _protocol: Msg;
  private readonly _options: CommandOptions;

  constructor(context: IQpRunCommandContext, protocol: Msg, options: CommandOptions) {
    this._context = context;
    this._protocol = protocol;
    this._options = options;
  }

  GetProtocol(): Msg {
    this._protocol.command = this._context.GetCommand();

    return this._protocol;
  }

  GetOptions(): CommandOptions {
    return this._options;
  }

  GetResult(): Document | undefined {
    return this._context.GetResult();
  }

  RaisePre(): Promise<void> {
    return this._context.RaisePre();
  }

  RaisePost(originalResult: Document | undefined): Promise<void> {
    return this._context.RaisePost(originalResult);
  }

  RaiseException(exception: any): Promise<void> {
    return this._context.RaiseException(exception);
  }

  RaiseComplete(): Promise<void> {
    return this._context.RaiseComplete();
  }
}

import type { Document } from 'bson';

import type { WriteProtocolMessageType } from '../../../cmap/commands';
import type { CommandOptions } from '../../../cmap/connection';

export interface IQpWriteProtocolMessageTypeContext {
  GetProtocol(): WriteProtocolMessageType;
  GetOptions(): CommandOptions;

  GetResult(): Document | undefined;

  RaisePre(): Promise<void>;
  RaisePost(originalResult: Document | undefined): Promise<void>;
  RaiseException(exception: any): Promise<void>;
  RaiseComplete(): Promise<void>;
}

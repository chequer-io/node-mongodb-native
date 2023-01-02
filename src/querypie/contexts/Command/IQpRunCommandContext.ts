import type { Document } from 'bson';

/**
 * @public
 */
export interface IQpRunCommandContext {
  GetCommand(): Document;

  GetResult(): Document | undefined;

  RaisePre(): Promise<void>;
  RaisePost(originalResult: Document | undefined): Promise<void>;
  RaiseException(exception: any): Promise<void>;
  RaiseComplete(): Promise<void>;
}

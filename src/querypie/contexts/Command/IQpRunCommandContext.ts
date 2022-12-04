import type { Document } from 'bson';

export interface IQpRunCommandContext {
  get Command(): Document;

  get Result(): Document | undefined;

  RaisePre(): Promise<void>;
  RaisePost(originalResult: Document | undefined): Promise<void>;
  RaiseException(exception: any): Promise<void>;
  RaiseComplete(): Promise<void>;
}

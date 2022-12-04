import type { Document } from 'bson';

export interface IQpCommandFilter {
  IsSkipCommand(command: Document): boolean;
  IsRejectCommand(command: Document): boolean;

  ThrowIfRejectCommand(command: Document): void;
}

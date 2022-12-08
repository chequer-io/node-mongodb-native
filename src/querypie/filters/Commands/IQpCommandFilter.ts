import type { Document } from 'bson';

import type { CommandOptions } from '../../../cmap/connection';

export interface IQpCommandFilter {
  IsSkip(command: Document, commandOptions: CommandOptions): boolean;
  IsReject(command: Document, commandOptions: CommandOptions): boolean;

  ThrowIfReject(command: Document, commandOptions: CommandOptions): void;
}

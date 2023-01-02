import type { Document } from 'bson';

import type { CommandOptions } from '../../../cmap/connection';
import { QpSymbols, SkippableOptions } from '../../symbols/QpSymbols';
import type { IQpCommandFilter } from './IQpCommandFilter';

export class QpSkipSymbolCommandFilter implements IQpCommandFilter {
  IsSkip(command: Document, commandOptions: SkippableOptions<CommandOptions>): boolean {
    if (commandOptions[QpSymbols.QpSkipRunCommandPhase]) {
      return true;
    }

    return false;
  }

  IsReject(): boolean {
    return false;
  }

  ThrowIfReject(): void {
    return;
  }
}

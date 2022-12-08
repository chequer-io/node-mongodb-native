import type { Document } from 'bson';

import type { CommandOptions } from '../../cmap/connection';
import type { IQpRunCommandContext } from '../contexts/Command/IQpRunCommandContext';
import { QpRunCommandContext } from '../contexts/Command/QpRunCommandContext';
import type { IQpCommandFilter } from '../filters/Commands/IQpCommandFilter';
import { QpCommandFilter } from '../filters/Commands/QpCommandFilter';
import { QpSkipSymbolCommandFilter } from '../filters/Commands/QpSkipSymbolCommandFilter';

/**
 * Internal
 */
export class QpRunCommandContextFactory {
  private static readonly _filters: IQpCommandFilter[] = [
    new QpSkipSymbolCommandFilter(),
    new QpCommandFilter()
  ];

  public static Create(
    command: Document,
    commandOptions: CommandOptions
  ): IQpRunCommandContext | null {
    for (const filter of this._filters) {
      if (filter.IsSkip(command, commandOptions)) {
        return null;
      }

      filter.ThrowIfReject(command, commandOptions);
    }

    return new QpRunCommandContext(command);
  }
}

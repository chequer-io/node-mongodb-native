import type { Document } from 'bson';

import type { IQpRunCommandContext } from '../contexts/Command/IQpRunCommandContext';
import { QpRunCommandContext } from '../contexts/Command/QpRunCommandContext';
import type { IQpCommandFilter } from '../filters/Commands/IQpCommandFilter';
import { QpCommandFilter } from '../filters/Commands/QpCommandFilter';

/**
 * Internal
 */
export class QpRunCommandContextFactory {
  private static _filter: IQpCommandFilter = new QpCommandFilter();

  public static Create(command: Document): IQpRunCommandContext | null {
    if (this._filter.IsSkipCommand(command)) {
      return null;
    }

    this._filter.ThrowIfRejectCommand(command);

    return new QpRunCommandContext(command);
  }
}

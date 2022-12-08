import { UUID } from 'bson';

import type { CommandOptions } from '../../cmap/connection';

/**
 * @public
 */
export const QpSkipRunCommandPhaseSymbol =
  `__QP_SKIP_RUN_COMMAND_PHASE_SYMBOL__${new UUID().toString()}` as const;

/**
 * @public
 */
export type SkippableOptions<T> = T & {
  [key: `__QP_SKIP_RUN_COMMAND_PHASE_SYMBOL__${string}`]: boolean;
};

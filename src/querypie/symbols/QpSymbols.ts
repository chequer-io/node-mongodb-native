import { UUID } from 'bson';

/**
 * @public
 */
export class QpSymbols {
  /**
   * @public
   */
  public static QpSkipRunCommandPhase =
    `__QP_SKIP_RUN_COMMAND_PHASE_SYMBOL__${new UUID().toString()}` as const;
}

/**
 * @public
 */
export type SkippableOptions<T> = T & {
  [key: `__QP_SKIP_RUN_COMMAND_PHASE_SYMBOL__${string}`]: boolean;
};

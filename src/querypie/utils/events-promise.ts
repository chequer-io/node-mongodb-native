import type { CancellationToken, TypedEventEmitter } from '../../mongo_types';

/**
 * @Internal
 */
export const waitEvent = <
  TTarget extends TypedEventEmitter<any>,
  TEventName extends TTarget extends TypedEventEmitter<infer TEvents> ? keyof TEvents : never
>(
  target: TTarget,
  event: TEventName,
  cancellationToken: CancellationToken
): Promise<
  TTarget extends TypedEventEmitter<infer TEvents> ? Parameters<TEvents[TEventName]>[0] : never
> => {
  return new Promise((resolve, reject) => {
    target.once(event, resolve);
    cancellationToken.once('cancel', reject);
  });
};

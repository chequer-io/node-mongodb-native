import { CancellationToken, TypedEventEmitter } from '../mongo_types';
import type { QpRunCommandContext } from './contexts/Command/QpRunCommandContext';
import { waitEvent } from './utils/events-promise';

type QpRunCommandManagerInternalEvents = {
  'context:pushed': () => void;
};

/**
 * Internal
 */
class QpRunCommandManagerInternal {
  private _queue: QpRunCommandContext[] = [];
  private _events = new TypedEventEmitter<QpRunCommandManagerInternalEvents>();

  private _currentContext: QpRunCommandContext | null = null;

  private _isActivated = false;

  /**
   * @internal
   */
  public get IsActivated() {
    return this._isActivated;
  }

  /***
   * @public
   */
  public Activate() {
    this._isActivated = true;
  }

  /***
   * @public
   */
  public Deactivate() {
    this._isActivated = false;

    this.Abort('QpRunCommandManager Deactivated');
  }

  /***
   * @public
   */
  public async WaitRunContext(cancellationToken: CancellationToken): Promise<QpRunCommandContext> {
    return await this._Pop(cancellationToken);
  }

  public Abort(message: string) {
    this._currentContext?.Abort(message);

    while (this._queue.length !== 0) {
      const context = this._queue.shift();
      if (!context) return;

      context.Abort(message);
    }
  }

  /***
   * @internal
   */
  public Push(context: QpRunCommandContext): void {
    this._Push(context);
  }

  private _Push(context: QpRunCommandContext): void {
    this._queue.push(context);
    this._events.emit('context:pushed');
  }

  private async _Pop(cancellationToken: CancellationToken): Promise<QpRunCommandContext> {
    const context = this._queue.shift();
    if (context) {
      return context;
    }

    await waitEvent(this._events, 'context:pushed', cancellationToken);
    return this._Pop(cancellationToken);
  }
}

/**
 * @public
 */
export const QpRunCommandManager = new QpRunCommandManagerInternal();

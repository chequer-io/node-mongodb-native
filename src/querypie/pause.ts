import { Document, UUID } from 'bson';
import { CancellationToken, TypedEventEmitter } from '../mongo_types';
import type { QpSessionPause as QpSessionPause } from './session-pause';

/** @public */
export type QpPauseEvents = {
  'mongodb:pause': () => void;
  'mongodb:resume': () => void;
};

const log = (...args: any[]) => {
  console.log('<QpPause>', ...args);
};

/** @public */
export type QpPausePhase = 'pre' | 'post';

/** @public */
export type QpPauseContext = {
  id: string;
  sessionId: string;
  command: Document;
  phase: QpPausePhase;

  /** @internal */
  _session: QpSessionPause;
};

/** @public */
export class QpPause extends TypedEventEmitter<QpPauseEvents> {
  public static kNoPause = `__QUERYPIE__.__QP_PAUSE__.__NO_PAUSE__.${new UUID().toHexString()}`;

  private readonly _queue: QpPauseContext[] = [];
  private _current: QpPauseContext | null = null;

  /** @internal */
  public _isCommandCapturing: boolean = false;
  public get isCommandCapturing(): boolean {
    return this._isCommandCapturing;
  }

  public start() {
    log('Command Capture Start');
    this._isCommandCapturing = true;
  }

  public stop() {
    log('Command Capture Stop');
    this._isCommandCapturing = false;

    if (this._current !== null) {
      log('WARNING', 'STOP called with current pause context', this._current);

      this._current._session.emit('mongodb:command:resume');
    }

    while (true) {
      const context = this._queue.shift();
      if (context === undefined) break;

      log('WARNING', 'STOP called with pending pause context', context);

      context._session.emit('mongodb:command:resume');
    }
  }

  public abort() {
    log('Command Capture Abort');
    this._isCommandCapturing = false;

    if (this._current !== null) {
      this._current._session.emit('mongodb:command:abort');
    }

    while (true) {
      const context = this._queue.shift();
      if (context === undefined) break;

      context._session.emit('mongodb:command:abort');
    }
  }

  public resume(): void {
    if (this._current === null) {
      throw new Error('Not paused currently');
    }

    this._current._session.emit('mongodb:command:resume');
    this._current = null;

    this.tryRaisePause();
  }

  public async wait(token: CancellationToken): Promise<QpPauseContext> {
    while (true) {
      const context = this._queue.shift();

      if (context !== undefined) {
        this._current = context;
        return context;
      }

      await this.waitEvent('mongodb:pause', token);
    }
  }

  /** @internal */
  public waitEvent<K extends keyof QpPauseEvents>(
    event: K,
    token: CancellationToken
  ): Promise<void> {
    return new Promise((_resolve, _reject) => {
      let isReturned = false;

      const resolve = () => {
        if (isReturned) return;
        isReturned = true;

        _resolve();
      };

      const reject = (err?: any) => {
        if (isReturned) return;
        isReturned = true;

        _reject(err);
      };

      const onCancel = () => {
        token.off('cancel', onCancel);
        this.off(event, onEvent);

        reject(new Error('Operation Cancelled'));
      };

      const onEvent = () => {
        token.off('cancel', onCancel);
        this.off(event, onEvent);

        resolve();
      };

      token.once('cancel', onCancel);
      this.once(event, onEvent);
    });
  }

  /** @internal */
  public pause(session: QpSessionPause, id: string, phase: QpPausePhase, command: Document): void {
    this._queue.push({
      id,
      sessionId: session.id,

      _session: session,
      phase,
      command
    });

    this.tryRaisePause();
  }

  private tryRaisePause(): void {
    this.emit('mongodb:pause');
  }

  // #region Singleton
  private static _instance: QpPause | undefined = undefined;

  public static get instance(): QpPause {
    if (this._instance === undefined) {
      this._instance = new QpPause();
    }

    return this._instance;
  }
  // #endregion
}

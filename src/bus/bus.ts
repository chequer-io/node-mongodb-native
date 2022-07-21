import type { Document } from 'bson';
import EventEmitter = require('events');
import type { CancellationToken } from '../mongo_types';
import type { MongoDbSessionEventBus } from './session-bus';

/** @public */
export type MongoDbCommandType = 'query' | 'msg';

/** @internal */
export type MongoDbEventBusMap = {
  'mongodb:pause': () => void;
  'mongodb:resume': () => void;
};

const log = (...args: any[]) => {
  console.log('<MongoDbEventBus>', ...args);
};

/** @public */
export type PauseContext = {
  /** @internal */
  bus: MongoDbSessionEventBus;

  command: Document;
  commandType: MongoDbCommandType;

  phase: 'pre' | 'post';
};

/** @public */
export class MongoDbEventBus {
  private static _instance: MongoDbEventBus | undefined = undefined;
  public static kNoPause = Symbol();

  public static get instance(): MongoDbEventBus {
    if (this._instance === undefined) {
      this._instance = new MongoDbEventBus();
    }

    return this._instance;
  }

  private readonly _pauseQueue: PauseContext[] = [];
  private _current: PauseContext | undefined = undefined;

  public async wait(token: CancellationToken): Promise<PauseContext> {
    while (true) {
      const context = this._pauseQueue.shift();
      if (context !== undefined) {
        this._current = context;
        return context;
      }

      await this.waitEvent('mongodb:pause', token);
    }
  }

  /** @internal */
  public pause(
    bus: MongoDbSessionEventBus,
    phase: 'pre' | 'post',
    command: Document,
    commandType: MongoDbCommandType
  ): void {
    this._pauseQueue.push({
      phase,
      bus,
      command,
      commandType
    });

    this.emit('mongodb:pause');
  }

  public resume(): void {
    if (this._current === undefined) {
      throw new Error('Not paused currently');
    }

    const old = this._current;
    this._current = undefined;

    old.bus.emit('mongodb:command:resume');
    this._current = undefined;
  }

  /** @internal */
  public isCommandCapturing: boolean = false;

  public start() {
    log('Command Capture Start');
    this.isCommandCapturing = true;
  }

  public stop() {
    log('Command Capture Stop');
    this.isCommandCapturing = false;

    if (this._current !== undefined) {
      log('WARNING', 'STOP called with pause context', this._current);

      this._current.bus.emit('mongodb:command:resume');
    }

    while (true) {
      const context = this._pauseQueue.shift();
      if (context === undefined) break;

      log('WARNING', 'STOP called with pause context', context);

      context.bus.emit('mongodb:command:resume');
    }
  }

  public abort() {
    log('Command Capture Abort');
    this.isCommandCapturing = false;

    if (this._current !== undefined) {
      this._current.bus.emit('mongodb:command:abort');
    }

    while (true) {
      const context = this._pauseQueue.shift();
      if (context === undefined) break;

      context.bus.emit('mongodb:command:abort');
    }
  }

  private _eventBus = new EventEmitter();

  /** @internal */
  public on<K extends keyof MongoDbEventBusMap>(event: K, listener: MongoDbEventBusMap[K]): this {
    this._eventBus.on(event, listener);

    return this;
  }

  /** @internal */
  public once<K extends keyof MongoDbEventBusMap>(event: K, listener: MongoDbEventBusMap[K]): this {
    this._eventBus.once(event, listener);

    return this;
  }

  /** @internal */
  public emit<K extends keyof MongoDbEventBusMap>(
    event: K,
    ...args: Parameters<MongoDbEventBusMap[K]>
  ): this {
    this._eventBus.emit(event, ...args);

    return this;
  }

  /** @internal */
  public off<K extends keyof MongoDbEventBusMap>(event: K, listener: MongoDbEventBusMap[K]): this {
    this._eventBus.off(event, listener);

    return this;
  }

  /** @internal */
  public waitEvent<K extends keyof MongoDbEventBusMap>(
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
}

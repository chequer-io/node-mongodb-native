import type { Document } from 'bson';
import EventEmitter = require('events');
import type { Query, WriteProtocolMessageType } from '../cmap/commands';
import type { CommandOperationOptions } from '../operations/command';
import type { ClientSession, ServerSessionId } from '../sessions';
import { MongoDbEventBus } from './bus';

/** @public */
export type MongoDbSessionEventBusMap = {
  'mongodb:command:resume': () => void;
  'mongodb:command:abort': () => void;
};

const log = (...args: any[]) => {
  console.log('<MongoDbSessionEventBus>', ...args);
};

// const ignorables = ['ping', 'buildInfo', 'listDatabases'];
const ignorables: string[] = [];
const isCommandIgnorable = (command: Document) => {
  for (const ignorable of ignorables) {
    if (command[ignorable] === 1) return true;
  }

  return false;
};

const emptyIgnorables: string[] = [
  'saslStart',
  'authenticate',
  'saslContinue',
  'getnonce',
  'createUser',
  'updateUser',
  'copydbgetnonce',
  'copydbsaslstart',
  'copydb',
  'ismaster'
];
const isCommandIgnorableInEmptyBus = (command: Document): boolean => {
  for (const ignorable of emptyIgnorables) {
    if (command[ignorable] === 1) {
      return true;
    }
  }

  return false;
};

const isQueryIgnorable = (command: Query): boolean => {
  if (command.query.ismaster === true) {
    return true;
  }

  return false;
};

/** @public */
export class MongoDbSessionEventBus {
  private static readonly _sessionInstances: {
    [sessionId: string]: MongoDbSessionEventBus | undefined;
  } = {};

  /** @internal */
  public static get emptyBus(): MongoDbEmptySessionBus {
    return MongoDbEmptySessionBus.instance;
  }

  /** @internal */
  public static getOrCreate(
    sessionId: string | ClientSession | ServerSessionId | undefined
  ): MongoDbSessionEventBus {
    if (sessionId === undefined) {
      // log('SessionId not provided');
      return this.emptyBus;
    }

    if (typeof sessionId === 'string') {
      const instance = MongoDbSessionEventBus._sessionInstances[sessionId];
      if (instance !== undefined) {
        return instance;
      }

      const newInstance = new MongoDbSessionEventBus(sessionId);
      MongoDbSessionEventBus._sessionInstances[sessionId] = newInstance;

      return newInstance;
    }

    if ('topology' in sessionId) {
      return this.getOrCreate(sessionId.id);
    }

    return this.getOrCreate(sessionId.id.toUUID().toHexString());
  }

  private _eventBus = new EventEmitter();
  private sessionId: string;

  protected constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /** @internal */
  public waitD(
    event: 'pre' | 'post',
    command: Document,
    commandOptions: CommandOperationOptions,
    callback: (err?: any) => void
  ) {
    if ((commandOptions as any)[MongoDbEventBus.kNoPause]) {
      callback();
      return;
    }

    if (!MongoDbEventBus.instance.isCommandCapturing) {
      callback();
      return;
    }

    if (isCommandIgnorable(command)) {
      callback();
      return;
    }

    // Case Msg
    MongoDbEventBus.instance.pause(this, event, command, 'msg');

    this.log('Pause', command, event);
    this.waitInternal(callback);
  }

  /** @internal */
  public wait(
    event: 'pre' | 'post',
    command: WriteProtocolMessageType,
    commandOptions: CommandOperationOptions,
    callback: (err?: any) => void
  ) {
    if ((commandOptions as any)[MongoDbEventBus.kNoPause]) {
      callback();
      return;
    }

    if (!MongoDbEventBus.instance.isCommandCapturing) {
      callback();
      return;
    }

    // Case GetMore
    if ('cursorId' in command) {
      this.log('<WARNING>', 'GetMore CALLED');
      callback();
      return;
    }

    // Case KillCursor
    if ('cursorIds' in command) {
      this.log('<WARNING>', 'KillCursor CALLED');
      callback();
      return;
    }

    // Case Query
    if ('query' in command) {
      this.log('<WARNING>', 'Query CALLED');
      callback();
      return;
      // MongoDbEventBus.instance.pause(this, event, command.query, 'query');

      // this.log('Pause', command.query, event);
      // this.waitInternal(callback);
      // return;
    }

    if (isCommandIgnorable(command)) {
      this.log('PASSED', 'Command is ignorable');
      callback();
      return;
    }

    // Case Msg
    if ('command' in command) {
      MongoDbEventBus.instance.pause(this, event, command.command, 'msg');

      this.log('Pause', command.command, event);
      this.waitInternal(callback);
      return;
    }

    throw new Error('Invalid command');
  }

  private waitInternal(_callback: (err?: any) => void) {
    let isCallbackCalled = false;

    const callback = (err?: any): boolean => {
      if (isCallbackCalled) return false;
      isCallbackCalled = true;

      this.off('mongodb:command:resume', onResume);
      this.off('mongodb:command:abort', onAbort);

      _callback(err);

      return true;
    };

    const onResume = () => {
      if (callback()) {
        this.log('Resume');
      }
    };

    const onAbort = () => {
      if (callback(new Error('[QPE] Command aborted'))) {
        this.log('Command abort');
      }
    };

    this.once('mongodb:command:resume', onResume);
    this.once('mongodb:command:abort', onAbort);

    // this.once('mongodb:command:capture:stop', () => {
    //   if (callback(new Error('Command already stopped'))) {
    //     this.log('Command Already Stop');
    //   }
    // });
  }

  private log(...args: any[]) {
    log(`#${this.sessionId}`, ...args);
  }

  public on<K extends keyof MongoDbSessionEventBusMap>(
    event: K,
    listener: MongoDbSessionEventBusMap[K]
  ): this {
    this._eventBus.on(event, listener);

    return this;
  }

  public off<K extends keyof MongoDbSessionEventBusMap>(
    event: K,
    listener: MongoDbSessionEventBusMap[K]
  ): this {
    this._eventBus.off(event, listener);

    return this;
  }

  public once<K extends keyof MongoDbSessionEventBusMap>(
    event: K,
    listener: MongoDbSessionEventBusMap[K]
  ): this {
    this._eventBus.once(event, listener);

    return this;
  }

  public emit<K extends keyof MongoDbSessionEventBusMap>(
    event: K,
    ...args: Parameters<MongoDbSessionEventBusMap[K]>
  ): this {
    this._eventBus.emit(event, ...args);

    return this;
  }
}

/** @internal */
export class MongoDbEmptySessionBus extends MongoDbSessionEventBus {
  private static _instance: MongoDbEmptySessionBus | undefined;
  public static get instance(): MongoDbEmptySessionBus {
    if (this._instance === undefined) {
      this._instance = new MongoDbEmptySessionBus();
    }

    return this._instance;
  }

  private constructor() {
    super('<EMPTY>');
  }

  /** @internal */
  public wait(
    event: 'pre' | 'post',
    command: WriteProtocolMessageType,
    commandOptions: CommandOperationOptions,
    callback: (err?: any) => void
  ) {
    if ((commandOptions as any)[MongoDbEventBus.kNoPause]) {
      callback();
      return;
    }

    if (!MongoDbEventBus.instance.isCommandCapturing) {
      callback();
      return;
    }

    // Case GetMore
    if ('cursorId' in command) {
      log('<QueryPie Warning>', 'GetMore CALLED', 'in EmptyBus', command.ns, command.cursorId);
      callback();
      return;
    }

    // Case KillCursor
    if ('cursorIds' in command) {
      log('<QueryPie Warning>', 'KillCursor CALLED', 'in EmptyBus', command.ns, command.cursorIds);
      callback();
      return;
    }

    if ('query' in command) {
      if (isQueryIgnorable(command)) {
        callback();
        return;
      }

      log('<QueryPie Warning>', 'Query CALLED', 'in EmptyBus', command.ns, command.query);
      callback();
      return;
    }

    if (isCommandIgnorableInEmptyBus(command.command)) {
      callback();
      return;
    }

    log('<QueryPie Warning>', 'Unknown command detected', 'in EmptyBus', command);

    // throw new Error('Invalid command');
  }

  /** @internal */
  public waitD(
    event: 'pre' | 'post',
    command: Document,
    commandOptions: CommandOperationOptions,
    callback: (err?: any) => void
  ) {
    if ((commandOptions as any)[MongoDbEventBus.kNoPause]) {
      callback();
      return;
    }

    if (!MongoDbEventBus.instance.isCommandCapturing) {
      callback();
      return;
    }

    if (isCommandIgnorableInEmptyBus(command.command)) {
      callback();
      return;
    }

    log('<QueryPie Warning>', 'Unknown command detected', 'in EmptyBus', command);
  }
}

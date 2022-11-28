import type { Document } from 'bson';

import type { WriteProtocolMessageType } from '../cmap/commands';
import { TypedEventEmitter } from '../mongo_types';
import type { ClientSession, ServerSessionId } from '../sessions';
import { QpPause, QpPausePhase } from './pause';

/** @internal */
export type QpSessionPauseEvents = {
  'mongodb:command:resume': (updatedResult: Document | undefined) => void;
  'mongodb:command:abort': () => void;
};

const log = (...args: any[]) => {
  // eslint-disable-next-line no-console
  console.log('<QpSessionPause>', ...args);
};

// const ignorables = ['ping', 'buildInfo', 'listDatabases'];
const ignorables: string[] = [];
const isCommandIgnorable = (command: Document) => {
  for (const ignorable of ignorables) {
    if (command[ignorable] === 1) return true;
  }

  return false;
};

/** @internal */
export class QpSessionPause extends TypedEventEmitter<QpSessionPauseEvents> {
  public readonly id: string;

  public constructor(id: string) {
    super();

    this.id = id;
  }

  /** @internal */
  public waitOnProtocol(
    id: string,
    phase: QpPausePhase,
    command: WriteProtocolMessageType,
    commandOptions: { [key: string]: any },
    result: Document | undefined,
    callback: (err: any | undefined, result: Document | undefined) => void
  ) {
    if (commandOptions[QpPause.kNoPause]) {
      callback(undefined, result);
      return;
    }

    if (!QpPause.instance.isCommandCapturing) {
      callback(undefined, result);
      return;
    }

    // Case GetMore
    if ('cursorId' in command) {
      this.log('<WARNING>', 'GetMore CALLED');
      callback(undefined, result);
      return;
    }

    // Case KillCursor
    if ('cursorIds' in command) {
      this.log('<WARNING>', 'KillCursor CALLED');
      callback(undefined, result);
      return;
    }

    // Case Query
    if ('query' in command) {
      this.log('<WARNING>', 'Query CALLED');
      callback(undefined, result);
      return;
    }

    // Case Msg
    if ('command' in command) {
      if (isCommandIgnorable(command)) {
        this.log('PASSED', 'Command is ignorable');
        callback(undefined, result);
        return;
      }

      QpPause.instance.pause(this, id, phase, command.command, result);

      this.log('Pause', command.command, phase);
      this.waitInternal(result, callback);
      return;
    }

    throw new Error('Invalid protocol');
  }

  /** @internal */
  public waitOnCommand(
    id: string,
    phase: QpPausePhase,
    command: Document,
    commandOptions: { [key: string]: any },
    result: Document | undefined,
    callback: (err?: any) => void
  ) {
    if (commandOptions[QpPause.kNoPause]) {
      callback();
      return;
    }

    if (!QpPause.instance.isCommandCapturing) {
      callback();
      return;
    }

    if (isCommandIgnorable(command)) {
      callback();
      return;
    }

    QpPause.instance.pause(this, id, phase, command, result);
    this.log('Pause', command, phase);

    this.waitInternal(result, callback);
  }

  private waitInternal(
    originalResult: Document | undefined,
    _callback: (err: any | undefined, updatedResult: Document | undefined) => void
  ) {
    let isCallbackCalled = false;

    const callback = (log: string, err?: any, updatedResult?: Document | undefined): void => {
      if (isCallbackCalled) return;
      this.log(log);
      isCallbackCalled = true;

      this.off('mongodb:command:resume', onResume);
      this.off('mongodb:command:abort', onAbort);

      _callback(err, updatedResult ?? originalResult);
    };

    const onResume = (updatedResult: Document | undefined) => {
      callback('Resume', undefined, updatedResult);
    };

    const onAbort = () => {
      callback('Command abort', new Error('[QPE] Command aborted'));
    };

    this.once('mongodb:command:resume', onResume);
    this.once('mongodb:command:abort', onAbort);
  }

  protected log(...args: any[]) {
    log(`#${this.id}`, ...args);
  }

  //#region Singleton
  private static readonly _sessionInstances: {
    [sessionId: string]: QpSessionPause | undefined;
  } = {};

  /** @internal */
  public static createOrGet(
    sessionId: string | ClientSession | ServerSessionId | undefined
  ): QpSessionPause | null {
    if (!sessionId) {
      return null;
    }

    // Case string(sessionId)
    if (typeof sessionId === 'string') {
      const instance = this._sessionInstances[sessionId];
      if (instance) {
        return instance;
      }

      const newInstance = new QpSessionPause(sessionId);
      this._sessionInstances[sessionId] = newInstance;

      return newInstance;
    }

    // Case ClientSession
    if ('topology' in sessionId) {
      return this.createOrGet(sessionId.id);
    }

    // Case ServerSessionId
    return this.createOrGet(sessionId.id.toUUID().toHexString());
  }
  //#endregion
}

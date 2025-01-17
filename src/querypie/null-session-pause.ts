import type { Document } from 'bson';
import type { Query, WriteProtocolMessageType } from '../cmap/commands';
import type { CommandOperationOptions } from '../operations/command';
import { QpPause, QpPausePhase } from './pause';
import { QpSessionPause } from './session-pause';

/** @internal */
export class QpNullSessionPause extends QpSessionPause {
  private static _instance: QpNullSessionPause | undefined;
  public static get instance(): QpNullSessionPause {
    if (this._instance === undefined) {
      this._instance = new QpNullSessionPause();
    }

    return this._instance;
  }

  private constructor() {
    super('<NULL>');
  }

  /** @internal */
  public waitOnProtocol(
    id: string,
    phase: QpPausePhase,
    command: WriteProtocolMessageType,
    commandOptions: { [key: string]: any },
    result: Document | undefined,
    callback: (err: any | undefined, result: Document | undefined) => void,
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
      this.log('<QueryPie Warning>', 'GetMore CALLED', command.ns, command.cursorId);
      callback(undefined, result);
      return;
    }

    // Case KillCursor
    if ('cursorIds' in command) {
      this.log('<QueryPie Warning>', 'KillCursor CALLED', command.ns, command.cursorIds);
      callback(undefined, result);
      return;
    }

    if ('query' in command) {
      if (isQueryIgnorable(command)) {
        callback(undefined, result);
        return;
      }

      this.log('<QueryPie Warning>', 'Query CALLED', command.ns, command.query);
      callback(undefined, result);
      return;
    }

    if (isCommandIgnorableInEmptyBus(command.command)) {
      callback(undefined, result);
      return;
    }

    this.log('<QueryPie Warning>', 'Unknown command detected', command);
    callback(undefined, result);

    // throw new Error('Invalid command');
  }

  /** @internal */
  public waitOnCommand(
    id: string,
    phase: QpPausePhase,
    command: Document,
    commandOptions: { [key: string]: any },
    result: Document | undefined,
    callback: (err?: any) => void,
  ) {
    if (commandOptions[QpPause.kNoPause]) {
      callback();
      return;
    }

    if (!QpPause.instance.isCommandCapturing) {
      callback();
      return;
    }

    if (isCommandIgnorableInEmptyBus(command.command)) {
      callback();
      return;
    }

    this.log('<QueryPie Warning>', 'Unknown command detected', command);
    callback();
  }
}

const emptyIgnorables: Set<string> = new Set([
  'saslStart',
  'authenticate',
  'saslContinue',
  'getnonce',
  'createUser',
  'updateUser',
  'copydbgetnonce',
  'copydbsaslstart',
  'copydb',
  'ismaster',
  'ping',
]);

const isCommandIgnorableInEmptyBus = (command: Document): boolean => {
  const keys = Object.keys(command);
  if (keys.length === 0)
    return false;

  const firstKey = keys[0];

  if (!emptyIgnorables.has(firstKey))
    return false;

  return Boolean(command[firstKey]);
};

const isQueryIgnorable = (command: Query): boolean => {
  return Boolean(command.query.ismaster);
};

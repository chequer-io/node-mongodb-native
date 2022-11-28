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

    // throw new Error('Invalid command');
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

    if (isCommandIgnorableInEmptyBus(command.command)) {
      callback();
      return;
    }

    this.log('<QueryPie Warning>', 'Unknown command detected', command);
  }
}

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

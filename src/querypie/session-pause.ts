import type { Document } from 'bson';

import type { Msg, Query, WriteProtocolMessageType } from '../cmap/commands';
import { TypedEventEmitter } from '../mongo_types';
import type { IQpMongoDbLogger } from './logger';
import { QpMongoDbLoggerFactory } from './logger-factory';
import { QpPause, QpPausePhase } from './pause';

/** @internal */
export type QpSessionPauseEvents = {
  'mongodb:command:resume': (updatedResult: Document | undefined) => void;
  'mongodb:command:abort': () => void;
};

/** @internal */
export class QpSessionPause extends TypedEventEmitter<QpSessionPauseEvents> {
  public readonly id: string;
  protected readonly logger: IQpMongoDbLogger;

  public constructor(id: string) {
    super();

    this.id = id;
    this.logger = QpMongoDbLoggerFactory.create(`QpSessionPause#${id}`);
  }

  /** @internal */
  public waitOnProtocol(
    phase: QpPausePhase,
    command: WriteProtocolMessageType,
    commandOptions: { [key: string]: any },
    result: Document | undefined,
    callback: (err: any | undefined, result: Document | undefined) => void
  ) {
    const logger = this.logger.scope(phase);
    logger.verbose('command', command);
    logger.verbose('options', commandOptions);

    if (commandOptions[QpPause.kNoPause]) {
      logger.verbose('PASS', 'kNoPause: true');
      callback(undefined, result);
      return;
    }

    if (!QpPause.instance.isCommandCapturing) {
      logger.verbose('PASS', 'Command is not capturing');
      callback(undefined, result);
      return;
    }

    // Case GetMore
    if ('cursorId' in command) {
      logger.warn('PASS', 'GetMore CALLED');
      callback(undefined, result);
      return;
    }

    // Case KillCursor
    if ('cursorIds' in command) {
      logger.warn('PASS', 'KillCursor CALLED');
      callback(undefined, result);
      return;
    }

    // Case Query
    if ('query' in command) {
      if (isAllowedQuery(command)) {
        logger.verbose('PASS', 'Allowed Query');
        callback(undefined, result);
        return;
      }

      logger.warn('PASS', 'Query CALLED');
      callback(undefined, result);
      return;
    }

    // Case Msg
    if ('command' in command) {
      if (isAllowedMsg(command)) {
        logger.verbose('PASS', 'Allowed Msg');
        callback(undefined, result);
        return;
      }

      logger.debug('PAUSE');

      QpPause.instance.pause(this, phase, command.command, result);
      this.waitInternal(logger, result, callback);

      return;
    }

    throw new Error('Invalid protocol');
  }

  private waitInternal(
    logger: IQpMongoDbLogger,
    originalResult: Document | undefined,
    _callback: (err: any | undefined, updatedResult: Document | undefined) => void
  ) {
    let isCallbackCalled = false;

    const callback = (log: string, err?: any, updatedResult?: Document | undefined): void => {
      if (isCallbackCalled) return;
      isCallbackCalled = true;

      logger.debug(log);

      this.off('mongodb:command:resume', onResume);
      this.off('mongodb:command:abort', onAbort);

      _callback(err, updatedResult ?? originalResult);
    };

    const onResume = (updatedResult: Document | undefined) => {
      callback('Resume', undefined, updatedResult);
    };

    const onAbort = () => {
      callback('Abort', new Error('[QPE] Command aborted'));
    };

    this.once('mongodb:command:resume', onResume);
    this.once('mongodb:command:abort', onAbort);
  }
}

const allowedQueries: Set<string> = new Set(['ismaster']);

const isAllowedQuery = (query: Query): boolean => {
  const keys = Object.keys(query.query);
  if (keys.length === 0) return false;

  const firstKey = keys[0];
  if (!allowedQueries.has(firstKey)) return false;

  return Boolean(query.query[firstKey]);
};

const allowedMsgs: Set<string> = new Set([
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
  'hello'
]);

const isAllowedMsg = (msg: Msg): boolean => {
  const keys = Object.keys(msg.command);
  if (keys.length === 0) return false;

  const firstKey = keys[0];
  if (!allowedMsgs.has(firstKey)) return false;

  return Boolean(msg.command[firstKey]);
};

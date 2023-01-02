import type {
  GetMore,
  KillCursor,
  Msg,
  Query,
  WriteProtocolMessageType
} from '../../cmap/commands';
import type { CommandOptions } from '../../cmap/connection';
import type { ClientSession, ServerSessionId } from '../../sessions';
import type { IQpWriteProtocolMessageTypeContext } from '../contexts/WriteProtocolMessageType/IQpWriteProtocolMessageTypeContext';
import { QpRunCommandContext_To_IQpWriteProtocolMessageTypeContext_Adapter } from '../contexts/WriteProtocolMessageType/QpRunCommandContext_To_IQpWriteProtocolMessageTypeContext_Adapter';
import { QpWriteProtocolMessageTypePassContext } from '../contexts/WriteProtocolMessageType/QpWriteProtocolMessageTypePassContext';
import { QpExceptionLevel } from '../exceptions/QpExceptionLevel';
import { QpMongoDbException } from '../exceptions/QpMongoDbException';
import { QpRunCommandManager } from '../QpRunCommandManager';
import { resolveSessionId } from '../utils/session-id';
import { QpRunCommandContextFactory } from './QpRunCommandContextFactory';

/**
 * @internal
 */
export class QpWriteProtocolMessageTypeContextFactory {
  public static Create(
    identifier: string | ClientSession | ServerSessionId | undefined,
    protocol: WriteProtocolMessageType,
    options: CommandOptions
  ): IQpWriteProtocolMessageTypeContext {
    if (!QpRunCommandManager.Instance.IsActivated()) {
      return new QpWriteProtocolMessageTypePassContext(protocol, options);
    }

    const sessionId = resolveSessionId(identifier);
    if (!sessionId) {
      return new QpWriteProtocolMessageTypePassContext(protocol, options);
    }

    // Case GetMore
    if ('cursorId' in protocol) {
      return QpWriteProtocolMessageTypeContextFactory.CreateWithGetMore(protocol, options);
    }

    // Case KillCursor
    if ('cursorIds' in protocol) {
      return QpWriteProtocolMessageTypeContextFactory.CreateWithKillCursor(protocol, options);
    }

    // Case Msg
    if ('command' in protocol) {
      return QpWriteProtocolMessageTypeContextFactory.CreateWithMsg(protocol, options);
    }

    // Case Query
    if ('query' in protocol) {
      return QpWriteProtocolMessageTypeContextFactory.CreateWithQuery(protocol, options);
    }

    // Case default
    throw new QpMongoDbException(QpExceptionLevel.INTERNAL, 'Cannot resolve protocol type');
  }

  public static CreateWithMsg(
    msg: Msg,
    options: CommandOptions
  ): IQpWriteProtocolMessageTypeContext {
    const runCommandContext = QpRunCommandContextFactory.Create(msg.command, options);

    if (!runCommandContext) {
      return new QpWriteProtocolMessageTypePassContext(msg, options);
    }

    return new QpRunCommandContext_To_IQpWriteProtocolMessageTypeContext_Adapter(
      runCommandContext,
      msg,
      options
    );
  }

  public static CreateWithQuery(
    query: Query,
    options: CommandOptions
  ): IQpWriteProtocolMessageTypeContext {
    return new QpWriteProtocolMessageTypePassContext(query, options);
  }

  public static CreateWithGetMore(
    getMore: GetMore,
    options: CommandOptions
  ): IQpWriteProtocolMessageTypeContext {
    return new QpWriteProtocolMessageTypePassContext(getMore, options);
  }

  public static CreateWithKillCursor(
    killCursor: KillCursor,
    options: CommandOptions
  ): IQpWriteProtocolMessageTypeContext {
    return new QpWriteProtocolMessageTypePassContext(killCursor, options);
  }
}

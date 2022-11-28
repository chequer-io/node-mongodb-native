import type { ClientSession, ServerSessionId } from '../sessions';
import { QpNullSessionPause } from './null-session-pause';
import { QpSessionPause } from './session-pause';

/** @internal */
export class QpSessionPauseManager {
  public static get null() {
    return QpNullSessionPause.instance;
  }

  public static createOrGet(
    sessionId: string | ClientSession | ServerSessionId | undefined
  ): QpSessionPause {
    const pause = QpSessionPause.createOrGet(sessionId);
    if (pause == null) {
      return this.null;
    }

    return pause;
  }
  //#endregion
}

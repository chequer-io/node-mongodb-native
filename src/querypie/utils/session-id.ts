import type { ClientSession, ServerSessionId } from '../../sessions';

/**
 * @internal
 */
export const resolveSessionId = (
  identifier: string | ClientSession | ServerSessionId | undefined
): string | undefined => {
  if (!identifier) {
    return undefined;
  }

  if (typeof identifier === 'string') {
    return identifier;
  }

  // Get ServerSessionId from ClientSession
  if ('topology' in identifier) {
    identifier = identifier.id;
  }

  // Case ServerSessionId is undefined
  if (!identifier) {
    return undefined;
  }

  // Get sessionId from ServerSessionId
  return identifier.id.toUUID().toHexString();
};

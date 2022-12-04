import type { Document } from 'bson';

import { QpException } from '../../exceptions/QpException';
import { QpExceptionLevel } from '../../exceptions/QpExceptionLevel';
import type { IQpCommandFilter } from './IQpCommandFilter';

export class QpCommandFilter implements IQpCommandFilter {
  private readonly _skipCommands: string[] = [
    // 'aggregate',
    // 'count',
    // 'distinct',
    // 'mapReduce',
    // 'geoSearch',
    // 'delete',
    // 'find',
    // 'findAndModify',
    // 'getMore',
    // 'insert',
    // 'resetError',
    // 'update',
    // 'planCacheClear',
    // 'planCacheClearFilters',
    // 'planCacheListFilters',
    // 'planCacheSetFilter',
    'authenticate',
    'getnonce',
    // 'logout',
    // 'createUser',
    // 'dropAllUsersFromDatabase',
    // 'dropUser',
    // 'grantRolesToUser',
    // 'revokeRolesFromUser',
    // 'updateUser',
    // 'usersInfo',
    // 'createRole',
    // 'dropRole',
    // 'dropAllRolesFromDatabase',
    // 'grantPrivilegesToRole',
    // 'grantRolesToRole',
    // 'invalidateUserCache',
    // 'revokePrivilegesFromRole',
    // 'revokeRolesFromRole',
    // 'rolesInfo',
    // 'updateRole',
    // 'applyOps',
    // 'hello',
    // 'replSetAbortPrimaryCatchUp',
    // 'replSetFreeze',
    // 'replSetGetConfig',
    // 'replSetGetStatus',
    // 'replSetInitiate',
    // 'replSetMaintenance',
    // 'replSetReconfig',
    // 'replSetResizeOplog',
    // 'replSetStepDown',
    // 'replSetSyncFrom',
    // 'abortReshardCollection',
    // 'addShard',
    // 'addShardToZone',
    // 'balancerCollectionStatus',
    // 'balancerStart',
    // 'balancerStatus',
    // 'balancerStop',
    // 'checkShardingIndex',
    // 'clearJumboFlag',
    // 'cleanupOrphaned',
    // 'cleanupReshardCollection',
    // 'commitReshardCollection',
    // 'configureCollectionBalancing',
    // 'enableSharding',
    // 'flushRouterConfig',
    // 'getShardMap',
    // 'getShardVersion',
    // 'isdbgrid',
    // 'listShards',
    // 'medianKey',
    // 'moveChunk',
    // 'movePrimary',
    // 'mergeChunks',
    // 'refineCollectionShardKey',
    // 'removeShard',
    // 'removeShardFromZone',
    // 'reshardCollection',
    // 'setShardVersion',
    // 'shardCollection',
    // 'shardingState',
    // 'split',
    // 'splitVector',
    // 'unsetSharding',
    // 'updateZoneKeyRange',
    // 'abortTransaction',
    // 'commitTransaction',
    // 'endSessions',
    // 'killAllSessions',
    // 'killAllSessionsByPattern',
    // 'killSessions',
    // 'refreshSessions',
    // 'startSession',
    // 'cloneCollectionAsCapped',
    // 'collMod',
    // 'compact',
    // 'compactStructuredEncryptionData',
    // 'convertToCapped',
    // 'create',
    // 'createIndexes',
    // 'currentOp',
    // 'drop',
    // 'dropDatabase',
    // 'dropConnections',
    // 'dropIndexes',
    // 'filemd5',
    // 'fsync',
    // 'fsyncUnlock',
    // 'getDefaultRWConcern',
    // 'getClusterParameter',
    // 'getParameter',
    // 'killCursors',
    // 'killOp',
    // 'listCollections',
    // 'listDatabases',
    // 'listIndexes',
    // 'logRotate',
    // 'reIndex',
    // 'renameCollection',
    // 'rotateCertificates',
    // 'setFeatureCompatibilityVersion',
    // 'setIndexCommitQuorum',
    // 'setClusterParameter',
    // 'setParameter',
    // 'setDefaultRWConcern',
    // 'shutdown',
    'buildInfo',
    // 'collStats',
    // 'connPoolStats',
    // 'connectionStatus',
    // 'dataSize',
    // 'dbHash',
    // 'dbStats',
    // 'driverOIDTest',
    // 'explain',
    // 'features',
    // 'getCmdLineOpts',
    // 'getLog',
    // 'hostInfo',
    '_isSelf',
    // 'listCommands',
    // 'lockInfo',
    'netstat',
    'ping',
    // 'profile',
    // 'serverStatus',
    // 'shardConnPoolStats',
    // 'top',
    // 'validate',
    // 'whatsmyuri',
    // 'setFreeMonitoring',
    // 'logApplicationMessage',
    ''
  ].filter(x => x.length !== 0);

  private readonly _rejectCommands: string[] = [
    // Nothing to reject now
    ''
  ].filter(x => x.length !== 0);

  public IsSkipCommand(command: Document): boolean {
    const commandKey = this._GetCommandKey(command);
    if (commandKey == null) return false;

    return this._IsSkip(commandKey);
  }

  public IsRejectCommand(command: Document): boolean {
    const commandKey = this._GetCommandKey(command);
    if (commandKey == null) return false;

    return this._IsReject(commandKey);
  }

  public ThrowIfRejectCommand(command: Document): void {
    const commandKey = this._GetCommandKey(command);
    if (commandKey == null) return;

    if (!this._IsReject(commandKey)) return;

    throw new QpException(
      QpExceptionLevel.NORMAL,
      `A '${commandKey}' command cannot use in QueryPie.`
    );
  }

  private _IsSkip(command: string): boolean {
    return this._skipCommands.includes(command);
  }

  private _IsReject(command: string): boolean {
    return this._rejectCommands.includes(command);
  }

  private _GetCommandKey(command: Document): string | null {
    const keys = Object.keys(command);
    if (keys.length === 0) {
      return null;
    }

    return keys[0];
  }
}

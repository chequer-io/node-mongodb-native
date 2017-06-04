"use strict";

var parse = require('./url_parser')
  , Server = require('./server')
  , Mongos = require('./mongos')
  , ReplSet = require('./replset')
  , EventEmitter = require('events').EventEmitter
  , inherits = require('util').inherits
  , Define = require('./metadata')
  , ReadPreference = require('./read_preference')
  , Logger = require('mongodb-core').Logger
  , MongoError = require('mongodb-core').MongoError
  , handleCallback = require('./utils').handleCallback
  , Db = require('./db')
  , f = require('util').format
  , assign = require('./utils').assign
  , shallowClone = require('./utils').shallowClone
  , authenticate = require('./authenticate');

/**
 * @fileOverview The **MongoClient** class is a class that allows for making Connections to MongoDB.
 *
 * @example
 * var MongoClient = require('mongodb').MongoClient,
 *   test = require('assert');
 * // Connection url
 * var url = 'mongodb://localhost:27017/test';
 * // Connect using MongoClient
 * MongoClient.connect(url, function(err, db) {
 *   // Get an additional db
 *   db.close();
 * });
 */
var validOptionNames = ['poolSize', 'ssl', 'sslValidate', 'sslCA', 'sslCert',
  'sslKey', 'sslPass', 'sslCRL', 'autoReconnect', 'noDelay', 'keepAlive', 'connectTimeoutMS', 'family',
  'socketTimeoutMS', 'reconnectTries', 'reconnectInterval', 'ha', 'haInterval',
  'replicaSet', 'secondaryAcceptableLatencyMS', 'acceptableLatencyMS',
  'connectWithNoPrimary', 'authSource', 'w', 'wtimeout', 'j', 'forceServerObjectId',
  'serializeFunctions', 'ignoreUndefined', 'raw', 'bufferMaxEntries',
  'readPreference', 'pkFactory', 'promiseLibrary', 'readConcern', 'maxStalenessSeconds',
  'loggerLevel', 'logger', 'promoteValues', 'promoteBuffers', 'promoteLongs',
  'domainsEnabled', 'keepAliveInitialDelay', 'checkServerIdentity', 'validateOptions', 'appname', 'auth'];
var ignoreOptionNames = ['native_parser'];
var legacyOptionNames = ['server', 'replset', 'replSet', 'mongos', 'db'];

function validOptions(options) {
  var _validOptions = validOptionNames.concat(legacyOptionNames);

  for(var name in options) {
    if(ignoreOptionNames.indexOf(name) != -1) {
      continue;
    }

    if(_validOptions.indexOf(name) == -1 && options.validateOptions) {
      return new MongoError(f('option %s is not supported', name));
    } else if(_validOptions.indexOf(name) == -1) {
      console.warn(f('the options [%s] is not supported', name));
    }

    if(legacyOptionNames.indexOf(name) != -1) {
      console.warn(f('the server/replset/mongos options are deprecated, '
      + 'all their options are supported at the top level of the options object [%s]', validOptionNames));
    }
  }
}

/**
 * Creates a new MongoClient instance
 * @class
 * @param {string} url The connection URI string
 * @param {object} [options] Optional settings.
 * @param {number} [options.poolSize=5] poolSize The maximum size of the individual server pool.
 * @param {boolean} [options.ssl=false] Enable SSL connection.
 * @param {Buffer} [options.sslCA=undefined] SSL Certificate store binary buffer
 * @param {Buffer} [options.sslCRL=undefined] SSL Certificate revocation list binary buffer
 * @param {Buffer} [options.sslCert=undefined] SSL Certificate binary buffer
 * @param {Buffer} [options.sslKey=undefined] SSL Key file binary buffer
 * @param {string} [options.sslPass=undefined] SSL Certificate pass phrase
 * @param {boolean|function} [options.checkServerIdentity=true] Ensure we check server identify during SSL, set to false to disable checking. Only works for Node 0.12.x or higher. You can pass in a boolean or your own checkServerIdentity override function.
 * @param {boolean} [options.autoReconnect=true] Enable autoReconnect for single server instances
 * @param {boolean} [options.noDelay=true] TCP Connection no delay
 * @param {boolean} [options.keepAlive=0] The number of milliseconds to wait before initiating keepAlive on the TCP socket.
 * @param {number} [options.connectTimeoutMS=30000] TCP Connection timeout setting
 * @param {number} [options.socketTimeoutMS=30000] TCP Socket timeout setting
 * @param {number} [options.reconnectTries=30] Server attempt to reconnect #times
 * @param {number} [options.reconnectInterval=1000] Server will wait # milliseconds between retries
 * @param {boolean} [options.ha=true] Control if high availability monitoring runs for Replicaset or Mongos proxies.
 * @param {number} [options.haInterval=10000] The High availability period for replicaset inquiry
 * @param {string} [options.replicaSet=undefined] The Replicaset set name
 * @param {number} [options.secondaryAcceptableLatencyMS=15] Cutoff latency point in MS for Replicaset member selection
 * @param {number} [options.acceptableLatencyMS=15] Cutoff latency point in MS for Mongos proxies selection.
 * @param {boolean} [options.connectWithNoPrimary=false] Sets if the driver should connect even if no primary is available
 * @param {string} [options.authSource=undefined] Define the database to authenticate against
 * @param {(number|string)} [options.w=null] The write concern.
 * @param {number} [options.wtimeout=null] The write concern timeout.
 * @param {boolean} [options.j=false] Specify a journal write concern.
 * @param {boolean} [options.forceServerObjectId=false] Force server to assign _id values instead of driver.
 * @param {boolean} [options.serializeFunctions=false] Serialize functions on any object.
 * @param {Boolean} [options.ignoreUndefined=false] Specify if the BSON serializer should ignore undefined fields.
 * @param {boolean} [options.raw=false] Return document results as raw BSON buffers.
 * @param {boolean} [options.promoteLongs=true] Promotes Long values to number if they fit inside the 53 bits resolution.
 * @param {boolean} [options.promoteBuffers=false] Promotes Binary BSON values to native Node Buffers.
 * @param {boolean} [options.promoteValues=true] Promotes BSON values to native types where possible, set to false to only receive wrapper types.
 * @param {number} [options.bufferMaxEntries=-1] Sets a cap on how many operations the driver will buffer up before giving up on getting a working connection, default is -1 which is unlimited.
 * @param {(ReadPreference|string)} [options.readPreference=null] The preferred read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED, ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST).
 * @param {boolean} [options.domainsEnabled=false] Enable the wrapping of the callback in the current domain, disabled by default to avoid perf hit.
 * @param {object} [options.pkFactory=null] A primary key factory object for generation of custom _id keys.
 * @param {object} [options.promiseLibrary=null] A Promise library class the application wishes to use such as Bluebird, must be ES6 compatible
 * @param {object} [options.readConcern=null] Specify a read concern for the collection. (only MongoDB 3.2 or higher supported)
 * @param {string} [options.readConcern.level='local'] Specify a read concern level for the collection operations, one of [local|majority]. (only MongoDB 3.2 or higher supported)
 * @param {number} [options.maxStalenessSeconds=undefined] The max staleness to secondary reads (values under 10 seconds cannot be guaranteed);
 * @param {string} [options.loggerLevel=undefined] The logging level (error/warn/info/debug)
 * @param {object} [options.logger=undefined] Custom logger object
 * @param {object} [options.validateOptions=false] Validate MongoClient passed in options for correctness.
 * @return {MongoClient} a MongoClient instance.
 */
function MongoClient(url, options) {
  if(!(this instanceof MongoClient)) return new MongoClient();

  // Set up event emitter
  EventEmitter.call(this);

  // The internal state
  this.s = {
    url: url,
    options: options || {},
    promiseLibrary: null,
    dbCache: {},
  }

  // Get the promiseLibrary
  var promiseLibrary = this.s.options.promiseLibrary;

  // No promise library selected fall back
  if(!promiseLibrary) {
    promiseLibrary = typeof global.Promise == 'function' ?
      global.Promise : require('es6-promise').Promise;
  }

  // Add the promise to the internal state
  this.s.promiseLibrary = promiseLibrary;
}

/**
 * @ignore
 */
inherits(MongoClient, EventEmitter);

var define = MongoClient.define = new Define('MongoClient', MongoClient, false);

/**
 * The callback format for results
 * @callback MongoClient~connectCallback
 * @param {MongoError} error An error instance representing the error during the execution.
 * @param {Db} db The connected database.
 */

/**
 * Connect to MongoDB using a url as documented at
 *
 *  docs.mongodb.org/manual/reference/connection-string/
 *
 * Note that for replicasets the replicaSet query parameter is required in the 2.0 driver
 *
 * @method
 * @param {MongoClient~connectCallback} [callback] The command result callback
 * @return {Promise} returns Promise if no callback passed
 * @deprecated MongoClient.connect is deprecated, please use new MongoClient().connect() to connect.
 */
MongoClient.prototype.connect = function(callback) {
  var self = this;

  // Validate options object
  var err = validOptions(self.s.options);

  // Return a promise
  if(typeof callback != 'function') {
    return new this.s.promiseLibrary(function(resolve, reject) {
      // Did we have a validation error
      if(err) return reject(err);
      // Attempt to connect
      connect(self, self.s.url, self.s.options, function(err, topology) {
        // console.log("%% MongoClient.prototype.connect 0")
        if(err) return reject(err);
        self.topology = topology;
        resolve(self);
      });
    });
  }

  // Did we have a validation error
  if(err) return callback(err);
  // Fallback to callback based connect
  connect(self, self.s.url, self.s.options, function(err, topology) {
    // console.log("%% MongoClient.prototype.connect 1")
    if(err) return callback(err);
    self.topology = topology;
    callback(null, self);
  });
}

define.classMethod('close', {callback: true, promise:true, returns: [MongoClient]});

/**
 * Logout user from server, fire off on all connections and remove all auth info
 * @method
 * @param {object} [options=null] Optional settings.
 * @param {string} [options.dbName=null] Logout against different database than current.
 * @param {Db~resultCallback} [callback] The command result callback
 * @return {Promise} returns Promise if no callback passed
 */
MongoClient.prototype.logout = function(options, callback) {
  var self = this;
  if(typeof options == 'function') callback = options, options = {};
  options = options || {};

  // Establish the correct database name
  var dbName = this.s.options.authSource
    ? this.s.options.authSource : this.s.options.dbName;

  // If we have a callback
  if(typeof callback == 'function') {
    return self.topology.logout(dbName, function(err) {
      if(err) return callback(err);
      callback(null, true);
    });
  }

  // Return a promise
  return new this.s.promiseLibrary(function(resolve, reject) {
    self.topology.logout(dbName, function(err) {
      if(err) return reject(err);
      resolve(true);
    });
  });
}

define.classMethod('logout', {callback: true, promise:true});

/**
 * Close the db and its underlying connections
 * @method
 * @param {boolean} force Force close, emitting no events
 * @param {Db~noResultCallback} [callback] The result callback
 * @return {Promise} returns Promise if no callback passed
 */
MongoClient.prototype.close = function(force, callback) {
  var self = this;
  if(typeof force == 'function') callback = force, force = false;
  // Close the topologu connection
  this.topology.close(force);

  // console.log("$$$$$$$$$$$$$$$$$$$$$$$ MongoClient.prototype.close 0")
  // console.dir(this.s.dbCache)

  // Emit close event
  self.emit('close', self);

  // Fire close event on any cached db instances
  for(var name in this.s.dbCache) {
    this.s.dbCache[name].emit("close");
  }

  // console.log("$$$$$$$$$$$$$$$$$$$$$$$ MongoClient.prototype.close 1")

  // Remove listeners after emit
  self.removeAllListeners('close');

  // Callback after next event loop tick
  if(typeof callback == 'function') return process.nextTick(function() {
    handleCallback(callback, null);
  })

  // Return dummy promise
  return new this.s.promiseLibrary(function(resolve) {
    resolve();
  });
}

define.classMethod('close', {callback: true, promise:true});

/**
 * Create a new Db instance sharing the current socket connections. Be aware that the new db instances are
 * related in a parent-child relationship to the original instance so that events are correctly emitted on child
 * db instances. Child db instances are cached so performing db('db1') twice will return the same instance.
 * You can control these behaviors with the options noListener and returnNonCachedInstance.
 *
 * @method
 * @param {string} name The name of the database we want to use.
 * @param {object} [options=null] Optional settings.
 * @param {boolean} [options.noListener=false] Do not make the db an event listener to the original connection.
 * @param {boolean} [options.returnNonCachedInstance=false] Control if you want to return a cached instance or have a new one created
 * @return {Db}
 */
MongoClient.prototype.db = function(dbName, options) {
  options = options || {};

  // Copy the options and add out internal override of the not shared flag
  var finalOptions = assign({}, this.s.options, options);

  // Do we have the db in the cache already
  if(this.s.dbCache[dbName] && finalOptions.returnNonCachedInstance !== true) {
    return this.s.dbCache[dbName];
  }

  // Add promiseLibrary
  finalOptions.promiseLibrary = this.s.promiseLibrary;

  // If no topology throw an error message
  if(!this.topology) {
    throw new MongoError("MongoClient must be connected before calling MongoClient.prototype.db");
  }

  // Return the db object
  var db = new Db(dbName, this.topology, finalOptions)

  // Add the db to the cache
  this.s.dbCache[dbName] = db;
  // Return the database
  return db;
}

/**
 * Check if MongoClient is connected
 *
 * @method
 * @param {string} name The name of the database we want to use.
 * @param {object} [options=null] Optional settings.
 * @param {boolean} [options.noListener=false] Do not make the db an event listener to the original connection.
 * @param {boolean} [options.returnNonCachedInstance=false] Control if you want to return a cached instance or have a new one created
 * @return {Db}
 */
MongoClient.prototype.isConnected = function(options) {
  options = options || {};

  if(!this.topology) return false;
  return this.topology.isConnected(options);
}

/**
 * Connect to MongoDB using a url as documented at
 *
 *  docs.mongodb.org/manual/reference/connection-string/
 *
 * Note that for replicasets the replicaSet query parameter is required in the 2.0 driver
 *
 * @method
 * @static
 * @param {string} url The connection URI string
 * @param {object} [options] Optional settings.
 * @param {number} [options.poolSize=5] poolSize The maximum size of the individual server pool.
 * @param {boolean} [options.ssl=false] Enable SSL connection.
 * @param {Buffer} [options.sslCA=undefined] SSL Certificate store binary buffer
 * @param {Buffer} [options.sslCRL=undefined] SSL Certificate revocation list binary buffer
 * @param {Buffer} [options.sslCert=undefined] SSL Certificate binary buffer
 * @param {Buffer} [options.sslKey=undefined] SSL Key file binary buffer
 * @param {string} [options.sslPass=undefined] SSL Certificate pass phrase
 * @param {boolean|function} [options.checkServerIdentity=true] Ensure we check server identify during SSL, set to false to disable checking. Only works for Node 0.12.x or higher. You can pass in a boolean or your own checkServerIdentity override function.
 * @param {boolean} [options.autoReconnect=true] Enable autoReconnect for single server instances
 * @param {boolean} [options.noDelay=true] TCP Connection no delay
 * @param {number} [options.family=4] Version of IP stack. Defaults to 4.
 * @param {boolean} [options.keepAlive=30000] The number of milliseconds to wait before initiating keepAlive on the TCP socket.
 * @param {number} [options.connectTimeoutMS=30000] TCP Connection timeout setting
 * @param {number} [options.socketTimeoutMS=360000] TCP Socket timeout setting
 * @param {number} [options.reconnectTries=30] Server attempt to reconnect #times
 * @param {number} [options.reconnectInterval=1000] Server will wait # milliseconds between retries
 * @param {boolean} [options.ha=true] Control if high availability monitoring runs for Replicaset or Mongos proxies.
 * @param {number} [options.haInterval=10000] The High availability period for replicaset inquiry
 * @param {string} [options.replicaSet=undefined] The Replicaset set name
 * @param {number} [options.secondaryAcceptableLatencyMS=15] Cutoff latency point in MS for Replicaset member selection
 * @param {number} [options.acceptableLatencyMS=15] Cutoff latency point in MS for Mongos proxies selection.
 * @param {boolean} [options.connectWithNoPrimary=false] Sets if the driver should connect even if no primary is available
 * @param {string} [options.authSource=undefined] Define the database to authenticate against
 * @param {string} [options.auth.user=undefined] The username for auth
 * @param {string} [options.auth.password=undefined] The username for auth
 * @param {(number|string)} [options.w=null] The write concern.
 * @param {number} [options.wtimeout=null] The write concern timeout.
 * @param {boolean} [options.j=false] Specify a journal write concern.
 * @param {boolean} [options.forceServerObjectId=false] Force server to assign _id values instead of driver.
 * @param {boolean} [options.serializeFunctions=false] Serialize functions on any object.
 * @param {Boolean} [options.ignoreUndefined=false] Specify if the BSON serializer should ignore undefined fields.
 * @param {boolean} [options.raw=false] Return document results as raw BSON buffers.
 * @param {boolean} [options.promoteLongs=true] Promotes Long values to number if they fit inside the 53 bits resolution.
 * @param {boolean} [options.promoteBuffers=false] Promotes Binary BSON values to native Node Buffers.
 * @param {boolean} [options.promoteValues=true] Promotes BSON values to native types where possible, set to false to only receive wrapper types.
 * @param {number} [options.bufferMaxEntries=-1] Sets a cap on how many operations the driver will buffer up before giving up on getting a working connection, default is -1 which is unlimited.
 * @param {(ReadPreference|string)} [options.readPreference=null] The preferred read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED, ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST).
 * @param {boolean} [options.domainsEnabled=false] Enable the wrapping of the callback in the current domain, disabled by default to avoid perf hit.
 * @param {object} [options.pkFactory=null] A primary key factory object for generation of custom _id keys.
 * @param {object} [options.promiseLibrary=null] A Promise library class the application wishes to use such as Bluebird, must be ES6 compatible
 * @param {object} [options.readConcern=null] Specify a read concern for the collection. (only MongoDB 3.2 or higher supported)
 * @param {string} [options.readConcern.level='local'] Specify a read concern level for the collection operations, one of [local|majority]. (only MongoDB 3.2 or higher supported)
 * @param {number} [options.maxStalenessSeconds=undefined] The max staleness to secondary reads (values under 10 seconds cannot be guaranteed);
 * @param {string} [options.appname=undefined] The name of the application that created this MongoClient instance. MongoDB 3.4 and newer will print this value in the server log upon establishing each connection. It is also recorded in the slow query log and profile collections.
 * @param {string} [options.loggerLevel=undefined] The logging level (error/warn/info/debug)
 * @param {object} [options.logger=undefined] Custom logger object
 * @param {object} [options.validateOptions=false] Validate MongoClient passed in options for correctness.
 * @param {MongoClient~connectCallback} [callback] The command result callback
 * @return {Promise} returns Promise if no callback passed
 */
MongoClient.connect = function(url, options, callback) {
  var args = Array.prototype.slice.call(arguments, 1);
  callback = typeof args[args.length - 1] == 'function' ? args.pop() : null;
  options = args.length ? args.shift() : null;
  options = options || {};

  // Create client
  var mongoclient = new MongoClient(url, options);
  // Execute the connect method
  return mongoclient.connect(callback);
}

define.staticMethod('connect', {callback: true, promise:true});

var mergeOptions = function(target, source, flatten) {
  for(var name in source) {
    if(source[name] && typeof source[name] == 'object' && flatten) {
      target = mergeOptions(target, source[name], flatten);
    } else {
      target[name] = source[name];
    }
  }

  return target;
}

var createUnifiedOptions = function(finalOptions, options) {
  var childOptions = ['mongos', 'server', 'db'
    , 'replset', 'db_options', 'server_options', 'rs_options', 'mongos_options'];
  var noMerge = ['readconcern'];

  for(var name in options) {
    if(noMerge.indexOf(name.toLowerCase()) != -1) {
      finalOptions[name] = options[name];
    } else if(childOptions.indexOf(name.toLowerCase()) != -1) {
      finalOptions = mergeOptions(finalOptions, options[name], false);
    } else {
      if(options[name] && typeof options[name] == 'object' && !Buffer.isBuffer(options[name]) && !Array.isArray(options[name])) {
        finalOptions = mergeOptions(finalOptions, options[name], true);
      } else {
        finalOptions[name] = options[name];
      }
    }
  }

  return finalOptions;
}

function translateOptions(options) {
  // If we have a readPreference passed in by the db options
  if(typeof options.readPreference == 'string' || typeof options.read_preference == 'string') {
    options.readPreference = new ReadPreference(options.readPreference || options.read_preference);
  }

  // Do we have readPreference tags, add them
  if(options.readPreference && (options.readPreferenceTags || options.read_preference_tags)) {
    options.readPreference.tags = options.readPreferenceTags || options.read_preference_tags;
  }

  // Do we have maxStalenessSeconds
  if(options.maxStalenessSeconds) {
    options.readPreference.maxStalenessSeconds = options.maxStalenessSeconds;
  }

  // Set the socket and connection timeouts
  if(options.socketTimeoutMS == null) options.socketTimeoutMS = 360000;
  if(options.connectTimeoutMS == null) options.connectTimeoutMS = 30000;

  // Create server instances
  return options.servers.map(function(serverObj) {
    return serverObj.domain_socket ?
      new Server(serverObj.domain_socket, 27017, options)
    : new Server(serverObj.host, serverObj.port, options);
  });
}

//
// Collect all events in order from SDAM
//
function collectEvents(self, topology) {
  var collectedEvents = [];

  if(self instanceof MongoClient) {
    var events = ["timeout", "close", 'serverOpening', 'serverDescriptionChanged', 'serverHeartbeatStarted',
      'serverHeartbeatSucceeded', 'serverHeartbeatFailed', 'serverClosed', 'topologyOpening',
      'topologyClosed', 'topologyDescriptionChanged', 'joined', 'left', 'ping', 'ha', 'all', 'fullsetup'];
    events.forEach(function(event) {
      topology.on(event, function(object1, object2) {
        collectedEvents.push({
          event: event, object1: object1, object2: object2
        });
      });
    });
  }

  return collectedEvents;
}

//
// Replay any events due to single server connection switching to Mongos
//
function replayEvents(self, events) {
  for(var i = 0; i < events.length; i++) {
    self.emit(events[i].event, events[i].object1, events[i].object2);
  }
}

function relayEvents(self, topology) {
  var events = ["timeout", "close", 'serverOpening', 'serverDescriptionChanged', 'serverHeartbeatStarted',
    'serverHeartbeatSucceeded', 'serverHeartbeatFailed', 'serverClosed', 'topologyOpening',
    'topologyClosed', 'topologyDescriptionChanged', 'joined', 'left', 'ping', 'ha', 'all', 'fullsetup'];
  events.forEach(function(event) {
    topology.on(event, function(object1, object2) {
      // console.log("==== relayEvents " + event)
      self.emit(event, object1, object2);
    });
  });
}

function createServer(self, options, callback) {
  // Set default options
  var servers = translateOptions(options);
  // Propegate the events to the client
  var collectedEvents = collectEvents(self, servers[0]);
  // Connect to topology
  servers[0].connect(options, function(err, topology) {
    if(err) return callback(err);
    // Clear out all the collected event listeners
    clearAllEvents(servers[0]);
    // Relaty all the events
    relayEvents(self, servers[0]);
    // Add listeners
    addListeners(self, servers[0]);
    // Check if we are really speaking to a mongos
    var ismaster = topology.lastIsMaster();
    // Set the topology
    self.topology = topology;

    // Do we actually have a mongos
    if(ismaster && ismaster.msg == 'isdbgrid') {
      // Destroy the current connection
      topology.close();
      // Create mongos connection instead
      return createMongos(self, options, callback);
    }

    // Fire all the events
    replayEvents(self, collectedEvents);
    // Otherwise callback
    callback(err, topology);
  });
}

function createReplicaset(self, options, callback) {
  // Set default options
  var servers = translateOptions(options);
  // Create the topology
  var topology = new ReplSet(servers, options);
  // Add listeners
  addListeners(self, topology);
  // Propegate the events to the client
  relayEvents(self, topology);
  // Open the connection
  topology.connect(options, function(err, topology) {
    if(err) return callback(err);
    self.topology = topology;
    callback(null, topology);
  });
}

function createMongos(self, options, callback) {
  // Set default options
  var servers = translateOptions(options);
  // Creater the topology
  var topology = new Mongos(servers, options);
  // Add listeners
  addListeners(self, topology);
  // Propegate the events to the client
  relayEvents(self, topology);
  // Open the connection
  topology.connect(options, function(err, topology) {
    if(err) return callback(err);
    self.topology = topology;
    callback(null, topology);
  });
}

function createListener(self, event) {
  return function(v1, v2) {
    // console.log("==== createListener " + event)
    if(event == 'open' || event == 'fullsetup'
      || event == 'all' || event == 'reconnect') {
    // console.log("==== createListener " + event)
      return self.emit(event, self);
    }

    self.emit(event, v1, v2);
  }
}

function addListeners(self, topology) {
  topology.on('authenticated', createListener(self, 'authenticated'));
  topology.on('error', createListener(self, 'error'));
  topology.on('timeout', createListener(self, 'timeout'));
  topology.on('close', createListener(self, 'close'));
  topology.on('parseError', createListener(self, 'parseError'));
  topology.once('open', createListener(self, 'open'));
  topology.once('fullsetup', createListener(self, 'fullsetup'));
  topology.once('all', createListener(self, 'all'));
  topology.on('reconnect', createListener(self, 'reconnect'));
}

function connectHandler(client, options, callback) {
  return function (err, topology) {
    if(err) {
      return process.nextTick(function() {
        try {
          callback(err, null);
        } catch (err) {
          if(topology) topology.close();
          throw err
        }
      });
    }

    // No authentication just reconnect
    if(!options.auth) {
      return process.nextTick(function() {
        try {
          callback(err, topology);
        } catch (err) {
          if(topology) topology.close();
          throw err
        }
      })
    }

    // Authenticate
    authenticate(client, options.user, options.password, options, function(err, success) {
      if(success){
        process.nextTick(function() {
          try {
            callback(null, topology);
          } catch (err) {
            if(topology) topology.close();
            throw err
          }
        });
      } else {
        if(topology) topology.close();
        process.nextTick(function() {
          try {
            callback(err ? err : new Error('Could not authenticate user ' + options.auth[0]), null);
          } catch (err) {
            if(topology) topology.close();
            throw err
          }
        });
      }
    });
  }
}

/*
 * Connect using MongoClient
 */
var connect = function(self, url, options, callback) {
  options = options || {};
  options = shallowClone(options);

  // If callback is null throw an exception
  if(callback == null) {
    throw new Error("no callback function provided");
  }

  // Get a logger for MongoClient
  var logger = Logger('MongoClient', options);

  // Did we pass in a Server/ReplSet/Mongos
  if (url instanceof Server
    || url instanceof ReplSet
    || url instanceof Mongos) {

    //authenticate(client, options.user, options.password, options, function(err, success) {
    return url.connect(options, connectHandler(self, options, function(err, topology) {
      if(err) return connectCallback(err, topology);
      if(options.user || options.password || options.authMechanism) {
        // console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% 0")
        // console.log("options.user = " + options.user)
        // console.log("options.password = " + options.password)
        return authenticate(self, options.user, options.password, options, function(err, success) {
        // console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% 1")
        // console.dir(err)
          if(err) return connectCallback(err, topology);
          connectCallback(err, topology);
        })
      }

      connectCallback(err, topology);
    }));
  }

  // Parse the string
  var object = parse(url, options);
  var _finalOptions = createUnifiedOptions({}, object);
  _finalOptions = mergeOptions(_finalOptions, object, false);
  _finalOptions = createUnifiedOptions(_finalOptions, options);

  // Check if we have connection and socket timeout set
  if(_finalOptions.socketTimeoutMS == null) _finalOptions.socketTimeoutMS = 360000;
  if(_finalOptions.connectTimeoutMS == null) _finalOptions.connectTimeoutMS = 30000;

  if (_finalOptions.db_options && _finalOptions.db_options.auth) {
    delete _finalOptions.db_options.auth;
  }

  // Store the merged options object
  self.s.options = _finalOptions;

  // Failure modes
  if(object.servers.length == 0) {
    throw new Error("connection string must contain at least one seed host");
  }

  function connectCallback(err, topology) {
    if(err && err.message == 'no mongos proxies found in seed list') {
      if(logger.isWarn()) {
        logger.warn(f('seed list contains no mongos proxies, replicaset connections requires the parameter replicaSet to be supplied in the URI or options object, mongodb://server:port/db?replicaSet=name'));
      }

      // Return a more specific error message for MongoClient.connect
      return callback(new MongoError('seed list contains no mongos proxies, replicaset connections requires the parameter replicaSet to be supplied in the URI or options object, mongodb://server:port/db?replicaSet=name'));
    }

    // Return the error and db instance
    callback(err, topology);
  }

  // Do we have a replicaset then skip discovery and go straight to connectivity
  if(_finalOptions.replicaSet || _finalOptions.rs_name) {
    return createReplicaset(self, _finalOptions, connectHandler(self, _finalOptions, connectCallback));
  } else if(object.servers.length > 1) {
    return createMongos(self, _finalOptions, connectHandler(self, _finalOptions, connectCallback));
  } else {
    return createServer(self, _finalOptions, connectHandler(self, _finalOptions, connectCallback));
  }
}

module.exports = MongoClient
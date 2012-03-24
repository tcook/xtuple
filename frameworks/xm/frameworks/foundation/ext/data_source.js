// ==========================================================================
// Project:   xTuple Postbooks - Business Management System Framework
// Copyright: ©2011 OpenMFG LLC, d/b/a xTuple
// ==========================================================================
/*globals XM */

sc_require('ext/request');

/** @class
*/
XM.DataSource = SC.DataSource.extend(XM.Logging, 
  /** @scope XM.DataSource.prototype */ {

  //............................................
  // PROPERTIES
  //

  /**
    @NodeHackHere

    @type String
  */
  URL: SC.isNode ? 'http://localhost:4020/datasource/data' : '/datasource/data',

  /**
    Logging for this object?
  */
  logLocal: NO,

  //............................................
  // METHODS
  //
  
  /**
    To ensure that requests won't be sent until after a session
    is acquired, callbacks that issue the request are registered
    until the session is available. If no session exists they are
    queued. When a session becomes available the queue is
    flushed and any new requests are fired immediately.

    @param {Function} callback The method to fire when the session
      is available.
    @param {Object} [context] The context in which to execute
      the callback.
    @param {...} [arguments] Any additional arguments are supplied
      to the callback method.
  */
  ready: function(callback, context) {
    var args = Array.prototype.slice.call(arguments),
        args = args.length > 2 ? args.slice(2) : [], 
        context = context ? context : null, callbacks;
    if(this.get('isReady')) {
      this.log("ready => flushing request immediately");
      callback.apply(context, args);
      return YES;
    }
    this.log("ready => queueing a request (%@)".fmt(callback.name || 'anonymous'));
    if(!this._onreadycallbacks) callbacks = this._onreadycallbacks = [];
    else callbacks = this._onreadycallbacks;
    callbacks.push({ callback: callback, context: context, args: args });
    return YES;
  },
   
  /**
    Issues a request to the node datasource to acquire an active
    session. 

    @todo Currently only uses hard-coded admin/admin user unless
      username/password are arbitrarily handed to it. This is not
      the end-design goal but for development only.
  */
  getSession: function(username, password) {
    if(!SC.none(this.session)) return;
    this.log("getSession => requesting a session");
    if(SC.none(username)) username = 'admin';
    if(SC.none(password)) password = 'admin';
    XM.Request
      .postUrl(this.URL)
      .header({ 'Accept': 'application/json' })
      .notify(this, 'didGetSession').json()
      .send({ 
        requestType: 'requestSession',
        userName: username,
        password: password
      });
  },

  /**
    Dispatch a function request to the node datasource.

    @param {SC.Store} store Reference to store for the dispatch.
    @param {XM.Dispatch} dispatch The dispatch object to send to
      the node datasource.
  */
  dispatch: function(store, dispatch) {
    return this.ready(this._dispatch, this, store, dispatch);
  },

  /**
    Fetch a collection of records from the node datasource based on
    query parameters and conditions.

    @param {SC.Store} store The store associated with the query.
    @param {SC.Query} query The query object to pass to the
      node datasource.
  */
  fetch: function(store, query) {
    return this.ready(this._fetch, this, store, query);
  },

  /**
    Retrieve an individual record from the node datasource.

    @param {SC.Store} store The store to be passed to the callback.
    @param {Number} storeKey The integer storeKey value for the record.
    @param {Number} [id] The numeric id for the record to be retrieved.
  */
  retrieveRecord: function(store, storeKey, id) {
    return this.ready(this._retrieveRecord, this, store, storeKey, id);
  },

  /**
    Commit a record to the node datasource.

    @param {SC.Store} store The store to commit from.
    @param {Number} storeKey The storeKey for the record to commit.
  */
  commitRecord: function(store, storeKey) {
    return this.ready(this._commitRecord, this, store, storeKey);
  },

  //............................................
  // CALLBACKS
  //

  /**
    Callback receives response for a session request. Sets the
    isReady flag to true on the datasource that in turn
    flushes any pending requests.

    @param {SC.Response} response The response from the request.
  */
  didGetSession: function(response) {
    if(SC.ok(response)) {
      this.log("didGetSession => session acquired");
      var body = response.get('body');
      this.set('session', body);
    } else { throw "Could not acquire session" }
    this.set('isReady', YES);
  },

  /**
    Callback receives resposne for a dispatch request.

    @param {SC.Response} response The response from the request.
    @param {SC.Store} store The store as passed in from the dispatcher.
    @param {XM.Dispatch} dispatch The original dispatch object.
  */
  didDispatch: function(response, store, dispatch) {
    var error, dataHash;
    if(SC.ok(response)) {
      if(response.get("body").error) {
        error = SC.Error.create({ 
          code: 'Error',
          label: 'Datasource Error',
          message: response.get("body").message
        });
        store.dataSourceDidErrorDispatch(dispatch, error);
      } else {
        result = JSON.parse(response.get("body").rows[0].dispatch);
        store.dataSourceDidDispatch(dispatch, result);
      }
    } 
  },

  /**
    Callback receives response for a fetch request.

    @param {SC.Response} response The response from the request.
    @param {SC.Store} store The store as passed from the fetch request.
    @param {SC.Query} query The original query object.
  */
  didFetch: function(response, store, query) {
    if(SC.ok(response)) {
      if(response.get("body").error ) {
        var error = SC.Error.create({ 
          code: 'Error',
          label: 'Datasource Error',
          message: response.get("body").message
        });
        store.dataSourceDidErrorQuery(query, error);
      } else {
        var results = JSON.parse(response.get("body").rows[0].fetch),
        recordType = query.get('recordType');
        results.forEach(function(dataHash) {
          store.pushRetrieve(recordType, dataHash.guid, dataHash);
        })
        store.dataSourceDidFetchQuery(query);
      }
    } 
  },
  
  /**
    Callback receives response for retrieveRecord request.

    @param {SC.Response} response The response from the request.
    @param {SC.Store} store The store as passed from the retrieveRecord
      request.
    @param {Number} storeKey The storeKey for the record to populate.
  */
  didRetrieveRecord: function(response, store, storeKey) {
    var error, dataHash;
    if(SC.ok(response)) {
      if(response.get("body").error) {
        error = SC.Error.create({ 
          code: 'Error',
          label: 'Datasource Error',
          message: response.get("body").message
        });
        store.dataSourceDidError(storeKey, error);
      } else {
        dataHash = JSON.parse(response.get("body").rows[0].retrieve_record);
        store.dataSourceDidComplete(storeKey, dataHash);
      }
    } 
  },
  
  /**
    Callback receives response for commitRecord request.

    @param {SC.Response} response The response from the request.
    @param {SC.Store} store The store as passed by the commitRecord request.
    @param {Number} storeKey The storeKey for the record that was committed.
  */
  didCommitRecord: function(response, store, storeKey) {
    var error, dataHash;
    if (SC.ok(response)) {
      if(response.get("body").error) {
        error = SC.Error.create({ 
          code: 'Error',
          label: 'Datasource Error',
          message: response.get("body").message
        });
        store.dataSourceDidError(storeKey, error);
      } else {
        store.peekStatus(storeKey) !== SC.Record.BUSY_DESTROYING ?
        store.dataSourceDidComplete(storeKey) :
        store.dataSourceDidDestroy(storeKey);
      }
    }
  },

  //............................................
  // PRIVATE METHODS
  //

  /** @private */
  _dispatch: function _dispatch(store, dispatch) {
    var payload = {};
    payload.requestType = 'dispatch';
    payload.className = dispatch.get('className');
    payload.functionName = dispatch.get('functionName');
    payload.parameters = dispatch.get('parameters');
    this.log("dispatch => payload: ", payload);
    XM.Request
      .postUrl(this.URL)
      .header({ 'Accept': 'application/json' }).json()
      .notify(this, 'didDispatch', store, dispatch)
      .send(payload);
  },

  /** @private */
  _fetch: function _fetch(store, query) {
    var payload = {}, qp = query.get('parameters'), params = {};
    
    // convert any any regular expressions to text
    for(var prop in qp)
      params[prop] = qp[prop].source === undefined ? qp[prop] : qp[prop].source;
    payload.requestType = 'fetch';
    payload.query = {};
    payload.query.recordType = query.get('recordType').prototype.className;
    payload.query.conditions = query.get('conditions');
    payload.query.parameters = params;
    payload.query.orderBy = query.get('orderBy');
    this.log("fetch => payload: ", payload);
    XM.Request
      .postUrl(this.URL)
      .header({'Accept': 'application/json'}).json()
      .notify(this, 'didFetch', store, query)
      .send(payload);
  },

  /** @private */
  _retrieveRecord: function _retrieveRecord(store, storeKey, id) {
    var recordType = store.recordTypeFor(storeKey).prototype.className, 
        payload = {};
    id = id ? id : store.materializeRecord(storeKey).get('id');
    payload.requestType = 'retrieveRecord';
    payload.recordType = recordType;
    payload.id = id;
    this.log("retrieveRecord => payload: ", payload);
    XM.Request
      .postUrl(this.URL)
      .header({ 'Accept': 'application/json' }).json()
      .notify(this, 'didRetrieveRecord', store, storeKey)
      .send(payload);
  },

  /** @private */
  _commitRecord: function _commitRecord(store, storeKey) {
    var recordType = store.recordTypeFor(storeKey).prototype.className, 
        payload = {},
        record = store.materializeRecord(storeKey);
    payload.requestType = 'commitRecord';
    payload.recordType = recordType;
    payload.dataHash = record.get('attributes');
    this.log("commitRecord => payload: ", payload);
    XM.Request
      .postUrl(this.URL)
      .header({ 'Accept': 'application/json' }).json()
      .notify(this, 'didCommitRecord', store, storeKey)
      .send(payload);
  },

  //............................................
  // OBSERVERS
  //

  /** @private
    When a session is acquired by the application the isReady flag
    becomes true. Any pending requests are flushed from the queue.

    @NodeHackHere
  */
  isReadyDidChange: function() {
    var ready = this.get('isReady');
    this.log("isReadyDidChange => datasource is %@%@".fmt(
      ready ? 'ready' : 'not ready', ready ? ', flushing queue' : ''));
    if(!ready) return;
    var callbacks = this._onreadycallbacks || [],
        i = 0, callback;
    for(; i<callbacks.length; ++i) {
      callback = callbacks[i];
      if(callback.callback && SC.typeOf(callback.callback) === SC.T_FUNCTION)
        callback.callback.apply(callback.context, callback.args);
    }
    if(SC.isNode) process.emit('sessionReady');
  }.observes('isReady')

});

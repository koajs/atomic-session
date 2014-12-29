
var wrap = require('mongodb-next').collection
var ObjectID = require('mongodb').ObjectID
var memo = require('memorizer')
var assert = require('assert')
var ms = require('ms')

module.exports = function (app, options) {
  assert(app.middleware, 'First argument must be the app.')

  options = options || {}

  // the cookie name
  var key = options.key || 'sid'

  /**
   * Usage:
   *
   *   var session = yield this.session()
   */

  memo(app.context, 'session', function () {
    return new Session(this)
  })

  /**
   * Wrap the collection in a `mongodb-next` instance.
   */

  Object.defineProperty(Session, 'collection', {
    get: function () {
      assert(this._collection, 'Collection not set!')
      return this._collection
    },
    set: function (collection) {
      this._rawCollection = collection
      this._collection = wrap(collection)
    }
  })
  // set the collection if already defined
  if (options.collection) Session.collection = options.collection

  /**
   * Create a TTL index for expirations.
   */

  Session.ensureIndex = function () {
    return Session.collection.ensureIndex({
      expires: 1
    }, {
      expireAfterSeconds: 0,
      background: true
    })
  }

  /**
   * Session constructor.
   */

  function Session(context) {
    this.context = context
    this.cookies = context.cookies
  }

  // cookie options
  var maxAge = options.maxage || options.maxAge || '14 days'
  if (typeof maxAge === 'string') maxAge = ms(maxAge)
  assert(typeof maxAge === 'number')

  Session.prototype.overwrite = true
  Session.prototype.httpOnly = true
  Session.prototype.signed = true // should be encrypted later
  Session.prototype.maxAge = maxAge

  /**
   * Grabs the session and populates `this`.
   */

  memo(Session.prototype, '_promise', function () {
    var sid = this.cookies.get(key, this)
    if (!/^[0-9a-f]{24}$/i.test(sid)) return this._create()

    var self = this
    return Session.collection.findOne(new ObjectID(sid))
    .then(function (session) {
      if (!session) return self._create()

      // set all the properties locally
      Object.keys(session).forEach(function (key) {
        self[key] = session[key]
      })

      return self
    })
  })

  /**
   * For `yield`ing.
   */

  Session.prototype.then = function (resolve, reject) {
    return this._promise.then(resolve, reject)
  }

  /**
   * .id is just a shorthand for ._id
   */

  Object.defineProperty(Session.prototype, 'id', {
    get: function () {
      return this._id
    }
  })

  /**
   * Destroy the current session.
   */

  Session.prototype.destroy = function () {
    return Promise.resolve(this._id || Session.collection.findOne(this._id).remove())
      .then(noop)
  }

  /**
   * Destroy the current session and create a new one.
   */

  Session.prototype.regenerate = function () {
    var context = this.context
    return this.destroy().then(function () {
      return context.session = new Session(context)
    })
  }

  /**
   * Update the expires age for the cookie as well as the session.
   */

  Session.prototype.touch = function () {
    assert(this._id, 'Session not yet created.')
    assertValidKey(key)
    var self = this
    this._setSession()
    return Session.collection.findOne(this._id)
      .set('expires', this.expires)
      .then(function () {
        return self
      })
  }

  /**
   * Set a value while also "touching" the session.
   */

  Session.prototype.set = function (key, value) {
    assert(this._id, 'Session not yet created.')
    assertValidKey(key)

    // special key types
    switch (key) {
      case 'maxAge':
        if (typeof value === 'string') value = ms(value)
        assert(typeof value === 'number')
        break
      case 'expires':
        if (typeof value === 'string') value = ms(value)
        if (typeof value === 'number') value = new Date(value)
        assert(value instanceof Date)
        break
    }

    if (key === 'expires') {
      this._setSession(value)
    } else {
      this._setSession()
      this.key = value
    }

    var self = this
    return Session.collection.findOne(this._id)
      .set('expires', this.expires)
      .set(key, value)
      .then(function () {
        return self
      })
  }

  /**
   * Unset a value.
   */

  Session.prototype.unset = function (key) {
    assert(this._id, 'Session not yet created.')
    assertValidKey(key)
    assert(key !== 'maxAge' && key !== 'expires', 'Invalid keys.')

    var self = this
    this._setSession()
    delete this[key]
    return Session.collection.findOne(this._id)
      .set('expires', this.expires)
      .unset(key)
      .then(function () {
        return self
      })
  }

  /**
   * Set the cookie expires as well as update this.expires.
   * You are expected to update .expires on the session as well.
   */

  Session.prototype._setSession = function (expires) {
    this.expires = expires || new Date(Date.now() + this.maxAge)
    this.cookies.set(key, this._id.toHexString(), this)
  }

  /**
   * Create a new session.
   */

  Session.prototype._create = function () {
    var self = this
    var session = {}
    this._id = session._id = new ObjectID()
    this.expires = session.expires = new Date(Date.now() + maxAge)
    this.created = session.created = new Date()
    this.maxAge = session.maxAge = maxAge // not necessary
    this.cookies.set(key, this._id.toHexString(), this)
    return Session.collection.insert(session).then(function () {
      self._loaded = true
      return self
    })
  }

  return Session

  function assertValidKey(key) {
    assert(typeof key === 'string')
    assert(!~key.indexOf('.'), 'Nested keys are not supported yet.')
    assert(key === 'maxAge' || key === 'expires' || !(key in Session.prototype), 'Invalid key: ' + key)
  }
}

function noop() {}

'use strict'

const wrap = require('mongodb-next').collection
const ObjectID = require('mongodb').ObjectID
const assert = require('assert')
const CSRF = require('csrf')
const ms = require('ms')

module.exports = function (app, options) {
  assert(app.middleware, 'First argument must be the app.')

  options = options || {}

  // CSRF options
  const csrf = CSRF(options)

  // the cookie name
  const key = options.key || 'sid'

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
    },
  })
  // set the collection if already defined
  if (options.collection) Session.collection = options.collection

  /**
   * Create a TTL index for expirations.
   */

  Session.ensureIndex = function () {
    return Session.collection.ensureIndex({
      expires: 1,
    }, {
      expireAfterSeconds: 0,
      background: true,
    })
  }

  /**
   * Usage:
   *
   *   const session = yield this.session()
   */

  app.context.session = function () {
    // session is current being queried
    if (this._sessionPromise) return this._sessionPromise
    // session already queried
    if (this._session) return Promise.resolve(this._session)
    // get the session
    const self = this
    return this._sessionPromise = Promise.resolve().then(function () {
      const session = self._session = new Session(self)
      const sid = session.cookies.get(key, session)
      if (!/^[0-9a-f]{24}$/i.test(sid)) return session._create()

      return Session.collection.findOne(new ObjectID(sid))
      .then(function (obj) {
        // non-existent session
        if (!obj) return session._create()

        // set all the properties locally
        Object.keys(obj).forEach(function (key) {
          session[key] = obj[key]
        })

        return session
      })
    }).then(function (session) {
      delete self._sessionPromise
      return session
    })
  }

  /**
   * Session constructor.
   */

  function Session(context) {
    this.context = context
    this.cookies = context.cookies
    this.update = this.update.bind(this)
  }

  /**
   * Get and set the `maxAge`.
   */

  Object.defineProperty(Session.prototype, 'maxAge', {
    get: function () {
      return this._maxAge
    },
    set: function (maxAge) {
      if (typeof maxAge === 'string') maxAge = ms(maxAge)
      assert(typeof maxAge === 'number')
      this._maxAge = maxAge
    },
  })

  /**
   * Cookie options.
   */

  Session.prototype.overwrite = true
  Session.prototype.httpOnly = true
  Session.prototype.signed = true // should be encrypted later
  Session.prototype.maxAge = options.maxage || options.maxAge || '14 days'

  /**
   * .id is just a shorthand for ._id
   */

  Object.defineProperty(Session.prototype, 'id', {
    get: function () {
      return this._id
    },
  })

  /**
   * Destroy the current session.
   *
   *   const session = yield this.session()
   *   yield session.destroy()
   *
   */

  Session.prototype.destroy = function () {
    this.cookies.set(key, '', this)
    delete this.context._session
    return Promise.resolve(this._id && Session.collection.findOne(this._id).remove())
      .then(noop)
  }

  /**
   * Destroy the current session and create a new one.
   *
   *   const session = yield this.session()
   *   session = yield session.regenerate()
   *
   */

  Session.prototype.regenerate = function () {
    const context = this.context
    return this.destroy().then(function () {
      const session = context._session = new Session(context)
      return session._create()
    })
  }

  /**
   * Update the expires age for the cookie as well as the session.
   *
   *   const session = yield this.session()
   *   yield session.touch()
   *
   */

  Session.prototype.touch = function () {
    this._setSession()
    return Session.collection.findOne(this._id)
      .set('maxAge', this.maxAge)
      .set('expires', this.expires)
      .new()
  }

  /**
   * Create a CSRF token.
   *
   *   const session = yield this.session()
   *   const csrf = session.createCSRF()
   *
   */

  Session.prototype.createCSRF = function () {
    assert(this.secret)
    return csrf.create(this.secret)
  }

  /**
   * Check whether a CSRF token is valid.
   *
   *  const session = yield this.session()
   *  session.assertCSRF(this.request.get('X-CSRF-Token'))
   *
   */

  Session.prototype.assertCSRF = function (val) {
    this.context.assert(csrf.verify(this.secret, val), 401, 'Invalid CSRF Token.')
  }

  /**
   * Command entry points.
   *
   *  const session = yield this.session()
   *  yield session.set('a', 'b').unset('c').push('d', 1)
   */

  const commands = [
    'addToSet',
    'pop',
    'pullAll',
    'pull',
    'pushAll',
    'push',
    'set',
    'inc',
    'unset',
    'rename',
  ]
  commands.forEach(function (command) {
    Session.prototype[command] = function () {
      const query = this.touch()
      return query[command].apply(query, arguments)
    }
  })

  /**
   * Update the session object with the results from an update.
   * Ideally, this would be automatic, but I haven't figured that out yet.
   *
   *   const session = yield this.session()
   *   yield session.set('a', 'b').then(session.update)
   *   assert(session.a === 'b')
   *
   */

  Session.prototype.update = function (session) {
    if (!session) return this

    const keys = Object.keys(this).filter(function (key) {
      // we have to manually ignore some keys
      switch (key) {
        case 'id':
        case 'context':
        case 'cookies':
        case '_maxAge':
        case 'update':
          return false
      }
      return true
    })

    const newkeys = Object.keys(session)
    newkeys.forEach(function (key) {
      this[key] = session[key]
      const i = keys.indexOf(key)
      if (~i) keys.splice(i, 1)
    }, this)

    // removed shift
    keys.forEach(function (key) {
      delete this[key]
    }, this)

    return this
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
    const self = this
    const session = {
      maxAge: this.maxAge,
    }
    this._id = session._id = new ObjectID()
    this.expires = session.expires = new Date(Date.now() + this.maxAge)
    this.created = session.created = new Date()
    this.cookies.set(key, this._id.toHexString(), this)
    return csrf.secret().then(function (secret) {
      self.secret = session.secret = secret
      return Session.collection.insert(session)
    }).then(function () {
      return self
    })
  }

  return Session
}

/* istanbul ignore next */
function noop() {}

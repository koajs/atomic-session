
var request = require('supertest')
var assert = require('assert')
var koa = require('koa')

var session = require('..').mongodb

var collection

before(function (done) {
  require('mongodb').MongoClient.connect('mongodb://localhost/koa-atomic-session', function (err, db) {
    if (err) throw err
    collection = db.collection('sessions')
    done()
  })
})

describe('Mongodb Atomic Session', function () {
  describe('when not accessed', function () {
    it('should not set cookies', function (done) {
      var app = App()

      request(app.listen())
      .get('/')
      .expect(404)
      .end(function (err, res) {
        assert.ifError(err)
        assert(!res.headers['set-cookie'])
        done()
      })
    })
  })

  describe('when accessed', function () {
    it('should set a cookie', function (done) {
      var app = App()

      app.use(function* () {
        var session = yield this.session()
        yield session.set('message', 'hello').then(session.update)
        assert.equal(session.message, 'hello')
        assert(session.maxAge)
        assert(session.expires)
        assert(session.id)
        this.status = 204
      })

      request(app.listen())
      .get('/')
      .expect('Set-Cookie', /[0-9a-f]{24}/i)
      .expect(204, done)
    })
  })

  describe('MongoDB Commands', function () {
    it('should unset stuff', function (done) {
      var app = App()

      app.use(function* () {
        var session = yield this.session()
        yield session.set('message', 'hello').then(session.update)
        assert.equal(session.message, 'hello')
        yield session.unset('message').then(session.update)
        assert(!('message' in session))
        assert(session.maxAge)
        assert(session.expires)
        assert(session.id)
        this.status = 204
      })

      request(app.listen())
      .get('/')
      .expect('Set-Cookie', /[0-9a-f]{24}/i)
      .expect(204, done)
    })
  })

  it('should regenerate sessions', function (done) {
    var app = App()

    app.use(function* () {
      var session = yield this.session()
      yield session.set('message', 'hello')
      var session2 = yield session.regenerate()
      assert(!session._id.equals(session2._id))
      assert(!session.message)
      this.status = 204
    })

    request(app.listen())
    .get('/')
    .expect('Set-Cookie', /[0-9a-f]{24}/i)
    .expect(204, done)
  })

  it('should support CSRF tokens', function (done) {
    var app = App()

    app.use(function* () {
      var session = yield this.session()
      var csrf = session.createCSRF()
      session.assertCSRF(csrf)
      this.status = 204
    })

    request(app.listen())
    .get('/')
    .expect('Set-Cookie', /[0-9a-f]{24}/i)
    .expect(204, done)
  })

  it('should grab sessions from the cookie', function (done) {
    var app = App()

    app.use(function* (next) {
      if (this.method !== 'POST') return yield next
      var session = yield this.session()
      yield session.set('message', 'hello')
      this.status = 204
    })

    app.use(function* (next) {
      var session = yield this.session()
      assert.equal(session.message, 'hello')
      assert(session.maxAge)
      assert(session.expires)
      assert(session.secret)
      this.status = 204
    })

    var server = app.listen()

    request(server)
    .post('/')
    .expect('Set-Cookie', /[0-9a-f]{24}/i)
    .expect(204, function (err, res) {
      assert.ifError(err)

      var cookie = res.headers['set-cookie'].join(';')

      request(server)
      .get('/')
      .set('cookie', cookie)
      .expect(204, done)
    })
  })
})

function App(options) {
  var app = koa()
  app.keys = ['a', 'b']
  var Session = session(app, options)
  Session.collection = collection
  Session.ensureIndex()
  return app
}

'use strict'

const request = require('supertest')
const assert = require('assert')
const koa = require('koa')

const session = require('..')

let collection

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
      let app = App()

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
      let app = App()

      app.use(function* () {
        let session = yield this.session()
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
      let app = App()

      app.use(function* () {
        let session = yield this.session()
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
    let app = App()

    app.use(function* () {
      let session = yield this.session()
      yield session.set('message', 'hello')
      let session2 = yield session.regenerate()
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
    let app = App()

    app.use(function* () {
      let session = yield this.session()
      let csrf = session.createCSRF()
      session.assertCSRF(csrf)
      this.status = 204
    })

    request(app.listen())
    .get('/')
    .expect('Set-Cookie', /[0-9a-f]{24}/i)
    .expect(204, done)
  })

  it('should grab sessions from the cookie', function (done) {
    let app = App()

    app.use(function* (next) {
      if (this.method !== 'POST') return yield next
      let session = yield this.session()
      yield session.set('message', 'hello')
      this.status = 204
    })

    app.use(function* (next) {
      let session = yield this.session()
      assert.equal(session.message, 'hello')
      assert(session.maxAge)
      assert(session.expires)
      assert(session.secret)
      this.status = 204
    })

    let server = app.listen()

    request(server)
    .post('/')
    .expect('Set-Cookie', /[0-9a-f]{24}/i)
    .expect(204, function (err, res) {
      assert.ifError(err)

      let cookie = res.headers['set-cookie'].join(';')

      request(server)
      .get('/')
      .set('cookie', cookie)
      .expect(204, done)
    })
  })
})

function App(options) {
  let app = koa()
  app.keys = ['a', 'b']
  let Session = session(app, options)
  Session.collection = collection
  Session.ensureIndex()
  return app
}

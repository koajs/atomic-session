
var request = require('supertest')
var assert = require('assert')
var koa = require('koa')

var session = require('..')

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
        var session = yield this.session
        yield session.set('message', 'hello')
        assert.equal(session.message, 'hello')
        this.status = 204
      })

      request(app.listen())
      .get('/')
      .expect('Set-Cookie', /[0-9a-f]{24}/i)
      .expect(204, function (err, res) {
        console.log(res.headers)
      })
    })
  })
})

function App(options) {
  var app = koa()
  app.keys = ['a', 'b']
  var Session = session(app, options)
  Session.collection = collection
  return app
}

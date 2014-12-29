
# atomic-session

[![NPM version][npm-image]][npm-url]
[![Build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]
[![Dependency Status][david-image]][david-url]
[![License][license-image]][license-url]
[![Downloads][downloads-image]][downloads-url]
[![Gittip][gittip-image]][gittip-url]

Atomic sessions for Koa.

- Currently uses MongoDB, but will support Redis soon.
- Atomic updates - don't butcher the entire session unless you want.
- Don't grab the session from the database unless necessary.

## Usage

```js
// create the app
var app = koa()

// attach the session to the app
var MongoDBSession = require('koa-atomic-session')(app, {
  maxAge: '1 month'
})

// asynchronously attach the collection
// you should not start the app until you do this
require('mongodb').MongoClient.connect('mongodb://localhost', function (err, db) {
  if (err) throw err
  MongoDBSession.collection = db.collection('sessions')
  // ensure indexes every time!
  MongoDBSession.ensureIndex()
})

// use it in your app
app.use(function* (next) {
  var session = yield this.session

  console.log(session.user_id)
  yield session.unset('user_id')
  yield session.set('user_id', new ObjectID())
})
```

## API

### var <Database>Session = Session(app, [options])

Options:

- `key`
- `maxAge`

### this.session.then( session => ))

### session.set(key, value).then( session => )

### session.unset(key, value).then( session => )

### session.touch.then( session => )

### session.destroy.then( => )

### session.regenerate.then( session =>

## MongoDB API

### MongoDBSession.ensureIndex().then( => )

### MongoDBSession.collection = <Collection>

[gitter-image]: https://badges.gitter.im/koa-atomic-session/atomic-session.png
[gitter-url]: https://gitter.im/koa-atomic-session/atomic-session
[npm-image]: https://img.shields.io/npm/v/atomic-session.svg?style=flat-square
[npm-url]: https://npmjs.org/package/atomic-session
[github-tag]: http://img.shields.io/github/tag/koa-atomic-session/atomic-session.svg?style=flat-square
[github-url]: https://github.com/koa-atomic-session/atomic-session/tags
[travis-image]: https://img.shields.io/travis/koa-atomic-session/atomic-session.svg?style=flat-square
[travis-url]: https://travis-ci.org/koa-atomic-session/atomic-session
[coveralls-image]: https://img.shields.io/coveralls/koa-atomic-session/atomic-session.svg?style=flat-square
[coveralls-url]: https://coveralls.io/r/koa-atomic-session/atomic-session
[david-image]: http://img.shields.io/david/koa-atomic-session/atomic-session.svg?style=flat-square
[david-url]: https://david-dm.org/koa-atomic-session/atomic-session
[license-image]: http://img.shields.io/npm/l/atomic-session.svg?style=flat-square
[license-url]: LICENSE
[downloads-image]: http://img.shields.io/npm/dm/atomic-session.svg?style=flat-square
[downloads-url]: https://npmjs.org/package/atomic-session
[gittip-image]: https://img.shields.io/gratipay/jonathanong.svg?style=flat-square
[gittip-url]: https://gratipay.com/jonathanong/

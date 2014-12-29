
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
- Atomic updates - don't butcher the entire session.
- Don't grab the session from the database unless necessary.
- Better error handling.
- Includes CSRF token handling

## Usage

```js
// create the app
var app = koa()

// attach the session to the app
var MongoDBSession = require('koa-atomic-session').mongodb(app, {
  maxAge: '1 month'
})

// asynchronously attach the collection
// you should not start the app until you do this
require('mongodb').MongoClient.connect('mongodb://localhost', function (err, db) {
  if (err) throw err
  // set the collection
  MongoDBSession.collection = db.collection('sessions')
  // ensure indexes every time!
  MongoDBSession.ensureIndex()
})

// use it in your app
app.use(function* (next) {
  var session = yield this.session()

  yield session.unset('user_id')
  yield session.set('user_id', new ObjectID()).then(session.update)
})
```

## API

### var <Database>Session = Session(app, [options])

Options:

- `key` - cookie key
- `maxAge` - default to 14 days

### this.session().then( session => )

Grab the session from the database asynchronously.

### session.touch().then( session => )

Updates the new `expires` time.

### session\[command\](arguments...).then( => )

Change properties of the session.
See database-specific options below.

### session.update().then( => )

Updates all the properties of the `session` object after running a command.
Should always be added to a `.then()`.

```js
yield session.set('message', 'hello')
  .then(session.update)
assert.equal(session.message, 'hello')
```

### session.destroy.then( => )

Destroys the session without creating a new one.

### session.regenerate.then( session => )

Creates a brand new session.

### var csrf = session.createCSRF()

Create a CSRF token.

### session.assertCSRF(csrf)

Assert that a CSRF token is valid.

## MongoDB API

### MongoDBSession.ensureIndex().then( => )

Adds indexes on the `expires` property so that expires are automatically set.

### MongoDBSession.collection = <Collection>

Set the collection asynchronously.
You should set this collection before starting your app.

### session\[command\](arguments...).then( => )

Supports most MongoDB properties.
This uses [mongodb-next](https://www.npmjs.com/package/mongodb-next) internally.
Some commands that are supported are:

- `.set(key, value)``
- `.unset(key)`
- `.rename(name, newName)`
- `.pull()`
- `.addToSet()`

[gitter-image]: https://badges.gitter.im/koajs/atomic-session.png
[gitter-url]: https://gitter.im/koajs/atomic-session
[npm-image]: https://img.shields.io/npm/v/koa-atomic-session.svg?style=flat-square
[npm-url]: https://npmjs.org/package/koa-atomic-session
[github-tag]: http://img.shields.io/github/tag/koajs/atomic-session.svg?style=flat-square
[github-url]: https://github.com/koajs/atomic-session/tags
[travis-image]: https://img.shields.io/travis/koajs/atomic-session.svg?style=flat-square
[travis-url]: https://travis-ci.org/koajs/atomic-session
[coveralls-image]: https://img.shields.io/coveralls/koajs/atomic-session.svg?style=flat-square
[coveralls-url]: https://coveralls.io/r/koajs/atomic-session
[david-image]: http://img.shields.io/david/koajs/atomic-session.svg?style=flat-square
[david-url]: https://david-dm.org/koajs/atomic-session
[license-image]: http://img.shields.io/npm/l/koa-atomic-session.svg?style=flat-square
[license-url]: LICENSE
[downloads-image]: http://img.shields.io/npm/dm/koa-atomic-session.svg?style=flat-square
[downloads-url]: https://npmjs.org/package/koa-atomic-session
[gittip-image]: https://img.shields.io/gratipay/jonathanong.svg?style=flat-square
[gittip-url]: https://gratipay.com/jonathanong/

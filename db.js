'use strict';

var _ = require('underscore');
var assert = require('assert');
var format = require('util').format;
var level = require('level');

var toFixedWidthString = require('./util').toFixedWidthString;

module.exports = Db;
function Db(dbpath_or_dbobj, cb) {
  if (!(this instanceof Db)) return new Db(dbpath_or_dbobj, cb);
  var self = this;

  if (_.isString(dbpath_or_dbobj)) {
    // a path to the LevelDB was passed in
    self._db = level(dbpath_or_dbobj);
  } else {
    // a level object was passed in
    self._db = dbpath_or_dbobj;
  }
  self._db.on('error', cb);

  // cb receives (err, pubkey_buf|null)
  // if err.type is 'NotFoundError', then there is no public key for this nick
  function getPublicKey(nick, cb) {
    if (nick.indexOf('::') !== -1) return cb(new Error('nick contains "::"'));

    var db_key = format('nick::%s::pubkey', nick);
    self._db.get(db_key, function(err, pubkey_b64) {
      if (err) return cb(err);
      var pubkey_buf = new Buffer(pubkey_b64, 'base64');
      assert(pubkey_buf.length === 32); // only valid keys allowed in DB
      return cb(null, pubkey_buf);
    });
  }


  // returns the next work ID for the given nick and increments it in the DB
  // callback receives (err, next_work_id)
  function nextWorkId(nick, cb) {
    var db_key = format('nick::%s::next_id', nick);
    self._db.get(db_key, function(err, next_work_id) {
      if (err && err.status !== 404) return cb(err);
      if (err && err.status === 404) {
        next_work_id = 0;
      } else {
        next_work_id = parseInt(next_work_id, 10);
      }
      self._db.put(db_key, next_work_id + 1, function(err) {
        if (err) return cb(err);

        return cb(null, next_work_id);
      });
    });
  }


  self.getPublicKey = getPublicKey;
  self.nextWorkId = nextWorkId;
  return self;
}

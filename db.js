'use strict';

var _ = require('underscore');
var assert = require('assert');
var format = require('util').format;
var level = require('level');
var dict = require('dict');

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
    if (~nick.indexOf('::')) return cb(new TypeError('nick contains "::"'));

    var db_key = format('nick::%s::pubkey', nick);
    self._db.get(db_key, function(err, pubkey_b64) {
      if (err) return cb(err);
      var pubkey_buf = new Buffer(pubkey_b64, 'base64');
      if (pubkey_buf.length !== 32) return cb(new TypeError('not a valid pubkey'));
      return cb(null, pubkey_buf);
    });
  }


  // set pubkey for this nick
  // cb receives (err)
  function setPublicKey(nick, pubkey, cb) {
    if (~nick.indexOf('::')) return cb(new TypeError('nick contains "::"'));

    // verify that it is valid
    var pubkey_buf = new Buffer(pubkey, 'base64');
    if (pubkey_buf.length !== 32) return cb(new TypeError('not a valid pubkey'));

    var db_key = format('nick::%s::pubkey', nick);
    self._db.put(db_key, pubkey, cb);
  }


  // returns the next work ID for the given nick and increments it in the DB
  // call either as (nick, cb) or (nick, count, cb).
  // `count` specifies number of work IDs to allocate (default is 1)
  // callback receives (err, next_work_id)
  function nextWorkId(nick, count_or_cb, vararg_cb) {
    if (~nick.indexOf('::')) return cb(new TypeError('nick contains "::"'));

    var count = (arguments.length > 2) ? count_or_cb : 1;
    var cb = arguments[arguments.length-1];
    assert(_.isNumber(count));
    assert(count >= 1);
    var db_key = format('nick::%s::next_id', nick);
    self._db.get(db_key, function(err, next_work_id) {
      if (err && err.status !== 404) return cb(err);
      if (err && err.status === 404) {
        next_work_id = 0;
      } else {
        next_work_id = parseInt(next_work_id, 10);
      }
      self._db.put(db_key, next_work_id + count, function(err) {
        if (err) return cb(err);

        return cb(null, next_work_id);
      });
    });
  }


  // get array of all {key,value} pairs where the key has the given prefix.
  // callback receives (err, items).
  function getItemsByPrefix(prefix, cb) {
    assert(_.isString(prefix));
    var s = db.createReadStream({start:prefix});
    var items = [];
    s.on('data',function(item){
      if (item.key.substr(0,prefix.length)!==prefix){
        s.destroy();
        return;
      }
      items.push(item);
    });
    s.once('close',function(){
      cb(null, items);
    });
  }


  // callback receives (err, state), where state
  // is {r_ufos, f_ufos, b1_ufos, last_b1, clients}
  function loadState(cb) {
    // TODO: r_ufos, f_ufos, b1_ufos, last_b1
    var clients = dict();
    var s = db.createReadStream();
    s.on('data', /*XXX*/);
    //XXX
  }


  /*
  // callback receives (err, client_obj)
  function getClientObj(nick, cb) {
    //XXX
  }
  */


  // callback receives (err)
  function setClientObj(nick, client_obj, cb) {
    //XXX
  }


  self.getPublicKey = getPublicKey;
  self.setPublicKey = setPublicKey;
  self.nextWorkId = nextWorkId;
  self.getItemsByPrefix = getItemsByPrefix;
  self.loadState = loadState;
  //self.getClientObj = getClientObj;
  self.setClientObj = setClientObj;
  return self;
}

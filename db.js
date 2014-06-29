'use strict';

var _ = require('underscore');
var assert = require('assert');
var format = require('util').format;
var level = require('level');
var dict = require('dict');
var bigint = require('bigint');

var ufos = require('./ufos');
var cfg = require('./cfg');

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
    if (!_.isString(nick)) return cb(new TypeError('nick is not a string'));
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
    if (!_.isString(nick)) return cb(new TypeError('nick is not a string'));
    if (~nick.indexOf('::')) return cb(new TypeError('nick contains "::"'));
    if (!_.isString(pubkey)) return cb(new TypeError('pubkey must be a base64 string'));

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
    if (!_.isString(nick)) return cb(new TypeError('nick is not a string'));
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
    var s = self._db.createReadStream({start:prefix});
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
  // is {r_ufos, f_ufos, b1_ufos, clients}
  function loadState(cb) {
    var r_ufos = [];
    var f_ufos = [];
    var b1_ufos = [];
    var clients = dict();
    var s = self._db.createReadStream();
    s.on('data', function(d) {
      var k = d.key;
      var v = d.value;
      var m = k.match(/^ufo::(\d+)::(.*)$/);
      if (m) {
        var ufoIndex = parseInt(m[1], 10);
        var leaf = m[2];
        var u = ufos.get(ufoIndex);

        // ensure that ufoIndex is in bounds for all parallel arrays
        while (r_ufos.length <= ufoIndex) {
          r_ufos.push(null);
          f_ufos.push([]);
          b1_ufos.push(cfg.START_B1);
        }

        if (leaf === 'facs') {
          var facs_str = JSON.parse(v);
          var facs = facs_str.map(function(s) {
            return bigint(s);
          });
          f_ufos[ufoIndex] = facs;

          // divide out and possibly inactivate UFO
          var d = facs.length ? facs.reduce(function(x,y){return x.mul(y)}) : bigint(1);
          var r = u.div(d);
          assert(r.mul(d).eq(u)); // must be divisible

          if (r.probPrime()) {
            r_ufos[ufoIndex] = null;  // prime
          } else if (r.bitLength() < cfg.MIN_BIT_LENGTH) {
            r_ufos[ufoIndex] = null;  // too small
          } else {
            r_ufos[ufoIndex] = r;
          }

        } else if (leaf === 'last_B1') {
          b1_ufos[ufoIndex] = parseInt(v, 10);
        } else {
          assert(false, 'unsupported key "%s"', k);
        }
      }

      m = k.match(/^nick::([^:]+)::(.*)$/);
      assert(m, 'only "nick" and "ufo" supported');
      var nick = m[1];
      leaf = m[2];
      var updated = false;

      var default_client_obj = {status: null, pending_work: []};   // see app.js
      if (leaf === 'client_obj') {
        var client_obj = JSON.parse(v);
        if (clients.has(nick)) {
          console.log('WARNING: nick "%s": overwriting old client_obj of %j with %j',
                      nick,
                      clients.get(nick),
                      client_obj);
        }
        clients.set(nick, client_obj);
      } else if (leaf === 'pubkey' || leaf === 'next_id') {
        if (!clients.has(nick)) {
          clients.set(nick, default_client_obj);
          updated = true;
        }
      } else {
        assert(false, 'unsupported key "%s"', k);
      }

      if (updated) {
        // fire-and-forget save to DB
        setClientObj(nick, clients.get(nick), function(err){
          if (err) {
            console.log('ERROR while saving client_obj of "%s": %s', nick, err.message||err);
          }
        });
      }
    });       // on 'data'

    s.once('close', function(){

      // ensure that we have enough active UFOs
      // TODO: can we have too many?
      var active_count = r_ufos.filter(function(r){return r !== null}).length;
      var limit = r_ufos.length + cfg.ACTIVE_UFOS - active_count;
      for (var i = r_ufos.length; i < limit; i++) {
        r_ufos.push(ufos.get(i));
        f_ufos.push([]);
        b1_ufos.push(cfg.START_B1);
      }

      cb(null, {
        clients: clients,
        r_ufos: r_ufos,
        f_ufos: f_ufos,
        b1_ufos: b1_ufos,
      });
    });
  }           // loadState


  // callback receives (err, client_obj)
  function getClientObj(nick, cb) {
    var k = format('nick::%s::client_obj', nick);
    self._db.get(k, function(err, v) {
      if (err) return cb(err);

      cb(null, JSON.parse(v));
    });
  }


  // callback receives (err)
  function setClientObj(nick, client_obj, cb) {
    var s = JSON.stringify(client_obj);
    var k = format('nick::%s::client_obj', nick);
    self._db.put(k, s, function(err) {
      cb(err);
    });
  }


  self.getPublicKey = getPublicKey;
  self.setPublicKey = setPublicKey;
  self.nextWorkId = nextWorkId;
  self.getItemsByPrefix = getItemsByPrefix;
  self.loadState = loadState;
  self.getClientObj = getClientObj;
  self.setClientObj = setClientObj;
  return self;
}

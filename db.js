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

  // call this prior to sending work to the client
  // callback receives (err, work ID)
  function prepareWork(nick, work, cb) {
    //XXX
  }

  // ensure that a factor is in the DB
  // uses synchronization to avoid race conditions
  // callback receives (err, fac_index, already_present)
  self._ensureFactor_in_progress = false; // in progress?
  self._waiting_ensureFactor = []; // array of functions to be called after completion
  function ensureFactor(ufoIndex, factor, cb) {
    //XXX
  }

  //XXX
  function getFactorByIndex(ufoIndex, fac_index, cb) {
    var f = function() {
      //
    };
    if (self._ensureFactor_in_progress) {
      self._waiting_ensureFactor.push(f);
    } else {
      f();
    }
  }

  self.getPublicKey = getPublicKey;
  self.prepareWork = prepareWork;
  self.ensureFactor = ensureFactor;
  self.getFactorByIndex = getFactorByIndex;
  return self;
}

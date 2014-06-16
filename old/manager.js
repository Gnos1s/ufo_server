'use strict';

var bigint = require('bigint');

module.exports = Manager;
function Manager(db) {
  if (!(this instanceof Manager)) return new Manager(db);
  var self = this;

  // call with (nick, cb) or (cb)
  // if called with nick, give test work if a factor has been found in last hour
  // callback receives (err, {ufoIndex, B1, sigma})
  function nextWork(nick_or_cb, vararg_cb) {
    var nick = (arguments.length > 1) ? nick_or_cb : null;
    var cb = arguments[arguments.length - 1];
    //XXX
  }

  // if necessary, supply test work
  // callback receives (err, null|{ufoIndex, B1, sigma})
  function getTestWork(nick, cb) {
    //XXX
  }

  self.nextWork = nextWork;
  return self;
}

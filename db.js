'use strict';

var level = require('level');

module.exports = Db;
function Db(dbpath_or_dbobj) {
  if (!(this instanceof Db)) return new Db(dbpath_or_dbobj);
  var self = this;
  //XXX

  return self;
}

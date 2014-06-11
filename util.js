'use strict';

var _ = require('underscore');
var assert = require('assert');
var format = require('util').format;


var WIDTH = 15;

exports.toFixedWidthString = function toFixedWidthString(n) {
  assert(_.isNumber(n) && n >= 0);

  var s = format('%d', n);
  while (s.length < WIDTH) s = '0' + s;

  return s;
};

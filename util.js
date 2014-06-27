'use strict';

var _ = require('underscore');
var crypto = require('crypto');
var assert = require('assert');
var format = require('util').format;


var WIDTH = 15;

exports.toFixedWidthString = function toFixedWidthString(n) {
  assert(_.isNumber(n) && n >= 0);

  var s = format('%d', n);
  while (s.length < WIDTH) s = '0' + s;

  return s;
};


var bits = function(n){return Math.ceil(Math.log(n+1)/Math.log(2))};

// TODO: cleanup this horrible, inefficient code
exports.randInt = function randInt(low, high){
  assert(low < 1e15)
  assert(high < 1e15)
  var range = high - low
  assert(low > -1e15)
  assert(high > -1e15)
  assert(range >= 0)
  if (range === 0) return low;
  var q = range;
  var bytes = 1;
  while (q >= 0x100) {
    q /= 0x100;
    bytes++;
  }
  var mask = (1<<bits(range))-1;
  while (true) {
    var b = crypto.randomBytes(bytes)
    var n = 0;
    for (var i = 0; i < b.length; i++) {
      n = 0x100*n + b[i];
    }
    n &= mask;
    if (n <= range) break;
  }
  var result = n + low;
  assert(result <= high);
  return result;
};

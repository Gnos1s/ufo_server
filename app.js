'use strict';

var fs = require('fs');
var assert = require('assert');
var format = require('util').format;
var _ = require('underscore');
var sodium = require('sodium');
var bigint = require('bigint');
var restify = require('restify');

var DB_PATH = 'state.leveldb';
var Db = require('./db');
var db = Db(DB_PATH, function(e) {
  console.error('ERROR opening database "%s": %s', DB_PATH, e.stack || e);
  process.exit(1);
});

var MAX_WORK_TO_GET = 50000;
var factor_regexp = RegExp('^1[0-9]{0,580}$'); // decimal digits in the largest factor of a 3840 bit number

var secret = new Buffer(fs.readFileSync('server.sec', 'utf8'), 'base64');

var sodium_msg = require('./sodium_msg')(secret);
var fromClient = sodium_msg.fromClient;
var toClient = sodium_msg.toClient;

var app = restify.createServer();
app.use(restify.jsonBodyParser());


function isInteger(x) {
  return _.isFinite(x) && (x - Math.floor(x)) === 0;
}

// inclusive
function inRange(x, low, high) {
  if (!isInteger(x)) return false;
  if (x < low) return false;
  if (arguments.length > 2 && x > high) return false;
  return true;
}


// if reply is a string, it's an error explaining the validation failure
// otherwise, it's okay
function validate(dreq) {
  var sanitized = {};

  if (!_.isObject(dreq)) return 'not an object';

  var work_to_get = dreq.get;
  if (!inRange(work_to_get, 1, MAX_WORK_TO_GET)) {
    return format('invalid work to get: %j', work_to_get);
  }
  sanitized.get = work_to_get;

  var results = dreq.results;
  if (!_.isArray(results)) return '.results is not an array';
  var fail = '';
  results.forEach(function(old_r, i){
    var r = _.pick(old_r, 'id', 'found', 'ret');
    results[i] = r;
    if (!inRange(r.id, 0)) {
      fail += format('.results[%s].id is invalid: %j; ', i, r.id);
      return;
    }
    if (r.found && (!_.isString(r.found) || !factor_regexp.test(r.found))) {
      fail += format('.results[%s].found is invalid: %j; ', i, r.found);
      return;
    }
    if (!inRange(r.ret, 0, 255)) {
      fail += format('.results[%s].ret is invalid: %j; ', i, r.ret);
      return;
    }
  });
  if (fail) return fail;
  sanitized.results = results;

  var pending = dreq.pending;
  if (!_.isArray(pending)) return '.pending is not an array';
  pending.forEach(function(p_id, i){
    if (!inRange(p_id, 0)) {
      fail += format('.pending[%s] is invalid: %j; ', i, p_id);
    }
  });
  if (fail) return fail;
  sanitized.pending = pending;

  var f = dreq.f;
  if (!_.isArray(f)) return '.f is not an array';
  f.forEach(function(f_count, i){
    if (!inRange(f_count, 0)) {
      fail += format('.f[%s] is invalid: %j; ', i, f_count);
    }
  });
  if (fail) return fail;
  sanitized.f = f;

  return sanitized;
}


app.post('/getwork', function(req,res){
  var log = function(/*arguments*/) {
    var s = format.apply(null, arguments);
    console.log('%s %s: %s', (new Date).toISOString(), req.socket.remoteAddress, s);
  }
  if (!req.is('application/json')) return res.send(400);
  if (!_.isObject(req.body)) return res.send(400);
  var nick = req.body.nick;
  db.getPublicKey(nick, function(err, client_pubkey) {
    if (err) {
      log('error getting pubkey for nick "%s": %s', nick, err.message || err);
      return res.send(400);
    }
    var dreq = fromClient(req.body.m, client_pubkey);

    log('FROM nick "%s": /getwork request DECRYPTED %j', nick, dreq); //DEBUG

    if (dreq === undefined) {
      log('Could not decrypt');
      return res.send(400);
    }
    dreq = validate(dreq);
    if (_.isString(dreq)) {
      log('validate fail: %s', dreq);
      return res.send(400);
    }

    var work_to_get = dreq.get;
    db.nextWorkId(nick, work_to_get, function(err, next_work_id) {
      if (err) {
        log('DB error nextWorkId! %s', err.message || err);
        res.send(500);
        process.exit(1);
      }

      var msg = {work:[]};  //XXX
      log('SENDING %j', msg); //DEBUG
      res.send({m:toClient(msg, client_pubkey)});
    });
  });
});


app.on('uncaughtException', function (req, res, route, e) {
  console.log('%s %s: ERR: %s', (new Date).toISOString(),
              req.socket.remoteAddress,
              e.message || e);
  res.send(500);
});


var port = process.env.PORT || 8000;
app.listen(port, function() {
  console.log("Server listening on port %d...", port);
});

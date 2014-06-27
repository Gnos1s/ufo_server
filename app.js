'use strict';

var fs = require('fs');
var assert = require('assert');
var crypto = require('crypto');
var format = require('util').format;
var _ = require('underscore');
var sodium = require('sodium');
var bigint = require('bigint');
var restify = require('restify');
var bops = require('bops');
var dict = require('dict');

var ufos = require('./ufos');
var nextB1 = require('./b1_ainc');  // given the last B1 tried, return the next B1
var randInt = require('./util').randInt;

var DB_PATH = 'state.leveldb';
var Db = require('./db');
var db = Db(DB_PATH, function(e) {
  console.error('ERROR opening database "%s": %s', DB_PATH, e.stack || e);
  process.exit(1);
});

var START_B1 = 100000;
var MAX_WORK_TO_GET = 50000;
var MIN_BIT_LENGTH = 3456;      // 3456 == 3840 * 0.90
var factor_regexp = RegExp('^[0-9]{1,580}$'); // decimal digits in the largest factor of a composite
                                              // 3840-bit number not greater than its square root

var secret = new Buffer(fs.readFileSync('server.sec', 'utf8'), 'base64');

var sodium_msg = require('./sodium_msg')(secret);
var fromClient = sodium_msg.fromClient;
var toClient = sodium_msg.toClient;

function randomSigma() {
  var b = crypto.randomBytes(4);
  return bops.readUInt32LE(b, 0);
}


/********** state *****************/
// the following are parallel arrays, indexed by ufoIndex
var r_ufos = [];          // array of reduced UFO candidates (as bigints); null if not active
var f_ufos = [];          // array of arrays of known factors (as bigints) of UFO candidates
var b1_ufos = [];         // array of B1 bounds (integers)
var last_b1 = [];         // array of dict mapping nick to last B1 finished by that nick; storing
                          //   this info enables us to rollback if a user sends fake results

var clients = dict();     // maps nick to object; don't take security risk of using JS objects
// each object:
// {
//  pending_work: [
//    {
//      id: <integer>,
//      ufo: <integer>,         // ufoIndex
//      B1: <integer>,
//      sigma: <integer>
//    }, ...
//  ]
// }



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
    if (!r.found) r.found = null;
    if (!(inRange(r.ret, 0, 255) || (_.isString(r.ret) && r.ret.length < 20))) {
      fail += format('.results[%s].ret is invalid: %j; ', i, r.ret);
      return;
    }
  });
  if (fail) return fail;
  sanitized.results = results;

  var work_to_get = dreq.get;
  var min_work_to_get = (results.length > 0) ? 0 : 1;
  if (!inRange(work_to_get, min_work_to_get, MAX_WORK_TO_GET)) {
    return format('invalid work to get: %j', work_to_get);
  }
  sanitized.get = work_to_get;

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


// TODO:
//  rate limiting! 3 per sec sounds good
//  limit max request size to 128KB
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

    var msg = {};

    var client_obj = clients.get(nick);
    if (!client_obj) {
      // TODO: load pending work from DB?
      client_obj = {pending_work: []};
      clients.set(nick, client_obj);
    }

    // process results
    var unknown_work_ids = [];
    dreq.results.forEach(function(wr){
      // TODO binary search
      var p_w;
      client_obj.pending_work.some(function(_p_w){
        if (wr.id === _p_w.id) {
          p_w = _p_w;
          return true;
        }
      });
      if (!p_w) {
        unknown_work_ids.push(wr.id);
        return;
      }
      // handle ret
      if (!_.contains([0, 2, 6, 8, 10, 14, 'SIGINT','SIGTERM'], wr.ret)) {
        // if not a "normal" code/signal, print
        log('unusual work result .ret: %j for ufoIndex %d, B1 %d', wr.ret, p_w.ufo, p_w.B1);
      }

      // if UFO candidate is no longer active, just ignore this work
      var ufoIndex = p_w.ufo;
      var u = r_ufos[ufoIndex];
      if (!u) {
        log('work result for UFO candidate %d that is no longer active', ufoIndex);
        // TODO: save found factors in case a user is banned and a rollback happens
        return;
      }

      // update B1 for this UFO
      b1_ufos[ufoIndex] = nextB1(b1_ufos[ufoIndex]);
      log('r_ufos[%d]: increasing B1 bound to %d', ufoIndex, b1_ufos[ufoIndex]);

      // save B1 to last_b1 for this UFO candidate, if larger than previous
      var l = last_b1[ufoIndex];
      assert(l);
      if (l.has(nick)) {
        var old_B1 = l.get(nick);
        if (p_w.B1 > old_B1) {
          l.set(nick, p_w.B1);
        }
      } else {
        l.set(nick, p_w.B1);
      }

      // handle found
      if (wr.found) {
        if (!factor_regexp.test(wr.found)) {
          log('misbehaving: found for r_ufos[%d] fails regexp', ufoIndex);
          return;
        }
        var found = bigint(wr.found);
        if (found.le(1) || found.ge(u)) {
          log('misbehaving: found for r_ufos[%d] not in range (1, u)', ufoIndex);
          return;
        }
        var d = u.div(found);
        if (!d.mul(found).eq(u)) {
          log('probably misbehaving: found not a factor of r_ufos[%d]', ufoIndex);
          return;
        }
        if (d.lt(found)) {
          log('found factor but misbehaving (gave larger factor!); continuing anyway');
          var tmp = d;
          d = found;
          found = tmp;
        }

        // update the state for this UFO candidate with the found factor
        foundFactor(nick, ufoIndex, found);
      }
      // TODO if this work ID is in a test work pair, take care of that
    });   // forEach dreq.results
    if (unknown_work_ids.length) log('unknown_work_ids: %j', unknown_work_ids);

    // process pending
    var new_pending = [];
    client_obj.pending_work.forEach(function(p_w){
      if (_.contains(dreq.pending, p_w.id)) {
        new_pending.push(p_w);
      } else {
        // TODO handle completed
      }
    });
    client_obj.pending_work = new_pending;

    // process f, produce f
    msg.f = [];
    f_ufos.forEach(function(facs, ufoIndex) {
      if (ufoIndex >= dreq.f.length) {
        msg.f.push({
          ufo: ufoIndex,
          off: 0,
          facs: facs.map(function(fac){ return fac.toString(); }),
        });
        return;
      }
      var off = dreq.f[ufoIndex];
      if (off > facs.length) {
        log('misbehaving or server problem: client has more factors (%d) than we do (%d)!',
            off,
            facs.length);
        off = facs.length;
      }
      var facs_to_send = [];
      for (var i = off; i < facs.length; i++) {
        facs_to_send.push(facs[i].toString());
      }
      if (facs_to_send.length) {
        msg.f.push({ufo: ufoIndex, off: off, facs: facs_to_send});
      }
    });

    var work_to_get = dreq.get;
    if (work_to_get == 0) {
      msg.work = [];
      return sendResponseMessage(msg);
    }
    db.nextWorkId(nick, work_to_get, function(err, next_work_id) {
      if (err) {
        log('DB error nextWorkId! %s', err.message || err);
        res.send(500);
        process.exit(1);
      }

      // produce work
      msg.work = nextWork(nick, next_work_id, work_to_get);

      return sendResponseMessage(msg);
    });

    function sendResponseMessage(msg) {
      log('SENDING %j', msg); //DEBUG
      res.send({m:toClient(msg, client_pubkey)});
    }
  });     // getPublicKey

  // updates r_ufos, f_ufos, b1_ufos, last_b1; may disable a UFO and activate the next
  // DO NOT CALL IF found IS NOT A FACTOR!
  function foundFactor(nick, ufoIndex, found) {
    var u = r_ufos[ufoIndex];
    assert(u);

    var f = f_ufos[ufoIndex];
    f.push(found);
    log('FOUND %s; f_ufos[%d] is %j', found.toString(), ufoIndex, f.map(function(x){return x.toString()}));
    u = u.div(found);
    r_ufos[ufoIndex] = u;

    if (u.probPrime()) {
      log('r_ufos[%d] is now prime! INACTIVATING', ufoIndex);
      replace();
    } else if (u.bitLength() < MIN_BIT_LENGTH) {
      log('r_ufos[%d] is now too small! INACTIVATING', ufoIndex);
      replace();
    }

    // inactivate this UFO candidate, and activate the next
    function replace() {
      r_ufos[ufoIndex] = null;
      var ufoIndex = r_ufos.length;
      r_ufos.push(ufos.get(ufoIndex));
      f_ufos.push([]);
      b1_ufos.push(START_B1);
      last_b1.push(dict());
      assert(r_ufos.length === f_ufos.length);
      assert(r_ufos.length === b1_ufos.length);
      assert(r_ufos.length === last_b1.length);
    }
  }       // foundFactor


  // may create new test work
  // returns an array of {id, sigma, B1, ufo} to send to client
  function nextWork(nick, next_work_id, work_to_get) {
    var work = [];

    // produce min_ufo_indices; TODO: maintain a sorted cache instead?
    var min_B1 = Infinity;
    var min_ufo_indices = null;
    r_ufos.forEach(function(u, ufoIndex) {
      if (!u) return;   // inactive
      var cur_B1 = b1_ufos[ufoIndex];
      if (cur_B1 < min_B1) {
        min_B1 = cur_B1;
        min_ufo_indices = [ufoIndex];
      } else if (cur_B1 === min_B1) {
        min_ufo_indices.push(ufoIndex);
      }
    });
    assert(_.isArray(min_ufo_indices) && min_ufo_indices.length);

    var client_obj = clients.get(nick);
    for (var i = 0; i < work_to_get; i++) {
      var id = next_work_id + i;
      var w = {id:id};
      // TODO: test work
      w.sigma = randomSigma();
      var ufoIndex = min_ufo_indices[randInt(0, min_ufo_indices.length-1)];
      assert(_.isNumber(ufoIndex));
      w.ufo = ufoIndex;
      var cur_B1 = b1_ufos[ufoIndex];
      var max_B1 = cur_B1 + Math.floor(nextB1(cur_B1)*0.2)-1;
      w.B1 = randInt(cur_B1, max_B1);  // randomization makes clients less bursty
      work.push(w);
      client_obj.pending_work.push(w);
    }
    return work;
  }       // nextWork
});       // getwork


//DEBUG
app.on('uncaughtException', function (req, res, route, e) {
  console.log('%s %s: ERR: %s', (new Date).toISOString(),
              req.socket.remoteAddress,
              e.message || e);
  res.send(500);
});


// load state
// XXX for now, fake it
for (var i = 0; i < 13; i++) {
  r_ufos.push(ufos.get(i));
  f_ufos.push([]);
  b1_ufos.push(START_B1);
  last_b1.push(dict());
}
//XXX end fake

setImmediate(function(){
  var port = process.env.PORT || 8000;
  app.listen(port, function() {
    console.log("Server listening on port %d...", port);
  });
});

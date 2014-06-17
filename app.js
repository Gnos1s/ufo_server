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

var secret = new Buffer(fs.readFileSync('server.sec', 'utf8'), 'base64');

var sodium_msg = require('./sodium_msg')(secret);
var fromClient = sodium_msg.fromClient;
var toClient = sodium_msg.toClient;

var app = restify.createServer();
app.use(restify.jsonBodyParser());


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
    var decrypted = fromClient(req.body.m, client_pubkey);

    log('FROM nick "%s": /getwork request DECRYPTED %j', nick, decrypted); //DEBUG
    var msg = {work:[]};  //XXX
    log('SENDING %j', msg); //DEBUG
    res.send({m:toClient(msg, client_pubkey)});
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

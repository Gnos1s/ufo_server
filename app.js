'use strict';

var fs = require('fs');
var assert = require('assert');
var _ = require('underscore');
var sodium = require('sodium');
var bigint = require('bigint');
var restify = require('restify');

var secret = new Buffer(fs.readFileSync('server.sec', 'utf8'), 'base64');

var sodium_msg = require('./sodium_msg')(secret);
var fromClient = sodium_msg.fromClient;
var toClient = sodium_msg.toClient;

var app = restify.createServer();
app.use(restify.jsonBodyParser());

var client_pubkey = new Buffer('PIMZgpdx9D374F1sI79SZIXQUaBJIsQ5BxBOnZvHISI=', 'base64');//XXX FIXME

app.post('/getwork', function(req,res){
  if (!req.is('application/json')) return res.send(400);
  if (!_.isObject(req.body)) return res.send(400);
  var nick = req.body.nick;
  var decrypted = fromClient(req.body.m, client_pubkey);

  console.log('FROM nick %s: /getwork request DECRYPTED %j', nick, decrypted);
  var msg = {work:[]};  //XXX
  res.send({m:toClient(msg, client_pubkey)});
});

app.on('uncaughtException', function (req, res, route, e) {
  console.log('ERR: %s', e.message || e);
  res.send(500);
});

var port = process.env.PORT || 8000;
app.listen(port, function() {
  console.log("Server listening on port %d...", port);
});

'use strict';

var fs = require('fs');
var assert = require('assert');
var _ = require('underscore');
var sodium = require('sodium');
var bigint = require('bigint');
var restify = require('restify');

var secret = new Buffer(fs.readFileSync('server.sec', 'utf8'), 'base64');

var app = restify.createServer();
var msg = require('./sodium_msg')(secret);
var fromClient = msg.fromClient;
var toClient = msg.toClient;


var client_pubkey = new Buffer('PIMZgpdx9D374F1sI79SZIXQUaBJIsQ5BxBOnZvHISI=', 'base64');//XXX FIXME

app.post('/getwork', function(req,res){
  if (!_.isObject(req.body)) return res.send(400);
  var nick = req.body.nick;
  var decrypted = fromClient(req.body.m, client_pubkey);

  console.log('FROM nick %s: /getwork request DECRYPTED %j', nick, decrypted);
  res.json({msg:'hello world'});
});

var port = process.env.PORT || 8000;
app.listen(port, function() {
  console.log("Server listening on port %d...", port);
});

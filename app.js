'use strict';

var fs = require('fs');
var sodium = require('sodium');
var bigint = require('bigint');
var restify = require('restify');

var secret = new Buffer(fs.readFileSync('server.sec'), 'base64');

var app = restify.createServer();

app.post('/getwork', function(req,res){
  console.log('req.body is %j', req.body);
  res.json({msg:'hello world'});
});

var port = process.env.PORT || 8000;
app.listen(port, function() {
  console.log("Server listening on port %d...", port);
});

'use strict';

var sodium = require('sodium');
var bigint = require('bigint');
var restify = require('restify');

var app = restify.createServer();

app.get('/', function(req,res){
    res.json({msg:'hello world'});
});

var port = process.env.PORT || 8000;
app.listen(port, function() {
    console.log("Server listening on port %d...", port);
});

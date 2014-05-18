'use strict';

var sodium = require('sodium');
var bigint = require('bigint');
var app = require('express')();

app.disable('x-powered-by');    // don't reveal that we're using Express
console.log('GNOSIS YEAH: ' + app.disabled('x-powered-by'));

app.get('/', function(req,res){
    console.log('GNOSIS YEAH: ' + app.disabled('x-powered-by'));
    res.send('hello world');
});

var port = process.env.PORT || 8000;
app.listen(port, function() {
    console.log("Express listening on port %d...", port);
});

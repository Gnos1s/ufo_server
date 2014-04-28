var sodium = require('sodium');
var bigint = require('bigint');
var app = require('express')();

app.get('/', function(req,res){
    res.send('hello world');
});

var port = process.env.PORT || 8000;
app.listen(port, function() {
    console.log("Express listening on port %d...", port);
});

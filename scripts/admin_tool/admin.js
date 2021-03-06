'use strict';

var os = require('os');
var fs = require('fs');
var assert = require('assert');
var format = require('util').format;
var child_process = require('child_process');
var yaml = require('js-yaml');
var bigint = require('bigint');
var request = require('request');

// using low-level API because the high-level API doesn't work as of v1.0.11
var sodium = require('sodium').api;
var SERVER_KEY = new Buffer('FhMbJE+Cyla045d6y41lHVfEeFieOnLZQod52GXojUw=', 'base64'); // k1773r
var SERVER_URL = 'http://ufoserver.k1773r.darkgamex.ch:8000/admin';   // POST
//var SERVER_URL = 'http://127.0.0.1:8000/admin';   // POST
var RECONNECT_INTERVAL = 10000000;     // ms


if (process.argv.length !== 3) {
  console.log('Usage: node admin.js <config.yml>');
  process.exit(1);
}

var config = yaml.safeLoad(fs.readFileSync(process.argv[2], 'utf8'));
var nick = config.nick,
    pubkey = new Buffer(config.pubkey, 'base64'),
    secret = new Buffer(config.secret, 'base64');

function main() {
  var req = {
    action: 'hotfix',      //XXX DEBUG
    script: fs.readFileSync(__dirname + '/hotfixes/test.js', 'utf8'),

    //action: 'set',           //XXX DEBUG
    //nick: 'okaycool',
    //pubkey: 'AAAAAAAAAABAYKECAAAAAF8wMz0BAAAA0GefAgAAAAA=',

    //action: 'dump',            // XXX DEBUG

    //action: 'ban',            // XXX DEBUG
    //nick: 'okaycool',
  };
  var enc_req = {nick:nick, m:toServer(req)};
  request.post(SERVER_URL, {json: enc_req}, function(err, response, body) {
    function invalid() {
      if (err) {
        console.error("Problem connecting to server: %j; exiting.", err.message);
      } else if (response.statusCode !== 200) {
        console.error("Server responded with HTTP status code %d", response.statusCode);
      } else {
        console.error("Invalid response body: %j; exiting.", body);
      }
      if (response && response.statusCode === 400) {
        console.error('Server thinks something is wrong; exiting.');
      }
      return process.exit(1);
    }
    if (err || response.statusCode !== 200) return invalid();

    if (!body || body.charCodeAt) return invalid(); // if string, invalid JSON

    if (!body.m) return invalid();  // if string, invalid JSON

    var res = fromServer(body.m);
    if (!res) return invalid();   // could not decrypt

    // at this point, we can trust everything in res as coming from server

    console.log(JSON.stringify(res, null, 2));
  });
}


// decrypt a string from the server; returns undefined if failure
function fromServer(m) {
  if (!m || !m.charCodeAt) return;   // should be string
  var m_split = m.split('|');
  if (m_split.length !== 2) return;
  var nonce = new Buffer(m_split[0], 'base64');
  if (nonce.length !== sodium.crypto_box_NONCEBYTES) return;
  var cipherText = new Buffer(m_split[1], 'base64');
  if (!cipherText.length) return;
  var plainBuffer = sodium.crypto_box_open(cipherText, nonce, SERVER_KEY, secret);
  if (!plainBuffer) return;
  return JSON.parse(plainBuffer.toString('utf8'));
}


function toServer(o) {
  assert(o);
  var nonce = new Buffer(sodium.crypto_box_NONCEBYTES);
  sodium.randombytes_buf(nonce);
  var plainBuffer = new Buffer(JSON.stringify(o), 'utf8');
  var cipherMsg = sodium.crypto_box(plainBuffer, nonce, SERVER_KEY, secret);
  assert(cipherMsg);
  return format('%s|%s',
    nonce.toString('base64'),
    cipherMsg.toString('base64')
  );
}


main();

'use strict';

var format = require('util').format;
var sodium = require('sodium').api;

var pub = new Buffer(fs.readFileSync('server.pub', 'utf8'), 'base64');
var sec = new Buffer(fs.readFileSync('server.sec', 'utf8'), 'base64');



var client_pubkey = new Buffer('ZHxkgSUUjw9yA+A9L6XHjN6K9SgKqRFye0hNf+mfYiI=', 'base64');


function fromClient(m, client_pubkey) {
  if (!m || !m.charCodeAt) return;   // should be string
  var m_split = m.split('|');
  if (m_split.length !== 2) return;
  var nonce = new Buffer(m_split[0], 'base64');
  if (nonce.length !== sodium.crypto_box_NONCEBYTES) return;
  var cipherText = new Buffer(m_split[1], 'base64');
  if (!cipherText.length) return;
  var plainBuffer = sodium.crypto_box_open(cipherText, nonce, client_pubkey, sec);
  if (!plainBuffer) return;
  return JSON.parse(plainBuffer.toString('utf8'));
}

function toClient(o, client_pubkey) {
  assert(o);
  var nonce = new Buffer(sodium.crypto_box_NONCEBYTES);
  sodium.randombytes_buf(nonce);
  var plainBuffer = new Buffer(JSON.stringify(o), 'utf8');
  var cipherMsg = sodium.crypto_box(plainBuffer, nonce, client_pubkey, sec);
  assert(cipherMsg);
  return format('%s|%s',
    nonce.toString('base64'),
    cipherMsg.toString('base64')
  );
}


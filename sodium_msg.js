'use strict';

var _ = require('underscore');
var format = require('util').format;
var sodium = require('sodium').api;


module.exports = function(server_secret_key){

  function fromClient(m, client_pubkey) {
    if (!_.isString(m)) return;
    var m_split = m.split('|');
    if (m_split.length !== 2) return;
    var nonce = new Buffer(m_split[0], 'base64');
    if (nonce.length !== sodium.crypto_box_NONCEBYTES) return;
    var cipherText = new Buffer(m_split[1], 'base64');
    if (!cipherText.length) return;
    var plainBuffer = sodium.crypto_box_open(cipherText, nonce, client_pubkey, server_secret_key);
    if (!plainBuffer) return;
    return JSON.parse(plainBuffer.toString('utf8'));
  }


  function toClient(o, client_pubkey) {
    assert(_.isObject(o));
    var nonce = new Buffer(sodium.crypto_box_NONCEBYTES);
    sodium.randombytes_buf(nonce);
    var plainBuffer = new Buffer(JSON.stringify(o), 'utf8');
    var cipherMsg = sodium.crypto_box(plainBuffer, nonce, client_pubkey, server_secret_key);
    assert(cipherMsg);
    return format('%s|%s',
      nonce.toString('base64'),
      cipherMsg.toString('base64')
    );
  }


  return {fromClient:fromClient, toClient:toClient};
};

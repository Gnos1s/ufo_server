'use strict';

var DB_PATH = 'state.leveldb';
var Db = require('../db');

if (process.argv.length !== 4) {
  console.log('Usage: node scripts/add_nick.js <nick> <pubkey>');
  process.exit(1);
}

var db = Db(DB_PATH, function(e) {
  console.error('ERROR opening database "%s": %s', DB_PATH, e.stack || e);
  process.exit(1);
});

var nick = process.argv[2];
var pubkey = process.argv[3];
db.setPublicKey(nick, pubkey, function(err) {
  if (err) {
    console.error('ERROR: %s', err.message || err);
    return process.exit(1);
  }
  process.exit(0);
});

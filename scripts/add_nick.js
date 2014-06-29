'use strict';

var yaml = require('js-yaml');
var fs = require('fs');

var DB_PATH = 'state.leveldb';
var Db = require('../db');

if (process.argv.length !== 3) {
  console.log('Usage: node scripts/add_nick.js <config.yml>');
  process.exit(1);
}

var config_file = process.argv[2];
var config = yaml.safeLoad(fs.readFileSync(config_file, 'utf8'));
var nick = config.nick;
var pubkey = config.pubkey;

var db = Db(DB_PATH, function(e) {
  console.error('ERROR opening database "%s": %s', DB_PATH, e.stack || e);
  process.exit(1);
});

db.setPublicKey(nick, pubkey, function(err) {
  if (err) {
    console.error('ERROR: %s', err.message || err);
    return process.exit(1);
  }
  process.exit(0);
});

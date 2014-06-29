'use strict';

var DB_PATH = 'state.leveldb';
var Db = require('../db');

if (process.argv.length !== 3) {
  console.log('Usage: node scripts/make_admin.js <nick>');
  process.exit(1);
}

var db = Db(DB_PATH, function(e) {
  console.error('ERROR opening database "%s": %s', DB_PATH, e.stack || e);
  process.exit(1);
});

var nick = process.argv[2];
db.getClientObj(nick, function(err, client_obj) {
  if (err) {
    console.error('ERROR loading client_obj: %s', err.message || err);
    return process.exit(1);
  }

  client_obj.status = 'admin';

  db.setClientObj(nick, client_obj, function(err) {
  if (err) {
    console.error('ERROR saving client_obj: %s', err.message || err);
    return process.exit(1);
  }

  console.log('client_obj for nick "%s":', nick);
  console.log(JSON.stringify(client_obj, null, 2));
  process.exit(0);
  });
});

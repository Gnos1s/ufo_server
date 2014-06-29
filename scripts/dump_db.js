'use strict';

var Db = require('../db');

if (process.argv.length !== 3) {
  console.log('Usage: node scripts/dump_db.js <db_path>');
  process.exit(1);
}

var db_path = process.argv[2];

var db = Db(db_path, function(e) {
  console.error('ERROR opening database "%s": %s', db_path, e.stack || e);
  process.exit(1);
});

db.getItemsByPrefix('', function(err, items) {
  if (err) {
    console.error('ERROR dumping database: %s', err.message || err);
    return process.exit(1);
  }

  console.log(JSON.stringify(items, null, 2));
  process.exit(0);
});

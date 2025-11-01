// server/clear_matches.js
// Safe script to wipe all matches and reset teams to initial ratings.
// Usage: node server/clear_matches.js

const fs = require('fs');
const path = require('path');

const DB_FILE = path.resolve(__dirname, 'db.json');
const BACKUP_FILE = path.resolve(__dirname, `db.json.bak.${Date.now()}`);

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    console.error('DB file not found:', DB_FILE);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDB(obj) {
  fs.writeFileSync(DB_FILE, JSON.stringify(obj, null, 2));
}

console.log('Backing up', DB_FILE, '->', BACKUP_FILE);
fs.copyFileSync(DB_FILE, BACKUP_FILE);

const db = readDB();

// Clear matches
db.matches = [];

// Reset nextMatchId
db.nextMatchId = 1;

// Reset all teams elo and plus_minus
if (Array.isArray(db.teams)) {
  db.teams = db.teams.map(t => {
    // preserve id and name and created_at
    return {
      id: t.id,
      name: t.name,
      elo: 1500,
      plus_minus: 0,
      created_at: t.created_at || new Date().toISOString()
    };
  });
} else {
  db.teams = [];
}

writeDB(db);
console.log('Wrote cleaned DB to', DB_FILE);
console.log('Backup preserved at', BACKUP_FILE);

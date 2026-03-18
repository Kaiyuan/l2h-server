import Database from 'better-sqlite3';
const db = new Database('l2h.db');
console.log(db.prepare('SELECT * FROM users').all());

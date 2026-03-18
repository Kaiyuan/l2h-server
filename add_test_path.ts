import Database from 'better-sqlite3';
const db = new Database('l2h.db');
try {
    db.prepare('INSERT INTO paths (name, port, user_id) VALUES (?, ?, ?)').run('test', 8000, 1);
    console.log('Path mapping /test -> 8000 added');
} catch (e) {
    console.log('Path mapping already exists or error:', e.message);
}

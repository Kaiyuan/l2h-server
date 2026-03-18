import Database from 'better-sqlite3';
const db = new Database('l2h.db');
db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('l2hadmin', 'l2hpassword', 'admin');
console.log('Admin user created');
const user = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
console.log(user);

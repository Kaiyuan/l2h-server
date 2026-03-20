import db from './db/index.js';
const paths = db.prepare('SELECT * FROM paths').all();
console.log(JSON.stringify(paths, null, 2));
process.exit(0);

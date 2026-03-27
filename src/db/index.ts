let dbInstance: any;

// 同构数据库适配层
let db: any;

// 检查环境：Node (Docker) 还是 Worker (Cloudflare)
const isNode = typeof process !== 'undefined' && process.release && process.release.name === 'node';

if (isNode) {
    // Docker 环境使用 better-sqlite3
    const Database = require('better-sqlite3');
    const path = require('path');
    const { existsSync, mkdirSync } = require('fs');
    
    // 确保数据目录存在
    const dbDir = path.resolve(process.env.DB_DIR || './data');
    if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

    db = new Database(process.env.DB_PATH || path.join(dbDir, 'l2h.db'));
} else {
    // Cloudflare 环境下，db 将在运行时根据需要从 context 获取
    db = null;
}

export const initDB = (platformDB?: any) => {
    if (platformDB) {
        dbInstance = platformDB; // D1
        return;
    }
    // If running in Node.js and db is already initialized by the environment check
    if (isNode && db) {
        dbInstance = db;
    } else {
        // Fallback or specific initialization if needed, though the global `db` should handle Node.js
        // For Cloudflare, dbInstance will be set via platformDB argument
        // This part might need adjustment based on how `dbInstance` is ultimately used
        // For now, if not platformDB and not Node, it means `db` is null, so `dbInstance` remains undefined
        // or we could throw an error if dbInstance is expected to be set here.
        // Given the original code, it seems `dbInstance` was always set here for Node.js.
        // Let's ensure it's set if `isNode` is true and `db` was initialized.
        if (isNode) {
            dbInstance = db;
        } else {
            // This case implies a non-Node environment without platformDB provided.
            // The original code would have failed here.
            // For Cloudflare, `platformDB` (D1) is expected.
            throw new Error("Database not initialized. Provide platformDB for Worker environment or ensure Node.js setup is correct.");
        }
    }

    // Ensure schema is applied if dbInstance is a better-sqlite3 instance
    if (dbInstance && typeof dbInstance.exec === 'function') {
        dbInstance.exec(SCHEMA);
    }
};

// 初始化表模板
export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    nickname TEXT,
    api_key TEXT UNIQUE,
    url_limit INTEGER DEFAULT 5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS paths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT UNIQUE NOT NULL,
    port INTEGER NOT NULL,
    service_id INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    note TEXT,
    memo TEXT,
    used_by TEXT,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    content TEXT,
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`;

const proxyDB = new Proxy({} as any, {
    get(_, prop) {
        if (!dbInstance) initDB();
        return dbInstance[prop];
    }
});

export default proxyDB;

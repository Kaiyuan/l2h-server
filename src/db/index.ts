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

let d1Initialized = false;

export const initDB = async (platformDB?: any) => {
    if (platformDB) {
        // Wrapper mapping standard sqlite3/better-sqlite3 methods to Cloudflare D1
        dbInstance = {
            prepare: (q: string) => {
                const stmt = platformDB.prepare(q);
                return {
                    get: async (...args: any[]) => {
                        return await stmt.bind(...args).first();
                    },
                    all: async (...args: any[]) => {
                        const { results } = await stmt.bind(...args).all();
                        return results;
                    },
                    run: async (...args: any[]) => {
                        const res = await stmt.bind(...args).run();
                        return { changes: res.meta?.changes || 0, lastInsertRowid: res.meta?.last_row_id || 0 };
                    }
                };
            },
            transaction: (fn: any) => {
                // Fake transaction wrapper for D1
                return async (d: any) => {
                    return await fn(d);
                };
            }
        };
        
        if (!d1Initialized) {
            try {
                await platformDB.exec(SCHEMA);
                d1Initialized = true;
                console.log('D1 Schema Initialized Successfully');
            } catch (e: any) {
                console.error('D1 Schema Initialization Failed:', e.message);
                // do not set d1Initialized=true, to retry on next request
            }
        }
        return;
    }
    if (isNode && db) {
        dbInstance = db;
        // 本地 SQLite 需要初始化 schema
        if (typeof dbInstance.exec === 'function') {
            dbInstance.exec(SCHEMA);
        }
    }
    // Cloudflare 环境下，dbInstance 由每个请求前的中间件通过 c.env.DB 注入
};

// 初始化表模板 (压缩格式以兼容 D1.exec)
export const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'user', nickname TEXT, api_key TEXT UNIQUE, url_limit INTEGER DEFAULT 5, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);",
  "CREATE TABLE IF NOT EXISTS paths (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT UNIQUE NOT NULL, port INTEGER NOT NULL, service_id INTEGER DEFAULT 1, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));",
  "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);",
  "CREATE TABLE IF NOT EXISTS coupons (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, note TEXT, memo TEXT, used_by TEXT, expires_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);",
  "CREATE TABLE IF NOT EXISTS invitations (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, expires_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);",
  "CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, title TEXT, content TEXT, status TEXT DEFAULT 'open', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));"
].join("\n");

const proxyDB = new Proxy({} as any, {
    get(_, prop) {
        if (!dbInstance && isNode) initDB(); // Try to default-initialize for Node
        if (!dbInstance) {
            console.error("Database not initialized! On Cloudflare, ensure c.env.DB is bound and injected via middleware.");
            return () => { throw new Error("Database not initialized"); };
        }
        
        // Return property, bounding methods correctly
        const val = dbInstance[prop];
        return typeof val === 'function' ? val.bind(dbInstance) : val;
    }
});

export default proxyDB;

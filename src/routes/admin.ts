import { Hono } from 'hono';
import db from '../db/index.js';
import { webrtcManager } from '../webrtc/manager.js';
import { jwt } from 'hono/jwt';
import * as config from '../config.js';

export const admin = new Hono();

admin.use('*', jwt({ secret: config.JWT_SECRET, alg: 'HS256' }));

// All routes here should be protected by admin role middleware (to be added)
admin.get('/stats', (c) => {
    const stats = {
        total_users: (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count,
        total_paths: (db.prepare('SELECT COUNT(*) as count FROM paths').get() as { count: number }).count,
        active_sessions: webrtcManager.getFirstSessionId() ? 1 : 0, // Placeholder for real count
    };
    return c.json(stats);
});

admin.get('/users', (c) => {
    const users = db.prepare('SELECT * FROM users').all();
    return c.json(users);
});

admin.get('/settings', (c) => {
    const settings = db.prepare('SELECT * FROM settings').all();
    const configObj = settings.reduce((acc: any, cur: any) => {
        acc[cur.key] = cur.value;
        return acc;
    }, {});
    return c.json(configObj);
});

admin.post('/settings', async (c) => {
    const body = await c.req.json();
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    const transaction = db.transaction((data) => {
        for (const [key, value] of Object.entries(data)) {
            stmt.run(key, String(value));
        }
    });
    transaction(body);
    return c.json({ success: true });
});

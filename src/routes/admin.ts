import { Hono } from 'hono';
import db from '../db/index.js';
import { webrtcManager } from '../webrtc/manager.js';
import { jwt } from 'hono/jwt';
import * as config from '../config.js';

export const admin = new Hono();

admin.use('*', jwt({ secret: config.JWT_SECRET, alg: 'HS256' }));

// 这里的全部路由都应受管理员角色中间件保护（待添加）
admin.get('/stats', async (c) => {
    const stats = {
        total_users: (await db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count,
        total_paths: (await db.prepare('SELECT COUNT(*) as count FROM paths').get() as { count: number }).count,
        active_sessions: webrtcManager.getActiveSessionCount(),
    };
    return c.json(stats);
});

admin.get('/users', async (c) => {
    const users = await db.prepare('SELECT * FROM users').all();
    return c.json(users);
});

admin.get('/settings', async (c) => {
    const settings = await db.prepare('SELECT * FROM settings').all();
    const configObj = settings.reduce((acc: any, cur: any) => {
        acc[cur.key] = cur.value;
        return acc;
    }, {});
    return c.json(configObj);
});

admin.post('/settings', async (c) => {
    const body = await c.req.json();
    const transaction = db.transaction((data: Record<string, any>) => {
        for (const [key, value] of Object.entries(data)) {
            db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
        }
    });
    transaction(body);
    return c.json({ success: true });
});

// 邀请码
admin.get('/invitations', async (c) => {
    const invitations = await db.prepare('SELECT * FROM invitations').all();
    return c.json(invitations);
});

admin.post('/invitations', async (c) => {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    await db.prepare('INSERT INTO invitations (code) VALUES (?)').run(code);
    return c.json({ success: true, code });
});

admin.delete('/invitations/:id', async (c) => {
    const id = c.req.param('id');
    await db.prepare('DELETE FROM invitations WHERE id = ?').run(id);
    return c.json({ success: true });
});

// 兑换码
admin.get('/coupons', async (c) => {
    const coupons = await db.prepare('SELECT * FROM coupons').all();
    return c.json(coupons);
});

admin.post('/coupons', async (c) => {
    const body = await c.req.json();
    const code = Math.random().toString(36).substring(2, 12).toUpperCase();
    const memo = body.memo || '';
    await db.prepare('INSERT INTO coupons (code, memo) VALUES (?, ?)').run(code, memo);
    return c.json({ success: true, code });
});

admin.delete('/coupons/:id', async (c) => {
    const id = c.req.param('id');
    await db.prepare('DELETE FROM coupons WHERE id = ?').run(id);
    return c.json({ success: true });
});

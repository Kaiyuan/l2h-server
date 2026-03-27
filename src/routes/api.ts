import { Hono } from 'hono';
import db from '../db/index.js';
import { z } from 'zod';
import { sign, jwt } from 'hono/jwt';
import * as config from '../config.js';

// node-datachannel 和 webrtcManager 只在 Node 环境下加载
const isNode = typeof process !== 'undefined' && process.release && process.release.name === 'node';
let datachannel: any = null;
let webrtcManager: any = null;
if (isNode) {
    datachannel = require('node-datachannel');
    webrtcManager = require('../webrtc/manager.js').webrtcManager;
}

const JWT_SECRET = config.JWT_SECRET;

export const api = new Hono();

const auth = jwt({ secret: JWT_SECRET, alg: 'HS256' });

api.get('/ping', (c) => c.json({ status: 'ok', time: new Date() }));

// 获取 WebRTC 公共配置 (供客户端连接前调用)
api.get('/webrtc/config', async (c) => {
    const servers = await db.prepare('SELECT value FROM settings WHERE key = ?').get('webrtc_servers') as any;
    return c.json({
        iceServers: servers ? JSON.parse(servers.value) : ["stun:stun.cloudflare.com:3478"]
    });
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

api.post('/login', async (c) => {
  const body = await c.req.json();
  const result = loginSchema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid input' }, 400);

  const { username, password } = result.data;
  const user = await db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password) as { id: number, username: string, role: string, api_key: string } | undefined;

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
  };
  const token = await sign(payload, JWT_SECRET);

  return c.json({ 
    user: { id: user.id, username: user.username, role: user.role, api_key: user.api_key },
    token
  });
});

const registerSchema = z.object({
  username: z.string(),
  password: z.string(),
  invitation_code: z.string()
});

api.post('/register', async (c) => {
  const body = await c.req.json();
  const result = registerSchema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid input' }, 400);

  const { username, password, invitation_code } = result.data;
  
  const invite = await db.prepare('SELECT id, expires_at FROM invitations WHERE code = ?').get(invitation_code) as any;
  if (!invite) return c.json({ error: 'Invalid or expired invitation code' }, 400);
  
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    await db.prepare('DELETE FROM invitations WHERE id = ?').run(invite.id);
    return c.json({ error: 'Invitation code has expired' }, 400);
  }

  const existing = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return c.json({ error: 'Username already exists' }, 400);

  const api_key = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  try {
    await db.prepare('INSERT INTO users (username, password, api_key) VALUES (?, ?, ?)').run(username, password, api_key);
    await db.prepare('DELETE FROM invitations WHERE id = ?').run(invite.id);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: 'Registration failed' }, 500);
  }
});

api.get('/user/me', auth, async (c) => {
    const payload = c.get('jwtPayload') as { id: number; username: string; role: string };
    if (!payload) return c.json({ error: 'Unauthorized' }, 401);
    
    const user = await db.prepare('SELECT id, username, role, api_key, url_limit FROM users WHERE id = ?').get(payload.id) as any;
    return c.json(user);
});

api.post('/user/redeem', auth, async (c) => {
    const payload = c.get('jwtPayload') as any;
    const body = await c.req.json();
    const { code } = body;

    const coupon = await db.prepare('SELECT id, used_by FROM coupons WHERE code = ?').get(code) as any;
    if (!coupon) return c.json({ error: 'Invalid coupon code' }, 400);
    if (coupon.used_by) return c.json({ error: 'Coupon already used' }, 400);

    try {
        await db.prepare('UPDATE coupons SET used_by = ? WHERE id = ?').run(payload.username, coupon.id);
        await db.prepare('UPDATE users SET url_limit = url_limit + 5 WHERE id = ?').run(payload.id);
        return c.json({ success: true, message: 'Added 5 to URL limit' });
    } catch (e) {
        return c.json({ error: 'Redeem failed' }, 500);
    }
});

api.get('/paths', auth, async (c) => {
  const payload = c.get('jwtPayload') as any;
  const user = await db.prepare('SELECT api_key, url_limit FROM users WHERE id = ?').get(payload.id) as any;
  const paths = await db.prepare('SELECT * FROM paths WHERE user_id = ?').all(payload.id) as any[];
  const isOnline = !!webrtcManager.getSessionByApiKey(user?.api_key);
  const result = paths.map(p => ({
    ...p,
    status: isOnline ? 'online' : 'offline'
  }));
  return c.json({ paths: result, url_limit: user?.url_limit ?? 5, connected: isOnline });
});


api.post('/paths', auth, async (c) => {
  const body = await c.req.json();
  const payload = c.get('jwtPayload') as any;
  const { name, port } = body;
  
  try {
    await db.prepare('INSERT INTO paths (name, port, user_id) VALUES (?, ?, ?)').run(name, port, payload.id);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: 'Path name already exists or invalid data' }, 400);
  }
});

api.put('/paths/:id', auth, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const payload = c.get('jwtPayload') as any;
  const { name, port, is_active } = body;
  
  try {
    const existing = await db.prepare('SELECT user_id FROM paths WHERE id = ?').get(id) as any;
    if (!existing || existing.user_id !== payload.id) return c.json({ error: 'Unauthorized' }, 403);
    await db.prepare('UPDATE paths SET name = ?, port = ?, is_active = ? WHERE id = ?').run(name, port, is_active ? 1 : 0, id);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: 'Update failed' }, 400);
  }
});

api.delete('/paths/:id', auth, async (c) => {
  const id = c.req.param('id');
  const payload = c.get('jwtPayload') as any;
  try {
    const existing = await db.prepare('SELECT user_id FROM paths WHERE id = ?').get(id) as any;
    if (!existing || existing.user_id !== payload.id) return c.json({ error: 'Unauthorized' }, 403);
    await db.prepare('DELETE FROM paths WHERE id = ?').run(id);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: 'Delete failed' }, 400);
  }
});

const clients = new Map<string, any>(); // API Key 到信令状态的映射

api.post('/webrtc/signal', async (c) => {
    try {
        const body = await c.req.json();
        console.log('收到信号:', body.type);
        const { api_key, sdp, type } = body;
        
        // 验证 API Key
        const user = await db.prepare('SELECT id FROM users WHERE api_key = ?').get(api_key);
        if (!user) return c.json({ error: 'Invalid API Key' }, 401);

        if (type === 'offer') {
            console.log('--- 正在处理 WebRTC Offer ---');
            
            if (!datachannel) {
                return c.json({ 
                    error: 'Cloudflare Workers 不直接支持运行 WebRTC 节点。请将 l2h-server 部署在 Node.js (Docker/Native) 环境中以处理流量映射。' 
                }, 501);
            }

            // 添加 Google 公共 STUN 服务器以协助发现网络路径
            const pc = new datachannel.PeerConnection("l2h-server", { 
                iceServers: ["stun:stun.l.google.com:19302"] 
            });
            
            // Register with manager to handle DataChannels
            webrtcManager.addConnection(api_key, pc);

            const answerPromise = new Promise<string>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    pc.close();
                    reject(new Error('SDP Answer Generation Timeout'));
                }, 10000);

                pc.onLocalDescription((sdp, type) => {
                    console.log('已生成本地描述:', type);
                    if (type === 'answer') {
                        clearTimeout(timeout);
                        resolve(sdp);
                    }
                });
            });

            pc.onGatheringStateChange((state) => console.log('收集状态:', state));
            pc.onStateChange((state) => console.log('PC 状态变更:', state));

            try {
                pc.setRemoteDescription(sdp, type);
                console.log('已设置远程描述');
            } catch (err) {
                console.error('设置远程描述失败:', err);
                pc.close();
                return c.json({ error: 'Invalid SDP' }, 400);
            }
            
            try {
                const answerSDP = await answerPromise;
                webrtcManager.addConnection(api_key, pc); 
                console.log('正在向客户端返回 answer');
                return c.json({ status: 'ok', type: 'answer', sdp: answerSDP });
            } catch (err: any) {
                console.error('Answer 生成错误:', err.message);
                return c.json({ error: err.message }, 500);
            }
        }

        return c.json({ error: 'Unsupported signal type' }, 400);
    } catch (e: any) {
        console.error('Signal Error:', e);
        return c.json({ error: e.message || 'Internal error' }, 500);
    }
});

api.get('/user/me', (c) => {
    // 暂时返回虚拟用户
    return c.json({ username: 'l2hadmin', role: 'admin' });
});

api.post('/user/api-key', auth, async (c) => {
    const apiKey = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    // 为用户更新（目前仅为管理员实现）
    await db.prepare('UPDATE users SET api_key = ? WHERE role = ?').run(apiKey, 'admin');
    return c.json({ api_key: apiKey });
});

api.post('/user/update-password', auth, async (c) => {
    const payload = c.get('jwtPayload') as { id: number };
    const { oldPassword, newPassword } = await c.req.json();
    
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id) as any;
    if (user.password !== oldPassword) {
        return c.json({ error: '旧密码不正确' }, 400);
    }
    
    await db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword, payload.id);
    return c.json({ success: true });
});

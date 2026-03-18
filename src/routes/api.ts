import { Hono } from 'hono';
import db from '../db/index.js';
import { z } from 'zod';
import * as datachannel from 'node-datachannel';
import { webrtcManager } from '../webrtc/manager.js';
import { sign, jwt } from 'hono/jwt';
import * as config from '../config.js';

const JWT_SECRET = config.JWT_SECRET;

export const api = new Hono();

const auth = jwt({ secret: JWT_SECRET, alg: 'HS256' });

api.get('/ping', (c) => c.json({ status: 'ok', time: new Date() }));

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

api.post('/login', async (c) => {
  const body = await c.req.json();
  const result = loginSchema.safeParse(body);
  if (!result.success) return c.json({ error: 'Invalid input' }, 400);

  const { username, password } = result.data;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password) as { id: number, username: string, role: string, api_key: string } | undefined;

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

api.get('/user/me', auth, (c) => {
    const payload = c.get('jwtPayload') as { id: number; username: string; role: string };
    if (!payload) return c.json({ error: 'Unauthorized' }, 401);
    
    const user = db.prepare('SELECT id, username, role, api_key FROM users WHERE id = ?').get(payload.id) as any;
    return c.json(user);
});

api.get('/paths', auth, async (c) => {
  const paths = db.prepare('SELECT * FROM paths').all() as any[];
  const sessionId = webrtcManager.getFirstSessionId();
  const result = paths.map(p => ({
    ...p,
    status: sessionId ? 'online' : 'offline' // Simple check for now
  }));
  return c.json(result);
});

api.post('/paths', auth, async (c) => {
  const body = await c.req.json();
  const { name, port, user_id } = body;
  
  try {
    db.prepare('INSERT INTO paths (name, port, user_id) VALUES (?, ?, ?)').run(name, port, user_id);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: 'Path name already exists or invalid data' }, 400);
  }
});

api.put('/paths/:id', auth, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { name, port, is_active } = body;
  
  try {
    db.prepare('UPDATE paths SET name = ?, port = ?, is_active = ? WHERE id = ?').run(name, port, is_active ? 1 : 0, id);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: 'Update failed' }, 400);
  }
});

api.delete('/paths/:id', auth, async (c) => {
  const id = c.req.param('id');
  try {
    db.prepare('DELETE FROM paths WHERE id = ?').run(id);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: 'Delete failed' }, 400);
  }
});

const clients = new Map<string, any>(); // Map API Key to signaling state

api.post('/webrtc/signal', async (c) => {
    try {
        const body = await c.req.json();
        console.log('Received signal:', body.type);
        const { api_key, sdp, type } = body;
        
        // Verify API Key
        const user = db.prepare('SELECT id FROM users WHERE api_key = ?').get(api_key);
        if (!user) return c.json({ error: 'Invalid API Key' }, 401);

        if (type === 'offer') {
            console.log('--- Processing WebRTC Offer ---');
            const pc = new datachannel.PeerConnection("l2h-server", { iceServers: [] });
            
            const dc = pc.createDataChannel("l2h-data");
            dc.onMessage((msg) => console.log('DC Message:', msg));
            dc.onOpen(() => dc.sendMessage('Hello from server!'));

            const answerPromise = new Promise<string>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    pc.close();
                    reject(new Error('SDP Answer Generation Timeout'));
                }, 10000);

                pc.onLocalDescription((sdp, type) => {
                    console.log('Generated local description:', type);
                    if (type === 'answer') {
                        clearTimeout(timeout);
                        resolve(sdp);
                    }
                });
            });

            pc.onGatheringStateChange((state) => console.log('Gathering State:', state));
            pc.onStateChange((state) => console.log('PC State Change:', state));

            try {
                pc.setRemoteDescription(sdp, type);
                console.log('Remote description set');
            } catch (err) {
                console.error('Failed to set remote description:', err);
                pc.close();
                return c.json({ error: 'Invalid SDP' }, 400);
            }
            
            try {
                const answerSDP = await answerPromise;
                webrtcManager.addConnection(api_key, pc); 
                console.log('Returning answer to client');
                return c.json({ status: 'ok', type: 'answer', sdp: answerSDP });
            } catch (err: any) {
                console.error('Answer Generation Error:', err.message);
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
    // Return dummy user for now
    return c.json({ username: 'l2hadmin', role: 'admin' });
});

api.post('/user/api-key', auth, (c) => {
    const apiKey = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    // Update for the user (implementing admin only for now)
    db.prepare('UPDATE users SET api_key = ? WHERE role = ?').run(apiKey, 'admin');
    return c.json({ api_key: apiKey });
});

api.post('/user/update-password', auth, async (c) => {
    const payload = c.get('jwtPayload') as { id: number };
    const { oldPassword, newPassword } = await c.req.json();
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id) as any;
    if (user.password !== oldPassword) {
        return c.json({ error: '旧密码不正确' }, 400);
    }
    
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword, payload.id);
    return c.json({ success: true });
});

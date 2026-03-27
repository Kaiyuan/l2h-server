import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import * as config from './config.js';
import { api } from './routes/api.js';
import { admin } from './routes/admin.js';
import db from './db/index.js';
import { webrtcManager } from './webrtc/manager.js';

const app = new Hono();
app.use('*', logger());
app.use('*', cors());

// 中间件：透传反代后的真实客户端 IP
app.use('*', async (c, next) => {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const realIp = forwarded.split(',')[0].trim();
    // 可以在这里扩展将 realIp 存入 context
  }
  await next();
});

// 中间件：检查管理员是否已初始化
const setupMiddleware = async (c: any, next: any) => {
  const adminUser = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
  const path = c.req.path;
  if (!adminUser && !path.startsWith('/setup') && !path.startsWith('/api/setup') && !path.startsWith('/api/webrtc')) {
    return c.redirect('/setup');
  }
  await next();
};

app.use('*', setupMiddleware);

// 路由
app.route('/api', api);
app.route('/admin-api', admin);

// 仪表盘后台静态文件服务
app.use('/dashboard/*', serveStatic({ 
  root: './src/admin/dist',
  rewriteRequestPath: (path) => path.replace(/^\/dashboard/, '')
}));
app.get('/dashboard', (c) => c.redirect('/dashboard/'));

// 网关逻辑导出供 Worker 使用
export const gateway = new Hono();
gateway.all('*', async (c) => {
    const pathName = c.req.path.split('/')[1];
    if (!pathName) return c.notFound();

    const mapping = db.prepare(
        `SELECT p.port, p.user_id, u.api_key
         FROM paths p JOIN users u ON p.user_id = u.id
         WHERE p.name = ? AND p.is_active = 1`
    ).get(pathName) as any;

    if (!mapping) return c.notFound();

    const sessionId = webrtcManager.getSessionByApiKey(mapping.api_key);
    if (!sessionId) return c.text(`主机未连接`, 503);

    try {
        const fullPath = c.req.path.substring(pathName.length + 1) || '/';
        const bodyBuffer = await c.req.arrayBuffer();
        
        let bodyBase64: string | undefined;
        if (bodyBuffer.byteLength > 0) {
            // 兼容性处理 Base64
            if (typeof Buffer !== 'undefined') {
                bodyBase64 = Buffer.from(bodyBuffer).toString('base64');
            } else {
                bodyBase64 = btoa(String.fromCharCode(...new Uint8Array(bodyBuffer)));
            }
        }

        const proxyRequest = {
            method: c.req.method,
            path: fullPath,
            headers: c.req.header(),
            targetPort: mapping.port,
            body: bodyBase64
        };

        const response = await webrtcManager.sendRequest(sessionId, proxyRequest);
        return c.newResponse(response.body, response.status, response.headers);
    } catch (err: any) {
        return c.text('Gateway Error', 504);
    }
});

// 其他路由 (setup, etc.)
app.get('/setup', (c) => {
  const adminUser = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
  if (adminUser) return c.redirect('/dashboard/');
  return c.html(`
    <h1>初始化管理员</h1>
    <form method="POST" action="/setup">
      <input name="username" placeholder="Username" required /><br/>
      <input name="password" type="password" placeholder="Password" required /><br/>
      <button type="submit">创建管理员</button>
    </form>
  `);
});

app.post('/setup', async (c) => {
  const body = await c.req.parseBody();
  const { username, password } = body as any;
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, password, 'admin');
  return c.redirect('/dashboard/');
});

// 自动从环境变量初始化管理员 (如果设置)
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (ADMIN_USER && ADMIN_PASSWORD) {
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(ADMIN_USER);
  if (!exists) {
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(ADMIN_USER, ADMIN_PASSWORD, 'admin');
    console.log(`已从环境变量自动创建管理员: ${ADMIN_USER}`);
  }
}

// 初始化默认 WebRTC 服务器配置 (Cloudflare)
const defaultIceServers = JSON.stringify([
    "stun:stun.cloudflare.com:3478",
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302"
]);
const iceConfig = db.prepare('SELECT value FROM settings WHERE key = ?').get('webrtc_servers');
if (!iceConfig) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('webrtc_servers', defaultIceServers);
}

app.route('/', gateway);


export default app;

// 如果在 Node 环境下运行
if (typeof process !== 'undefined' && process.release?.name === 'node') {
    const { serve } = require('@hono/node-server');
    const DEFAULT_PORT = config.PORT || 52331;
    console.log(`Node.js 服务器启动: http://localhost:${DEFAULT_PORT}`);
    serve({ fetch: app.fetch, port: DEFAULT_PORT as any });
}

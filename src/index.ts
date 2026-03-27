import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import * as config from './config.js';
import { api } from './routes/api.js';
import { admin } from './routes/admin.js';
import db, { initDB } from './db/index.js';
import { webrtcManager } from './webrtc/manager.js';

const app = new Hono();
app.use('*', logger());
app.use('*', cors());

// 检查环境：Node (Docker) 还是 Worker (Cloudflare)
const isNode = typeof process !== 'undefined' && process.release && process.release.name === 'node';

// Cloudflare 环境：每个请求前注入 D1 数据库实例
if (!isNode) {
  app.use('*', async (c: any, next) => {
    if (c.env?.DB) {
      await initDB(c.env.DB);
    }
    await next();
  });
}

// 中间件：透传反代后的真实客户端 IP
app.use('*', async (c, next) => {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const realIp = forwarded.split(',')[0].trim();
    // 可以在这里扩展将 realIp 存入 context
  }
  await next();
});

// 动态适配静态资源服务
if (isNode) {
  // Docker/Node 环境：使用 @hono/node-server
  const { serveStatic } = require('@hono/node-server/serve-static');
  app.use('/dashboard/*', serveStatic({
    root: './dist',
    rewriteRequestPath: (path: string) => path.replace(/^\/dashboard/, '')
  }));
} else {
    // Cloudflare 环境：通常静态资源由 Pages 本身托管，无需 Worker 处理
}
app.get('/dashboard', (c) => c.redirect('/dashboard/'));

// 中间件：检查管理员是否已初始化
const setupMiddleware = async (c: any, next: any) => {
  const adminUser = await db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
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

app.get('/dashboard', (c) => c.redirect('/dashboard/'));

// 网关逻辑导出供 Worker 使用
export const gateway = new Hono();
gateway.all('*', async (c, next) => {
    const pathName = c.req.path.split('/')[1];
    // 如果是系统保留路径，跳过网关逻辑，交给后续路由或静态资源
    const reserved = ['api', 'admin-api', 'dashboard', 'setup', 'favicon.ico'];
    if (!pathName || reserved.includes(pathName)) {
        return await next!();
    }

    const mapping = await db.prepare(
            `SELECT p.port, p.user_id, u.api_key
         FROM paths p JOIN users u ON p.user_id = u.id
         WHERE p.name = ? AND p.is_active = 1`
        ).get(pathName) as any;

    if (!mapping) return await next();

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
app.get('/setup', async (c) => {
  const adminUser = await db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
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
  await db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, password, 'admin');
  return c.redirect('/dashboard/');
});

// 自动从环境变量初始化管理员 (仅 Node 环境在启动时执行)
if (isNode) {
  const ADMIN_USER = process.env.ADMIN_USER;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (ADMIN_USER && ADMIN_PASSWORD) {
    const exists = await db.prepare('SELECT id FROM users WHERE username = ?').get(ADMIN_USER);
    if (!exists) {
      await db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(ADMIN_USER, ADMIN_PASSWORD, 'admin');
      console.log(`已从环境变量自动创建管理员: ${ADMIN_USER}`);
    }
  }

  // 初始化默认 WebRTC 服务器配置
  const defaultIceServers = JSON.stringify([
    "stun:stun.cloudflare.com:3478",
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302"
  ]);
  const iceConfig = await db.prepare('SELECT value FROM settings WHERE key = ?').get('webrtc_servers');
  if (!iceConfig) {
    await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('webrtc_servers', defaultIceServers);
  }
}

app.route('/', gateway);


// Cloudflare 环境下的静态资源兜底
if (!isNode) {
    app.notFound(async (c: any) => {
        if (c.env?.ASSETS) {
            return await c.env.ASSETS.fetch(c.req.raw);
        }
        return c.text('Not Found', 404);
    });
}

export default app;

// 如果在 Node 环境下运行
if (isNode) {
    try {
        const { serve } = require('@hono/node-server');
        const DEFAULT_PORT = config.PORT || 52331;
        console.log(`Node.js 服务器启动: http://localhost:${DEFAULT_PORT}`);
        serve({ fetch: app.fetch, port: DEFAULT_PORT as any });
    } catch (e) {
        // 在某些打包环境下可能会报错，此处静默处理
    }
}

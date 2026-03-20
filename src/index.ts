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

// 默认值
const DEFAULT_ADMIN_PATH = config.ADMIN_PATH;
const DEFAULT_PORT = config.PORT;

// 中间件：检查管理员是否已初始化
app.use('*', async (c, next) => {
  const adminUser = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
  const path = c.req.path;
  if (!adminUser && !path.startsWith('/setup') && !path.startsWith('/api/setup')) {
    console.log('未找到管理员，正在重定向到设置页面');
    return c.redirect('/setup');
  }
  await next();
});

// 路由
app.route('/api', api);
app.route('/admin-api', admin);

// 添加全局错误处理
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error('全局错误：', err);
  return c.text('Internal Server Error', 500);
});

// 托管管理后台 UI (Vite 构建)
app.use(`/${DEFAULT_ADMIN_PATH}/*`, serveStatic({ 
  root: './src/dist',
  rewriteRequestPath: (path) => path.replace(new RegExp(`^/${DEFAULT_ADMIN_PATH}`), '') || '/index.html'
}));

// 网关逻辑：将路径映射到客户端
app.all('/:path/*', async (c) => {
  const pathName = c.req.param('path');
  const mapping = db.prepare(
    `SELECT p.port, p.user_id, u.api_key
     FROM paths p JOIN users u ON p.user_id = u.id
     WHERE p.name = ? AND p.is_active = 1`
  ).get(pathName) as { port: number; user_id: number; api_key: string } | undefined;

  if (!mapping) {
    return c.notFound();
  }

  // 通过 API Key 路由到特定用户的 WebRTC 会话
  const sessionId = webrtcManager.getSessionByApiKey(mapping.api_key);
  if (!sessionId) {
    return c.text(`路径 "${pathName}" 的主机未连接`, 503);
  }

  try {
    const fullPath = c.req.path.substring(pathName.length + 1) || '/';
    const bodyBuffer = await c.req.arrayBuffer();
    const bodyBase64 = bodyBuffer.byteLength > 0
      ? Buffer.from(bodyBuffer).toString('base64')
      : undefined;

    const proxyRequest = {
      method: c.req.method,
      path: fullPath,
      headers: c.req.header(),
      query: c.req.query(),
      targetPort: mapping.port,
      body: bodyBase64
    };

    console.log(`[${mapping.api_key.slice(0, 8)}] ${proxyRequest.method} ${proxyRequest.path} -> :${mapping.port}`);
    const response = await webrtcManager.sendRequest(sessionId, proxyRequest);

    return c.newResponse(response.body, response.status, response.headers);
  } catch (err: any) {
    console.error('网关错误：', err.message);
    return c.text(err.message === 'Gateway Timeout' ? 'Host Timeout' : 'Gateway Error', 504);
  }
});

// 首页
app.get('/', (c) => {
  const homeSetting = db.prepare("SELECT value FROM settings WHERE key = 'home_page_mode'").get() as { value: string } | undefined;
  if (homeSetting?.value === 'proxy') {
    // 如果配置了默认代理路径，则重定向
    return c.text('欢迎使用 l2h - 代理模式');
  }
  return c.html('<h1>Welcome to l2h</h1><p>Link to Host 项目</p>');
});

// 设置页面（如果没有管理员）
app.get('/setup', (c) => {
  return c.html(`
    <h1>Setup Admin</h1>
    <form action="/api/setup" method="POST">
      <input name="username" placeholder="Admin Username" required /><br/>
      <input name="password" type="password" placeholder="Admin Password" required /><br/>
      <button type="submit">Initialize</button>
    </form>
  `);
});

app.post('/api/setup', async (c) => {
  const { username, password } = await c.req.parseBody();
  const existing = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
  if (existing) return c.text('Already initialized', 400);

  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, password, 'admin');
  return c.redirect('/');
});

console.log(`服务器已启动：http://localhost:${DEFAULT_PORT}`);
serve({
  fetch: app.fetch,
  port: DEFAULT_PORT
});

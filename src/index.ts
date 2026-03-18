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

// Default values
const DEFAULT_ADMIN_PATH = config.ADMIN_PATH;
const DEFAULT_PORT = config.PORT;

// Middleware to check if admin is initialized
app.use('*', async (c, next) => {
  const adminUser = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
  const path = c.req.path;
  if (!adminUser && !path.startsWith('/setup') && !path.startsWith('/api/setup')) {
    console.log('Redirecting to setup, no admin found');
    return c.redirect('/setup');
  }
  await next();
});

// Routes
app.route('/api', api);
app.route('/admin-api', admin);

// Add Global Error Handler back
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error('Global Error:', err);
  return c.text('Internal Server Error', 500);
});

// Serve Admin UI (Vite build)
app.use(`/${DEFAULT_ADMIN_PATH}/*`, serveStatic({ 
  root: './src/dist',
  rewriteRequestPath: (path) => path.replace(new RegExp(`^/${DEFAULT_ADMIN_PATH}`), '') || '/index.html'
}));

// Gateway Logic for mapping paths to clients
app.all('/:path/*', async (c) => {
  const pathName = c.req.param('path');
  const mapping = db.prepare('SELECT * FROM paths WHERE name = ? AND is_active = 1').get(pathName) as { port: number, user_id: number } | undefined;
  
  if (!mapping) {
    return c.notFound();
  }

  // Find the WebRTC session for the user
  // For now, we use a simple lookup by user's API Key if we have it, 
  // but let's just get the first session for initial testing
  const sessionId = webrtcManager.getFirstSessionId();
  if (!sessionId) {
    return c.text('No active host connected for this path', 503);
  }

  try {
    const fullPath = c.req.path.substring(pathName.length + 1); // Remove /path
    const bodyBuffer = await c.req.arrayBuffer();
    const bodyBase64 = bodyBuffer.byteLength > 0 
      ? Buffer.from(bodyBuffer).toString('base64') 
      : undefined;

    const proxyRequest = {
      method: c.req.method,
      path: fullPath || '/',
      headers: c.req.header(),
      query: c.req.query(),
      targetPort: mapping.port,
      body: bodyBase64
    };

    console.log(`Forwarding request to client: ${proxyRequest.method} ${proxyRequest.path} -> localhost:${mapping.port}`);
    const response = await webrtcManager.sendRequest(sessionId, proxyRequest);

    return c.newResponse(response.body, response.status, response.headers);
  } catch (err: any) {
    console.error('Gateway Error:', err.message);
    return c.text(err.message === 'Gateway Timeout' ? 'Host Timeout' : 'Gateway Error', 504);
  }
});

// Home page
app.get('/', (c) => {
  const homeSetting = db.prepare("SELECT value FROM settings WHERE key = 'home_page_mode'").get() as { value: string } | undefined;
  if (homeSetting?.value === 'proxy') {
    // Redirect to default proxy path if configured
    return c.text('Welcome to l2h - Proxy Mode');
  }
  return c.html('<h1>Welcome to l2h</h1><p>Link to Host Project</p>');
});

// Setup page (if no admin)
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

console.log(`Server started on http://localhost:${DEFAULT_PORT}`);
serve({
  fetch: app.fetch,
  port: DEFAULT_PORT
});

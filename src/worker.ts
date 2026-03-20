import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { admin } from './routes/admin.js';
import { api } from './routes/api.js';
import { gateway } from './index.js'; // Export gateway from index
import { initDB, SCHEMA } from './db/index.js';

const app = new Hono();

// Middleware to initialize D1
app.use('*', async (c: any, next) => {
    if (c.env && (c.env as any).DB) {
        initDB((c.env as any).DB);
    }
    await next();
});

app.route('/api', api);
app.route('/dashboard', admin); // Assuming admin path
app.route('/', gateway);

export default handle(app);

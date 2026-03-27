import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/worker.mjs',
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  // 明确排除所有 Node.js 原生模块和不兼容的包
  external: [
    'node-datachannel',
    'better-sqlite3',
    'bindings',
    '@hono/node-server',
    '@hono/node-server/serve-static',
    'node:*',
    'fs',
    'path',
    'os',
    'crypto',
    'stream',
    'http',
    'http2',
    'events',
    'util',
    'process',
  ],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  logLevel: 'info',
});

console.log('Cloudflare Worker build complete: dist/worker.mjs');

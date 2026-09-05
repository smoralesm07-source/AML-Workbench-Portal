import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || '_site');
const port = Number(process.env.PORT || 4173);
const V2_HOST = 'bzqxvidggykkdouotylg.supabase.co';
const GITHUB_PAGES_ORIGIN = 'https://smoralesm07-source.github.io';
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json; charset=utf-8'], ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'], ['.ico', 'image/x-icon'],
]);

function proxyV2(req, res) {
  const upstreamPath = req.url.replace(/^\/__atlas_v2/, '') || '/';
  const headers = { ...req.headers, host: V2_HOST, origin: GITHUB_PAGES_ORIGIN };
  delete headers['content-length'];
  const upstream = https.request({ hostname: V2_HOST, port: 443, method: req.method, path: upstreamPath, headers }, upstreamRes => {
    const outHeaders = {};
    for (const name of ['content-type', 'cache-control', 'etag', 'x-atlas-trace-id', 'x-atlas-snapshot', 'server-timing']) {
      const value = upstreamRes.headers[name];
      if (value != null) outHeaders[name] = value;
    }
    res.writeHead(upstreamRes.statusCode || 502, outHeaders);
    upstreamRes.pipe(res);
  });
  upstream.on('error', error => {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'V2_PROXY_FAILED', detail: error.message }));
  });
  req.pipe(upstream);
}

function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`).pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'content-type': mime.get(path.extname(file).toLowerCase()) || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/__atlas_v2/')) return proxyV2(req, res);
  return serveStatic(req, res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`ATLAS v2 E2E server listening on http://127.0.0.1:${port} from ${root}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));

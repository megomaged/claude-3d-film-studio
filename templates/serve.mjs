// Localhost-only static server. `node serve.mjs [port]` → live preview at http://127.0.0.1:8080/
// render.mjs imports `handler` from here. ES modules + import maps need http(s); file:// breaks them.
// /assets/* is served from ./assets (put your GLBs there; they are never copied or bundled).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.hdr': 'application/octet-stream',
};

export function handler(root = HERE) {
  return (req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(root, u === '/' ? 'index.html' : u);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = parseInt(process.argv[2] || '8080', 10);
  http.createServer(handler()).listen(port, '127.0.0.1', () => console.log(`live preview: http://127.0.0.1:${port}/`));
}

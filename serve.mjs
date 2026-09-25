/* 로컬 미리보기 서버 — frontend/ 폴더를 그대로 서빙한다.
   실행: node serve.mjs [포트]   기본 5173
   VS Code의 Simple Browser에 http://localhost:5173/ 를 붙여 넣으면 편집기 안에서 보인다. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const ROOT = join(import.meta.dirname, 'frontend');
const PORT = Number(process.argv[2]) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
};

createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(req.url.split('?')[0]);
    /* ROOT 밖으로 빠져나가는 경로는 막는다 */
    let path = normalize(join(ROOT, url));
    if (!path.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }

    let info = await stat(path).catch(() => null);
    if (info?.isDirectory()) { path = join(path, 'index.html'); info = await stat(path).catch(() => null); }
    if (!info) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 ' + url); return; }

    const body = await readFile(path);
    res.writeHead(200, {
      'content-type': TYPES[extname(path).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',          // 고치는 즉시 새로고침으로 반영되게
    }).end(body);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end(String(e));
  }
}).listen(PORT, () => {
  console.log(`미리보기: http://localhost:${PORT}/           (허브)`);
  console.log(`          http://localhost:${PORT}/profile/   (프로필 페이지)`);
  console.log('중지: Ctrl+C');
});

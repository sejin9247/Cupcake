/* 배포용 Redis 저장소가 Upstash REST 명령을 올바르게 보내는지, 가짜 Upstash 서버로 확인한다. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';

const TOKEN = 'test-token';
const data = new Map();   // key → { v, exp }
const seen = [];
const fake = createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; }).on('end', () => {
    if (req.headers.authorization !== `Bearer ${TOKEN}`) { res.writeHead(401).end('{"error":"unauthorized"}'); return; }
    const [cmd, key, ...rest] = JSON.parse(body);
    seen.push(cmd);
    const live = () => { const h = data.get(key); if (h && h.exp && h.exp <= Date.now()) { data.delete(key); return null; } return h ?? null; };
    let result = null;
    if (cmd === 'GET') result = live()?.v ?? null;
    else if (cmd === 'SET') { data.set(key, { v: rest[0], exp: rest[1] === 'EX' ? Date.now() + rest[2] * 1000 : 0 }); result = 'OK'; }
    else if (cmd === 'DEL') result = data.delete(key) ? 1 : 0;
    else if (cmd === 'INCR') { const n = Number(live()?.v ?? 0) + 1; data.set(key, { v: String(n), exp: live()?.exp ?? 0 }); result = n; }
    else if (cmd === 'EXPIRE') { const h = live(); if (h) h.exp = Date.now() + rest[0] * 1000; result = h ? 1 : 0; }
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ result }));
  });
});

let store;
before(async () => {
  fake.listen(0);
  await new Promise(r => fake.once('listening', r));
  process.env.KV_REST_API_URL = `http://localhost:${fake.address().port}`;
  process.env.KV_REST_API_TOKEN = TOKEN;
  ({ store } = await import('../src/store/index.js'));
});
after(() => fake.close());

test('uses Redis when Upstash env vars are present', () => {
  assert.equal(store.kind, 'redis');
  assert.equal(store.persistent, true);
});

test('get/set/del round-trip JSON under the key prefix', async () => {
  await store.set('projects', [{ id: 'a', title: '제목' }]);
  assert.deepEqual(await store.get('projects'), [{ id: 'a', title: '제목' }]);
  assert.ok(data.has('cupcake:projects'));
  await store.del('projects');
  assert.equal(await store.get('projects'), null);
});

test('TTL values expire', async () => {
  await store.set('session:x', { createdAt: 1 }, 1);
  assert.deepEqual(await store.get('session:x'), { createdAt: 1 });
  data.get('cupcake:session:x').exp = Date.now() - 1;
  assert.equal(await store.get('session:x'), null);
});

test('incr counts and sets the window only on the first hit', async () => {
  seen.length = 0;
  assert.equal(await store.incr('loginfail:ip:1', 900), 1);
  assert.equal(await store.incr('loginfail:ip:1', 900), 2);
  assert.deepEqual(seen, ['INCR', 'EXPIRE', 'INCR']);
});

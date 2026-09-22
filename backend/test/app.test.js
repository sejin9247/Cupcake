/* 외부 API를 부르지 않는 범위의 동작만 확인한다: npm test */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';

let server, base;
before(async () => {
  server = createApp().listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

test('GET /api/health', async () => {
  const r = await fetch(`${base}/api/health`);
  assert.equal(r.status, 200);
  const js = await r.json();
  assert.equal(js.ok, true);
  assert.equal(js.db, 'disconnected');
});

test('unknown API route → 404 JSON', async () => {
  const r = await fetch(`${base}/api/nope`);
  assert.equal(r.status, 404);
  assert.match((await r.json()).error.message, /Not found/);
});

test('Nominatim path outside the allow list → 404', async () => {
  const r = await fetch(`${base}/api/geo/nominatim/details`);
  assert.equal(r.status, 404);
});

test('Overpass without a query → 400', async () => {
  const r = await fetch(`${base}/api/overpass`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 400);
});

test('SGIS path outside the allow list → 404', async () => {
  const r = await fetch(`${base}/api/sgis/auth/authentication.json`);
  assert.equal(r.status, 404);
});

test('SGIS without any key → 400 with i18n key', async (t) => {
  const { serverHasSgisKey } = await import('../src/services/sgis.service.js');
  if (serverHasSgisKey()) return t.skip('.env has SGIS keys');
  const r = await fetch(`${base}/api/sgis/addr/stage.json`);
  assert.equal(r.status, 400);
  assert.deepEqual((await r.json()).error.i18n, { k: 'sgis.noKey' });
});

test('CORS preflight allows the SGIS key headers', async () => {
  const r = await fetch(`${base}/api/sgis/test`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:8765', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'x-sgis-key' },
  });
  assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:8765');
  assert.match(r.headers.get('access-control-allow-headers'), /X-SGIS-Key/i);
});

test('serves the frontend', async () => {
  const r = await fetch(`${base}/cbd-dashboard/`);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /api\/index\.js/);
});

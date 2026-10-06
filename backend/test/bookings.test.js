/* 방문 예약 접수 규칙과 알림 메일. 임시 폴더에 저장하고, Resend 호출만 가로채서 확인한다. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, test } from 'node:test';

const dataDir = await mkdtemp(join(tmpdir(), 'cupcake-booking-'));
process.env.DATA_DIR = dataDir;
process.env.BOOKING_MAIL_TO = 'owner@example.test';
process.env.RESEND_API_KEY = 'test_key';
const { createApp } = await import('../src/app.js');

/* Resend로 가는 요청만 붙잡는다. 나머지(테스트 자신의 요청)는 진짜 fetch로 보낸다. */
const realFetch = globalThis.fetch;
let mails = [];
let mailReply = { ok: true, status: 200, json: async () => ({ id: 'msg_test' }) };
globalThis.fetch = async (url, opt) => {
  if (!String(url).includes('api.resend.com')) return realFetch(url, opt);
  mails.push(JSON.parse(opt.body));
  return mailReply;
};

let server, base;
before(async () => {
  server = createApp({ serveFrontend: false }).listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api`;
});
after(async () => {
  server.close();
  globalThis.fetch = realFetch;
  await rm(dataDir, { recursive: true, force: true });
});
beforeEach(() => { mails = []; });

const OK = {
  date: '2026-10-08', time: '15:00', name: '홍길동',
  email: 'guest@example.test', purpose: '졸업 작품 상담', consent: true,
};
const post = async body => {
  const r = await realFetch(`${base}/bookings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const stored = async () => JSON.parse(await readFile(join(dataDir, 'bookings.json'), 'utf8'));

test('예약을 받으면 저장하고 알림 메일을 보낸다', async () => {
  const r = await post(OK);
  assert.equal(r.status, 201);
  assert.equal(r.json.booking.date, '2026-10-08');
  /* 응답에는 이름·이메일·목적을 돌려주지 않는다 */
  assert.deepEqual(Object.keys(r.json.booking).sort(), ['date', 'id', 'time']);

  const [saved] = await stored();
  assert.equal(saved.name, '홍길동');
  assert.equal(saved.status, 'new');
  assert.equal(saved.notified.sent, true);

  assert.equal(mails.length, 1);
  assert.match(mails[0].subject, /2026년 10월 8일 \(목\) 15:00 · 홍길동/);
  assert.deepEqual(mails[0].to, ['owner@example.test']);
  assert.deepEqual(mails[0].reply_to, ['guest@example.test']);   // 답장이 방문자에게 가야 한다
  assert.match(mails[0].text, /졸업 작품 상담/);
});

test('같은 날짜·시간은 두 번 받지 않는다', async () => {
  const r = await post(OK);
  assert.equal(r.status, 409);
  assert.equal(mails.length, 0);
});

test('메일이 실패해도 예약은 남는다', async () => {
  mailReply = { ok: false, status: 422, json: async () => ({ message: 'API key is invalid' }) };
  const r = await post({ ...OK, time: '16:00' });
  mailReply = { ok: true, status: 200, json: async () => ({ id: 'msg_test' }) };

  assert.equal(r.status, 201);
  const saved = (await stored()).find(b => b.time === '16:00');
  assert.equal(saved.notified.sent, false);
  assert.match(saved.notified.error, /invalid/);
});

test('목적이 담긴 HTML은 글자로만 들어간다', async () => {
  await post({ ...OK, time: '16:30', purpose: '<script>alert(1)</script>' });
  assert.equal(mails.length, 1);
  assert.ok(!mails[0].html.includes('<script>'));
  assert.ok(mails[0].html.includes('&lt;script&gt;'));
});

test('빠진 값과 잘못된 값은 거절한다', async () => {
  const bad = [
    [{ ...OK, name: '' }, /이름/],
    [{ ...OK, email: 'guest@' }, /이메일 형식/],
    [{ ...OK, purpose: '   ' }, /방문 목적/],
    [{ ...OK, date: '2026-10-10' }, /주말/],              // 토요일
    [{ ...OK, time: '12:00' }, /희망 시간/],              // 13:00 이전
    [{ ...OK, time: '18:30' }, /희망 시간/],              // 18:00 이후
    [{ ...OK, time: '15:15' }, /희망 시간/],              // 30분 단위가 아님
    [{ ...OK, date: '10/08/2026' }, /방문 날짜/],
    [{ ...OK, consent: false }, /동의/],
    [{ ...OK, purpose: 'ㄱ'.repeat(1001) }, /너무 깁니다/],
  ];
  for (const [body, re] of bad) {
    const r = await post(body);
    assert.equal(r.status, 400, `${JSON.stringify(body).slice(0, 60)} → 400이어야 함 (받은 값 ${r.status})`);
    assert.match(r.json.error.message, re);
  }
  assert.equal(mails.length, 0, '거절된 예약으로는 메일을 보내지 않는다');
});

test('JSON이 아닌 요청은 415', async () => {
  const r = await realFetch(`${base}/bookings`, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'name=홍길동',
  });
  assert.equal(r.status, 415);
});

test('받은 예약 목록은 관리자만 볼 수 있다', async () => {
  const r = await realFetch(`${base}/bookings`);
  assert.equal(r.status, 401);
  assert.match((await r.json()).error.message, /로그인/);
});

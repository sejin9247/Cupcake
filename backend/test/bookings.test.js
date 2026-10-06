/* 방문 예약 — 접수 규칙, 예약 번호 만드는 법, 관리자의 처리 상태 바꾸기.
   임시 폴더와 테스트용 비밀번호로 실행한다. */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { hashPassword } from '../src/utils/password.js';

const PASSWORD = 'booking test password';
const dataDir = await mkdtemp(join(tmpdir(), 'cupcake-booking-'));
process.env.DATA_DIR = dataDir;
process.env.ADMIN_PASSWORD_HASH = await hashPassword(PASSWORD);
const { createApp } = await import('../src/app.js');

let server, base, token = null;
before(async () => {
  server = createApp({ serveFrontend: false }).listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api`;
  token = (await (await fetch(`${base}/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  })).json()).token;
});
after(async () => { server.close(); await rm(dataDir, { recursive: true, force: true }); });

const OK = {
  date: '2026-10-08', time: '15:00', name: '홍길동',
  email: 'guest@example.test', purpose: '졸업 작품 상담', consent: true,
};

const post = async body => {
  const r = await fetch(`${base}/bookings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const admin = async (path, { method = 'GET', body, auth = true } = {}) => {
  const r = await fetch(`${base}/admin${path}`, {
    method,
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(auth && token && { Authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};

test('예약을 받으면 번호를 붙이고 접수 상태로 저장한다', async () => {
  const r = await post(OK);
  assert.equal(r.status, 201);
  /* 번호에 날짜·시간이 보이고, 사람은 네 자리로 줄여 붙는다 */
  assert.match(r.json.booking.no, /^261008-1500-[0-9A-F]{4}$/);

  const { json } = await admin('/bookings');
  assert.equal(json.bookings.length, 1);
  assert.equal(json.bookings[0].status, 'received');
  assert.equal(json.bookings[0].name, '홍길동');
});

test('같은 사람이 같은 시간을 다시 신청하면 거절한다', async () => {
  const r = await post(OK);
  assert.equal(r.status, 409);
  assert.match(r.json.error.message, /이미 접수/);
});

test('같은 사람이 다른 시간이면 번호가 다르고 따로 받는다', async () => {
  const first = (await admin('/bookings')).json.bookings[0].no;
  const r = await post({ ...OK, time: '16:00' });
  assert.equal(r.status, 201);
  assert.notEqual(r.json.booking.no, first);
  /* 사람 부분(뒤 네 자리)은 같고 시간 부분만 다르다 */
  assert.equal(r.json.booking.no.slice(-4), first.slice(-4));
  assert.equal((await admin('/bookings')).json.bookings.length, 2);
});

test('다른 사람이 같은 시간을 신청하는 것은 막지 않는다 (겹침 관리는 나중 일)', async () => {
  const r = await post({ ...OK, name: '김철수', email: 'other@example.test' });
  assert.equal(r.status, 201);
  assert.notEqual(r.json.booking.no.slice(-4), undefined);
  assert.equal((await admin('/bookings')).json.bookings.length, 3);
});

test('방문 희망 시간이 이른 것부터 돌려준다', async () => {
  await post({ ...OK, date: '2026-10-07', time: '13:00' });
  const { bookings } = (await admin('/bookings')).json;
  const keys = bookings.map(b => b.date + ' ' + b.time);
  assert.deepEqual(keys, [...keys].sort());
  assert.equal(keys[0], '2026-10-07 13:00');
});

test('처리 상태를 네 가지로 바꿀 수 있다', async () => {
  const [b] = (await admin('/bookings')).json.bookings;
  for (const s of ['confirmed', 'reschedule', 'cancelled', 'received']) {
    const r = await admin(`/bookings/${b.id}`, { method: 'PATCH', body: { status: s } });
    assert.equal(r.status, 200);
    assert.equal(r.json.booking.status, s);
    assert.equal(r.json.booking.no, b.no, '상태를 바꿔도 예약 번호는 그대로여야 한다');
    assert.equal(r.json.booking.name, b.name, '신청자가 적은 내용은 바뀌지 않아야 한다');
  }
});

test('모르는 상태나 없는 예약은 거절한다', async () => {
  const [b] = (await admin('/bookings')).json.bookings;
  const bad = await admin(`/bookings/${b.id}`, { method: 'PATCH', body: { status: 'done' } });
  assert.equal(bad.status, 400);
  const missing = await admin('/bookings/no-such-id', { method: 'PATCH', body: { status: 'confirmed' } });
  assert.equal(missing.status, 404);
});

test('상태 말고는 고칠 수 없다', async () => {
  const [b] = (await admin('/bookings')).json.bookings;
  const r = await admin(`/bookings/${b.id}`, {
    method: 'PATCH', body: { status: 'confirmed', name: '바뀐이름', email: 'hack@example.test', purpose: '바뀐목적' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.booking.name, b.name);
  assert.equal(r.json.booking.email, b.email);
  assert.equal(r.json.booking.purpose, b.purpose);
});

test('예약 목록과 상태 바꾸기는 로그인해야 쓸 수 있다', async () => {
  const [b] = (await admin('/bookings')).json.bookings;
  assert.equal((await admin('/bookings', { auth: false })).status, 401);
  assert.equal((await admin(`/bookings/${b.id}`, { method: 'PATCH', body: { status: 'confirmed' }, auth: false })).status, 401);
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
});

test('JSON이 아닌 요청은 415', async () => {
  const r = await fetch(`${base}/bookings`, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'name=홍길동',
  });
  assert.equal(r.status, 415);
});

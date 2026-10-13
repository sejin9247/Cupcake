/* 진짜 Supabase 표를 상대로 하는 시험.
   .env에 SUPABASE_* 가 없으면 통째로 건너뛴다 (CI·다른 사람 컴퓨터에서 깨지지 않게).

   다른 시험과 달리 진짜 데이터베이스에 쓴다. 그래서
   - 2099년 날짜만 쓴다. 실제 예약과 절대 겹치지 않는다.
   - 끝나면 넣은 줄을 모두 지운다 (실패해도 지운다). */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

const skip = !(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
  && 'SUPABASE_URL · SUPABASE_SECRET_KEY 가 없어 건너뜁니다';

const { createIfFree, list, setStatus, takenSlots } = skip ? {} : await import('../src/repositories/booking.repository.js');
const { db } = skip ? {} : await import('../src/db/supabase.js');

const DATE = '2099-03-04';          // 시험 전용 — 실제 예약이 있을 수 없는 날
const MARK = '시험용-지워도-됨';

const wipe = async () => { if (!skip) await db.remove('bookings', `visit_date=eq.${DATE}`); };

before(wipe);
after(wipe);

const make = (time, name) => ({
  name, email: `${name}@example.test`, purpose: MARK,
  date: DATE, time, consent: true,
});

test('예약을 넣으면 번호가 붙고 접수 상태가 된다', { skip }, async () => {
  const b = await createIfFree(make('13:00', '가'));
  assert.ok(b, '예약이 들어가야 한다');
  assert.match(b.no, /^990304-1300-[0-9A-F]{4}$/);
  assert.equal(b.status, 'received');
  assert.equal(b.date, DATE);
  assert.equal(b.time, '13:00', '시간은 HH:MM 으로 돌아와야 한다');
  assert.equal(b.purpose, MARK);
});

test('같은 자리는 다른 사람도 못 넣는다 — 막는 것은 데이터베이스다', { skip }, async () => {
  assert.equal(await createIfFree(make('13:00', '나')), null);
  assert.equal(await createIfFree(make('13:00', '가')), null);
});

test('같은 자리로 동시에 열 건이 들어와도 한 건만 남는다', { skip }, async () => {
  const got = await Promise.all(
    Array.from({ length: 10 }, (_, i) => createIfFree(make('14:00', `동시${i}`))),
  );
  assert.equal(got.filter(Boolean).length, 1, '한 건만 들어가야 한다');

  const rows = await db.select('bookings', `select=id&visit_date=eq.${DATE}&visit_time=eq.14:00`);
  assert.equal(rows.length, 1, '표에도 한 줄만 있어야 한다');
});

test('취소하면 자리가 비고, 다시 넣으면 번호 뒤에 숫자가 붙는다', { skip }, async () => {
  const first = await createIfFree(make('15:00', '다'));
  assert.ok(first);
  assert.equal(await createIfFree(make('15:00', '라')), null);

  const cancelled = await setStatus(first.id, 'cancelled');
  assert.equal(cancelled.status, 'cancelled');

  const again = await createIfFree(make('15:00', '다'));          // 같은 사람 · 같은 자리
  assert.ok(again, '취소된 자리는 다시 받아야 한다');
  assert.equal(again.no, first.no + '-2', '번호가 겹치지 않게 뒤에 숫자가 붙어야 한다');
});

test("'변경 요청'은 자리를 계속 잡고 있다", { skip }, async () => {
  const b = await createIfFree(make('16:00', '마'));
  await setStatus(b.id, 'reschedule');
  assert.equal(await createIfFree(make('16:00', '바')), null);
});

test('빈자리 목록에는 취소된 자리가 빠진다', { skip }, async () => {
  const slots = (await takenSlots(DATE)).filter(s => s.date === DATE).map(s => s.time);
  assert.ok(slots.includes('13:00'));
  assert.ok(slots.includes('15:00'), '취소 뒤 다시 예약한 자리는 들어 있어야 한다');
  assert.ok(slots.includes('16:00'), '변경 요청은 자리를 잡고 있어야 한다');
  /* 취소만 된 자리는 없어야 한다 — 위에서 모두 다시 채웠으므로 시간은 전부 살아 있다 */
  assert.equal(new Set(slots).size, slots.length, '같은 시간이 두 번 나오면 안 된다');
});

test('목록은 방문 시각이 이른 것부터 나온다', { skip }, async () => {
  const mine = (await list()).filter(b => b.date === DATE);
  const keys = mine.map(b => b.time);
  assert.deepEqual(keys, [...keys].sort(), '시간 순서대로여야 한다');
  assert.ok(mine.every(b => b.no && b.name && b.status), '모양이 예전과 같아야 한다');
});

test('없는 예약의 상태는 바꿀 수 없다', { skip }, async () => {
  assert.equal(await setStatus('00000000-0000-0000-0000-000000000000', 'confirmed'), null);
});

/* ───── 아래 둘은 라우트를 거쳐, DB에서 읽은 규칙으로 막히는지 본다 ───── */

test('규칙과 공휴일을 DB에서 읽어 내려준다', { skip }, async () => {
  const { createApp } = await import('../src/app.js');
  const server = createApp({ serveFrontend: false }).listen(0);
  await new Promise(r => server.once('listening', r));
  try {
    const js = await (await fetch(`http://localhost:${server.address().port}/api/bookings/rules`)).json();
    assert.equal(js.times.length, 11);
    assert.ok(js.holidays.length >= 30, `공휴일이 DB에서 와야 한다 (받은 수 ${js.holidays.length})`);
    assert.ok(js.holidays.some(h => h.name.includes('설날')), '설날이 들어 있어야 한다');
  } finally { server.close(); }
});

test('공휴일에는 서버가 접수를 거절한다 — 화면을 건너뛰어도 막힌다', { skip }, async () => {
  const { createApp } = await import('../src/app.js');
  const server = createApp({ serveFrontend: false }).listen(0);
  await new Promise(r => server.once('listening', r));
  try {
    const base = `http://localhost:${server.address().port}/api`;
    const holidays = await (await fetch(`${base}/bookings/rules`)).json();
    /* 평일에 오는 공휴일을 하나 고른다 (주말이면 주말 때문에 막혀서 공휴일 검사를 확인할 수 없다) */
    const weekday = holidays.holidays.find(h => {
      const d = new Date(h.date + 'T00:00:00+09:00').getUTCDay();
      return d !== 0 && d !== 6;
    });
    assert.ok(weekday, '평일 공휴일이 있어야 한다');

    const r = await fetch(`${base}/bookings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: weekday.date, time: '14:00', name: '공휴일시험',
        email: 'holiday@example.test', purpose: MARK, consent: true,
      }),
    });
    assert.equal(r.status, 400);
    assert.match((await r.json()).error.message, new RegExp(weekday.name.slice(0, 2)));
  } finally { server.close(); }
});

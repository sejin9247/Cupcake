/* 방문 예약 저장소.

   열쇠가 설정돼 있으면 Supabase의 bookings 표를 쓴다.
   없으면 예전처럼 키-값 저장소에 배열로 담는다 (로컬 작업과 테스트용).

   바깥(라우트·관리자 화면)이 보는 모양은 양쪽이 같다:
     { id, no, name, email, purpose, date, time, consent, status, createdAt, statusAt }
   표의 칸 이름은 visit_date·booking_no처럼 다르므로 여기서 바꿔 준다. */
import { createHash, randomUUID } from 'node:crypto';
import { DbConflict, db, enabled } from '../db/supabase.js';
import { store } from '../store/index.js';

/* 처리 상태 — 화면의 네 가지 버튼과 같은 순서 */
export const STATUSES = ['received', 'confirmed', 'reschedule', 'cancelled'];

/* 그 시간을 붙잡고 있는 예약인지. 취소된 예약은 자리를 비워 주고,
   '변경 요청'은 아직 다른 시간이 정해지지 않았으므로 자리를 계속 잡고 있다. */
const holdsSlot = b => b.status !== 'cancelled';

/* 예약 번호 — 날짜·시간 + 신청자에서 만든다.
   사람만으로 만들지 않는 이유: 한 사람이 여러 번 방문할 수 있다.
   예: 261008-1500-7A3C */
export function bookingNo({ name, email, date, time }) {
  const who = createHash('sha256')
    .update(`${String(email).trim().toLowerCase()}|${String(name).trim()}`)
    .digest('hex').slice(0, 4).toUpperCase();
  return `${date.slice(2).replaceAll('-', '')}-${time.replace(':', '')}-${who}`;
}

/* ───────────────────────── Supabase 쪽 ───────────────────────── */

const HHMM = t => String(t).slice(0, 5);          // '15:00:00' → '15:00'

const fromRow = r => ({
  id: r.id,
  no: r.booking_no,
  name: r.name,
  email: r.email,
  purpose: r.purpose,
  date: r.visit_date,
  time: HHMM(r.visit_time),
  consent: r.consent,
  status: r.status,
  createdAt: r.created_at,
  statusAt: r.status_at,
});

const sb = {
  async list() {
    const rows = await db.select('bookings',
      'select=*&order=visit_date.asc,visit_time.asc,created_at.asc');
    return rows.map(fromRow);
  },

  async createIfFree(data) {
    const base = bookingNo(data);
    /* 취소된 예약과 같은 자리를 같은 사람이 다시 잡으면 번호가 겹친다 — 뒤에 번호를 붙여 구분한다 */
    for (let n = 1; n <= 20; n++) {
      const booking_no = n === 1 ? base : `${base}-${n}`;
      try {
        const row = await db.insert('bookings', {
          booking_no,
          name: data.name,
          email: data.email,
          purpose: data.purpose,
          visit_date: data.date,
          visit_time: data.time,
          consent: data.consent === true,
        });
        return fromRow(row);
      } catch (e) {
        if (!(e instanceof DbConflict)) throw e;
        /* 자리가 찬 것이면 포기한다. 번호만 겹친 것이면 다음 번호로 다시 시도한다. */
        if (e.constraint.includes('one_per_slot')) return null;
        if (!e.constraint.includes('booking_no')) throw e;
      }
    }
    return null;
  },

  async setStatus(id, status) {
    const row = await db.update('bookings', `id=eq.${encodeURIComponent(id)}`, {
      status, status_at: new Date().toISOString(),
    });
    return row ? fromRow(row) : null;
  },

  async takenSlots(from) {
    const rows = await db.select('booked_slots',
      `select=visit_date,visit_time&visit_date=gte.${from}&order=visit_date.asc,visit_time.asc`);
    return rows.map(r => ({ date: r.visit_date, time: HHMM(r.visit_time) }));
  },
};

/* ───────────────────────── 예전 저장소 쪽 (로컬·테스트) ───────────────────────── */

const KEY = 'bookings';
let queue = Promise.resolve();   // 읽고-고치고-쓰기를 한 줄로 세워 서로 덮어쓰지 않게 한다
const readAll = async () => (await store.get(KEY)) ?? [];

function mutate(fn) {
  const run = queue.catch(() => {}).then(async () => {
    const items = await readAll();
    const result = fn(items);
    await store.set(KEY, items);
    return result;
  });
  queue = run;
  return run;
}

const sameSlot = (b, date, time) => b.date === date && b.time === time;

const kv = {
  async list() {
    return (await readAll()).sort((a, b) =>
      (a.date + a.time).localeCompare(b.date + b.time) || a.createdAt.localeCompare(b.createdAt));
  },

  createIfFree(data) {
    return mutate(items => {
      if (items.some(b => sameSlot(b, data.date, data.time) && holdsSlot(b))) return null;
      const base = bookingNo(data);
      let no = base;
      for (let n = 2; items.some(b => b.no === no); n++) no = `${base}-${n}`;
      const now = new Date().toISOString();
      const item = { id: randomUUID(), no, ...data, status: 'received', createdAt: now, statusAt: now };
      items.push(item);
      return item;
    });
  },

  setStatus(id, status) {
    return mutate(items => {
      const i = items.findIndex(b => b.id === id);
      if (i < 0) return null;
      items[i] = { ...items[i], status, statusAt: new Date().toISOString() };
      return items[i];
    });
  },

  async takenSlots(from) {
    const seen = new Set();
    for (const b of await readAll()) {
      if (holdsSlot(b) && b.date >= from) seen.add(b.date + ' ' + b.time);
    }
    return [...seen].sort().map(k => {
      const [date, time] = k.split(' ');
      return { date, time };
    });
  },
};

/* ───────────────────────── 바깥에 내보내는 것 ───────────────────────── */

const impl = enabled ? sb : kv;

export const list = (...a) => impl.list(...a);
export const createIfFree = (...a) => impl.createIfFree(...a);
export const setStatus = (...a) => impl.setStatus(...a);
export const takenSlots = (...a) => impl.takenSlots(...a);

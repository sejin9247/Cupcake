/* 방문 예약 저장소 — 저장소(store)의 'bookings' 문서 하나에 배열로 보관한다.
   로컬: backend/data/bookings.json · 배포: Redis
   project.repository.js와 같은 모양이라, DB를 붙일 때 이 파일만 바꾸면 된다. */
import { createHash, randomUUID } from 'node:crypto';
import { store } from '../store/index.js';

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

/* 처리 상태 — 화면의 네 가지 버튼과 같은 순서 */
export const STATUSES = ['received', 'confirmed', 'reschedule', 'cancelled'];

/* 그 시간을 붙잡고 있는 예약인지. 취소된 예약은 자리를 비워 주고,
   '변경 요청'은 아직 다른 시간이 정해지지 않았으므로 자리를 계속 잡고 있다. */
const holdsSlot = b => b.status !== 'cancelled';
const sameSlot = (b, date, time) => b.date === date && b.time === time;

/* 예약 번호 — 날짜·시간 + 신청자에서 만든다.
   사람만으로 만들지 않는 이유: 한 사람이 여러 번 방문할 수 있다.
   예: 261008-1500-7A3C */
export function bookingNo({ name, email, date, time }) {
  const who = createHash('sha256')
    .update(`${String(email).trim().toLowerCase()}|${String(name).trim()}`)
    .digest('hex').slice(0, 4).toUpperCase();
  return `${date.slice(2).replaceAll('-', '')}-${time.replace(':', '')}-${who}`;
}

/* 방문 시각이 이른 것부터 — 관리자 화면에서 일정표처럼 읽히게 */
export async function list() {
  return (await readAll()).sort((a, b) =>
    (a.date + a.time).localeCompare(b.date + b.time) || a.createdAt.localeCompare(b.createdAt));
}

/* 자리가 비어 있을 때만 저장한다. 이미 차 있으면 null.
   확인과 저장을 한 묶음(mutate) 안에서 하는 이유: 따로 하면 동시에 들어온 두 요청이
   둘 다 '비어 있다'고 보고 지나가 같은 시간에 두 건이 생긴다. */
export function createIfFree(data) {
  return mutate(items => {
    if (items.some(b => sameSlot(b, data.date, data.time) && holdsSlot(b))) return null;

    /* 취소된 예약과 같은 자리를 같은 사람이 다시 잡으면 번호가 겹친다 — 뒤에 번호를 붙여 구분한다 */
    const base = bookingNo(data);
    let no = base;
    for (let n = 2; items.some(b => b.no === no); n++) no = `${base}-${n}`;

    const now = new Date().toISOString();
    const item = { id: randomUUID(), no, ...data, status: 'received', createdAt: now, statusAt: now };
    items.push(item);
    return item;
  });
}

/* 처리 상태만 바꾼다 — 신청자가 적은 내용은 고치지 않는다 */
export function setStatus(id, status) {
  return mutate(items => {
    const i = items.findIndex(b => b.id === id);
    if (i < 0) return null;
    items[i] = { ...items[i], status, statusAt: new Date().toISOString() };
    return items[i];
  });
}

/* 예약 페이지가 고를 수 없는 자리를 표시하는 데 쓴다.
   누가 예약했는지는 알려주지 않는다 — 날짜와 시간만 나간다.
   from 이전(지난 날짜)은 어차피 달력에서 막히므로 빼서 양을 줄인다. */
export async function takenSlots(from) {
  const seen = new Set();
  for (const b of await readAll()) {
    if (holdsSlot(b) && b.date >= from) seen.add(b.date + ' ' + b.time);
  }
  return [...seen].sort().map(k => {
    const [date, time] = k.split(' ');
    return { date, time };
  });
}

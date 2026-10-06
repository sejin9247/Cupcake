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

/* 예약 번호 — 날짜·시간 + 신청자에서 만든다.
   사람만으로 만들지 않는 이유: 한 사람이 여러 번 방문할 수 있다.
   같은 사람이 같은 시간을 다시 신청하면 같은 번호가 나오므로, 그게 중복 판단 기준이 된다.
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

export async function findByNo(no) {
  return (await readAll()).find(b => b.no === no) ?? null;
}

export function create(data) {
  return mutate(items => {
    const item = {
      id: randomUUID(),
      no: bookingNo(data),
      ...data,
      status: 'received',
      createdAt: new Date().toISOString(),
      statusAt: new Date().toISOString(),
    };
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

/* 같은 날짜·시간에 이미 받은 예약이 있는지 — 겹침 관리는 나중에 쓸 자리 */
export async function takenAt(date, time) {
  return (await readAll()).some(b => b.date === date && b.time === time && b.status !== 'cancelled');
}

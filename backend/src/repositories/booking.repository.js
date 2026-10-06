/* 방문 예약 저장소 — 저장소(store)의 'bookings' 문서 하나에 배열로 보관한다.
   로컬: backend/data/bookings.json · 배포: Redis
   project.repository.js와 같은 모양이라, DB를 붙일 때 이 파일만 바꾸면 된다. */
import { randomUUID } from 'node:crypto';
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

export async function list() {
  return (await readAll()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function create(data) {
  return mutate(items => {
    const item = { id: randomUUID(), ...data, status: 'new', createdAt: new Date().toISOString() };
    items.push(item);
    return item;
  });
}

/* 알림 메일 결과를 예약에 적어 둔다 — 나중에 '메일이 안 간 예약'을 찾을 수 있게 */
export function markNotified(id, result) {
  return mutate(items => {
    const item = items.find(b => b.id === id);
    if (item) item.notified = result;
    return item ?? null;
  });
}

/* 같은 날짜·시간에 이미 받은 예약이 있는지 */
export async function takenAt(date, time) {
  return (await readAll()).some(b => b.date === date && b.time === time);
}

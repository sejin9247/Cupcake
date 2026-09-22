/* 프로젝트 저장소 — 저장소(store)의 'projects' 문서 하나에 배열로 보관한다.
   로컬: backend/data/projects.json · 배포: Redis
   DB를 붙일 때는 이 파일만 같은 함수 모양(list/get/create/update/remove, 모두 async)으로 바꾸면 된다.
   예: list() → SELECT * FROM projects ORDER BY created_at DESC */
import { randomUUID } from 'node:crypto';
import { store } from '../store/index.js';

const KEY = 'projects';
let queue = Promise.resolve();   // 읽고-고치고-쓰는 작업을 한 줄로 세워 서로 덮어쓰지 않게 한다

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

export async function get(id) {
  return (await readAll()).find(p => p.id === id) ?? null;
}

export function create(data) {
  return mutate(items => {
    const now = new Date().toISOString();
    const item = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    items.push(item);
    return item;
  });
}

export function update(id, data) {
  return mutate(items => {
    const i = items.findIndex(p => p.id === id);
    if (i < 0) return null;
    items[i] = { ...items[i], ...data, id, updatedAt: new Date().toISOString() };
    return items[i];
  });
}

export function remove(id) {
  return mutate(items => {
    const i = items.findIndex(p => p.id === id);
    if (i < 0) return false;
    items.splice(i, 1);
    return true;
  });
}

/* 작업물 저장소.

   열쇠가 설정돼 있으면 Supabase의 projects 표를 쓴다.
   없으면 예전처럼 키-값 저장소에 배열로 담는다 (로컬 작업과 테스트용).

   바깥(project.service.js)이 보는 모양은 양쪽이 같다:
     { id, title, role, description, date, members, notes, status, createdAt, updatedAt }
   표에는 공개 여부가 is_public(참/거짓)이고 바깥은 status('draft'|'published')라서 여기서 바꿔 준다. */
import { randomUUID } from 'node:crypto';
import { db, enabled } from '../db/supabase.js';
import { store } from '../store/index.js';

/* ───────────────────────── Supabase 쪽 ───────────────────────── */

const fromRow = r => ({
  id: r.id,
  title: r.title ?? '',
  role: r.role ?? '',
  description: r.description ?? '',
  date: r.period ?? '',
  members: r.members ?? null,
  notes: r.notes ?? '',
  status: r.is_public ? 'published' : 'draft',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/* 표에는 slug가 반드시 있어야 한다(주소에 쓰는 짧은 이름).
   제목에서 만들되, 한글 제목이면 글자가 남지 않으므로 그때는 임의의 짧은 값을 쓴다. */
function makeSlug(title, id) {
  const base = String(title ?? '').toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .trim().replace(/\s+/g, '-').slice(0, 40);
  return base || 'p-' + String(id ?? randomUUID()).slice(0, 8);
}

const toRow = (data, id) => ({
  ...(data.title !== undefined && { title: data.title || '제목 없음' }),
  ...(data.role !== undefined && { role: data.role || null }),
  ...(data.description !== undefined && { description: data.description || null }),
  ...(data.date !== undefined && { period: data.date || null }),
  ...(data.members !== undefined && { members: data.members ?? null }),
  ...(data.notes !== undefined && { notes: data.notes || null }),
  ...(data.status !== undefined && { is_public: data.status === 'published' }),
  ...(id === undefined && { slug: makeSlug(data.title, undefined) }),
});

const sb = {
  async list() {
    const rows = await db.select('projects', 'select=*&order=created_at.desc');
    return rows.map(fromRow);
  },

  async get(id) {
    const rows = await db.select('projects', `select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
    return rows[0] ? fromRow(rows[0]) : null;
  },

  async create(data) {
    /* slug는 유일해야 한다 — 같은 제목이 또 들어오면 뒤에 숫자를 붙인다 */
    const base = makeSlug(data.title);
    for (let n = 1; n <= 20; n++) {
      const row = { ...toRow(data), slug: n === 1 ? base : `${base}-${n}` };
      try {
        return fromRow(await db.insert('projects', row));
      } catch (e) {
        if (!String(e?.constraint ?? '').includes('slug')) throw e;
      }
    }
    throw new Error('slug를 만들지 못했습니다');
  },

  async update(id, data) {
    const row = await db.update('projects', `id=eq.${encodeURIComponent(id)}`, toRow(data, id));
    return row ? fromRow(row) : null;
  },

  async remove(id) {
    const before = await sb.get(id);
    if (!before) return false;
    await db.remove('projects', `id=eq.${encodeURIComponent(id)}`);
    return true;
  },
};

/* ───────────────────────── 예전 저장소 쪽 (로컬·테스트) ───────────────────────── */

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

const kv = {
  async list() {
    return (await readAll()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async get(id) {
    return (await readAll()).find(p => p.id === id) ?? null;
  },

  create(data) {
    return mutate(items => {
      const now = new Date().toISOString();
      const item = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
      items.push(item);
      return item;
    });
  },

  update(id, data) {
    return mutate(items => {
      const i = items.findIndex(p => p.id === id);
      if (i < 0) return null;
      items[i] = { ...items[i], ...data, id, updatedAt: new Date().toISOString() };
      return items[i];
    });
  },

  remove(id) {
    return mutate(items => {
      const i = items.findIndex(p => p.id === id);
      if (i < 0) return false;
      items.splice(i, 1);
      return true;
    });
  },
};

/* ───────────────────────── 바깥에 내보내는 것 ───────────────────────── */

const impl = enabled ? sb : kv;

export const list = (...a) => impl.list(...a);
export const get = (...a) => impl.get(...a);
export const create = (...a) => impl.create(...a);
export const update = (...a) => impl.update(...a);
export const remove = (...a) => impl.remove(...a);

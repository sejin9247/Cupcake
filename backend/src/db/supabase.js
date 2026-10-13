/* Supabase 표를 다루는 얇은 도구.
   라이브러리를 붙이지 않고 REST만 쓴다 — 하는 일이 네 가지뿐이라 의존성을 늘릴 이유가 없다.

   비밀 열쇠(service_role)로 부르므로 줄 단위 잠금을 지나간다. 서버에서만 쓴다. */
import { config } from '../config/index.js';
import { HttpError } from '../utils/httpError.js';

const { url, secretKey } = config.supabase;

/** 열쇠가 설정돼 있으면 true. 없으면 예전 저장소(파일·메모리)로 돌아간다. */
export const enabled = !!(url && secretKey);

const base = (url || '').replace(/\/+$/, '') + '/rest/v1';
const headers = {
  apikey: secretKey,
  Authorization: `Bearer ${secretKey}`,
  'Content-Type': 'application/json',
};

/* Postgres가 '규칙을 어겼다'고 돌려주는 오류를 알아보기 쉽게 감싼다 */
export class DbConflict extends Error {
  constructor(detail) {
    super(detail?.message || '중복');
    this.constraint = String(detail?.message || '') + ' ' + String(detail?.details || '');
  }
}

async function call(path, init = {}) {
  if (!enabled) throw new HttpError(503, 'Supabase가 설정되지 않았습니다 (.env의 SUPABASE_URL · SUPABASE_SECRET_KEY).');
  let r;
  try {
    r = await fetch(base + path, { ...init, headers: { ...headers, ...init.headers } });
  } catch (e) {
    throw new HttpError(503, `데이터베이스에 연결할 수 없습니다. (${e.message})`);
  }

  const text = await r.text();
  let body = null;
  if (text) { try { body = JSON.parse(text); } catch { body = null; } }

  if (!r.ok) {
    /* 23505 = 유일 조건 위반 (같은 자리에 두 번째 예약 등) */
    if (body?.code === '23505') throw new DbConflict(body);
    throw new HttpError(503, `데이터베이스 요청이 거절됐습니다 (${r.status}). ${text.slice(0, 200)}`);
  }
  return body;
}

export const db = {
  /** select — 예: db.select('bookings', 'select=*&order=visit_date.asc') */
  select: (table, query = 'select=*') => call(`/${table}?${query}`),

  /** insert — 돌려받은 줄을 준다 */
  async insert(table, row, query = '') {
    const rows = await call(`/${table}${query ? '?' + query : ''}`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
    return Array.isArray(rows) ? rows[0] : rows;
  },

  /** update — 조건에 맞는 줄을 고치고 첫 줄을 돌려준다 */
  async update(table, query, patch) {
    const rows = await call(`/${table}?${query}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    return Array.isArray(rows) ? rows[0] ?? null : rows;
  },

  /** delete */
  remove: (table, query) => call(`/${table}?${query}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  }),
};

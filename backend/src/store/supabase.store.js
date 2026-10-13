/* Supabase(Postgres)로 받치는 키-값 저장소.
   Redis가 하던 일을 그대로 받는다 — get · set · del · incr, 모두 async.
   호출하는 쪽(auth.service.js 등)은 어느 저장소인지 몰라도 되게 모양을 맞췄다.

   값은 public.kv 표의 한 줄이고, 만료 시각이 지난 줄은 없는 것으로 다룬다.
   횟수 세기는 한 문장 안에서 더해야 동시 요청이 서로 덮어쓰지 않으므로 kv_incr 함수에 맡긴다. */
import { HttpError } from '../utils/httpError.js';

const TABLE = 'kv';

export function createSupabaseStore({ url, secretKey }) {
  const base = url.replace(/\/+$/, '') + '/rest/v1';
  const headers = {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
  };

  async function call(path, init = {}) {
    let r;
    try {
      r = await fetch(base + path, { ...init, headers: { ...headers, ...init.headers } });
    } catch (e) {
      throw new HttpError(503, `데이터베이스에 연결할 수 없습니다. (${e.message})`);
    }
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      /* 프로젝트가 멈춰 있으면 여기서 걸린다 — 무료 등급은 한동안 쓰지 않으면 정지한다 */
      throw new HttpError(503, `데이터베이스 요청이 거절됐습니다 (${r.status}). ${body.slice(0, 200)}`);
    }
    /* return=minimal 로 보낸 요청은 201에 빈 본문이 온다 — 그대로 JSON으로 읽으면 깨진다 */
    const text = await r.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  return {
    kind: 'supabase',
    persistent: true,

    async get(key) {
      const rows = await call(
        `/${TABLE}?select=value,expires_at&key=eq.${encodeURIComponent(key)}&limit=1`,
      );
      const row = rows?.[0];
      if (!row) return null;
      /* 만료된 줄은 없는 것으로 본다. 지우는 것은 다음 쓰기나 청소에 맡긴다 */
      if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return null;
      return row.value ?? null;
    },

    async set(key, value, ttlSec) {
      const expires_at = ttlSec ? new Date(Date.now() + ttlSec * 1000).toISOString() : null;
      await call(`/${TABLE}?on_conflict=key`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key, value, expires_at, updated_at: new Date().toISOString() }),
      });
    },

    async del(key) {
      await call(`/${TABLE}?key=eq.${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
    },

    async incr(key, ttlSec) {
      const n = await call('/rpc/kv_incr', {
        method: 'POST',
        body: JSON.stringify({ p_key: key, p_window_sec: ttlSec }),
      });
      return Number(n);
    },
  };
}

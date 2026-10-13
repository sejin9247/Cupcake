/* 방문 규칙 — 몇 시부터 몇 시까지, 몇 분 단위로, 평일만 받는지.

   예약 페이지의 드롭다운과 서버의 검사가 같은 값을 봐야 한다.
   따로 적어 두면 한쪽만 고쳐져서, 화면에는 보이는데 서버가 거절하는 시간이 생긴다.

   DB를 못 읽으면 아래 기본값을 쓴다. 규칙이 없다고 아무 시간이나 받으면 안 되므로
   '열지 않는다'가 아니라 '지금까지 쓰던 값'으로 돌아간다. */
import { db, enabled } from '../db/supabase.js';

export const FALLBACK = Object.freeze({
  openFrom: '13:00',
  openTo: '18:00',
  slotMinutes: 30,
  weekdaysOnly: true,
});

const HHMM = t => String(t ?? '').slice(0, 5);

let cache = null;
let cachedAt = 0;
const TTL_MS = 60_000;          // 1분 — 매 요청마다 DB를 부르지 않는다

/** { openFrom, openTo, slotMinutes, weekdaysOnly, times[] } */
export async function rules() {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;

  let got = FALLBACK;
  if (enabled) {
    try {
      const rows = await db.select('visit_info',
        'select=open_from,open_to,slot_minutes,weekdays_only&is_public=is.true&limit=1');
      const r = rows[0];
      if (r) {
        got = {
          openFrom: HHMM(r.open_from) || FALLBACK.openFrom,
          openTo: HHMM(r.open_to) || FALLBACK.openTo,
          slotMinutes: Number(r.slot_minutes) > 0 ? Number(r.slot_minutes) : FALLBACK.slotMinutes,
          weekdaysOnly: r.weekdays_only !== false,
        };
      }
    } catch (e) {
      console.warn('[방문 규칙] DB에서 읽지 못해 기본값을 씁니다:', e.message);
    }
  }

  cache = { ...got, times: slotsOf(got) };
  cachedAt = Date.now();
  return cache;
}

/** 규칙에서 고를 수 있는 시간 목록을 만든다 — 화면과 서버가 같은 함수를 쓴다 */
export function slotsOf({ openFrom, openTo, slotMinutes }) {
  const min = s => {
    const [h, m] = String(s).split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const pad = n => String(n).padStart(2, '0');
  const out = [];
  const step = slotMinutes > 0 ? slotMinutes : 30;
  for (let t = min(openFrom); t <= min(openTo); t += step) {
    out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return out;
}

/** 캐시를 버린다 (DB에서 규칙을 바꾼 직후 바로 반영하고 싶을 때) */
export function forget() {
  cache = null;
  cachedAt = 0;
}

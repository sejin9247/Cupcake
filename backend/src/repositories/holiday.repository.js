/* 공휴일 저장소 — 예약을 받지 않는 날.

   Supabase가 설정돼 있으면 holidays 표에서 읽는다.
   없으면 빈 목록을 돌려준다 — 그러면 화면이 페이지에 딸린 holidays.js로 돌아간다.
   (공휴일이 뚫리는 것보다 낫다) */
import { db, enabled } from '../db/supabase.js';

/** [{ date: '2026-10-09', name: '한글날' }, …] — 공개로 표시한 날만 */
export async function list() {
  if (!enabled) return [];
  const rows = await db.select('holidays', 'select=on_date,name&is_public=is.true&order=on_date.asc');
  return rows.map(r => ({ date: r.on_date, name: r.name }));
}

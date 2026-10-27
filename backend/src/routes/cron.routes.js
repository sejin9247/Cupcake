/* GET /api/cron/keepalive — Supabase 무료 프로젝트를 깨워 둔다.

   무료 등급은 일주일 동안 DB 요청이 적으면 프로젝트를 일시정지한다. 멈추면 방문 예약 저장,
   관리자 로그인(세션이 kv 표에 있다), 같은 프로젝트를 쓰는 근거노트가 한꺼번에 멈춘다.
   Supabase 안내로는 "매일 요청이 몇 번씩 있으면" 정지되지 않으므로, Vercel Cron이 하루 두 번
   부르고 그때마다 읽기 두 번과 쓰기 한 번을 실제로 한다. */
import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config/index.js';
import { db, enabled } from '../db/supabase.js';
import { store } from '../store/index.js';
import { HttpError } from '../utils/httpError.js';

export const cronRouter = Router();

const KEEP_SEC = 14 * 24 * 3600;   // 마지막으로 깨운 기록은 2주 동안 남긴다

/* Vercel이 보낸 요청인지 — CRON_SECRET이 없으면 아무도 부를 수 없다 */
function fromVercelCron(req) {
  if (!config.cron.secret) return false;
  const got = Buffer.from(req.get('authorization') || '');
  const want = Buffer.from(`Bearer ${config.cron.secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

cronRouter.get('/keepalive', async (req, res) => {
  if (!fromVercelCron(req)) throw new HttpError(401, '허용되지 않은 요청입니다.');
  if (!enabled) throw new HttpError(503, 'Supabase가 설정되지 않았습니다.');

  const at = new Date().toISOString();
  const [visit, holidays] = await Promise.all([
    db.select('visit_info', 'select=id&limit=1'),
    db.select('holidays', 'select=on_date&limit=1'),
  ]);
  await store.set('keepalive:last', { at }, KEEP_SEC);

  res.json({ ok: true, at, read: { visit_info: visit.length, holidays: holidays.length } });
});

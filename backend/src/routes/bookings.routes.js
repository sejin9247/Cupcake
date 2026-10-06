/* /api/bookings — 방문 예약.
   POST는 방문자가 쓰므로 공개. GET은 받은 예약을 보는 용도라 관리자 토큰이 필요하다. */
import { Router } from 'express';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { create, list, takenAt } from '../repositories/booking.repository.js';
import { HttpError } from '../utils/httpError.js';

export const bookingsRouter = Router();

const MAX = { name: 60, email: 120, purpose: 1000 };
const TIME_RE = /^(1[3-7]:(00|30)|18:00)$/;          // 13:00 ~ 18:00, 30분 단위
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/* 이메일은 과하게 깐깐하면 멀쩡한 주소를 막는다 — 모양만 본다 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const text = (v, max, label) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) throw new HttpError(400, `${label}을(를) 입력해 주세요.`);
  if (s.length > max) throw new HttpError(400, `${label}이(가) 너무 깁니다. ${max}자 이내로 적어 주세요.`);
  return s;
};

bookingsRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (req.method === 'POST' && !req.is('application/json')) {
    throw new HttpError(415, 'Content-Type은 application/json이어야 합니다.');
  }
  next();
});

/* POST /api/bookings — 방문 예약 접수 */
bookingsRouter.post('/', async (req, res) => {
  const b = req.body ?? {};

  const name = text(b.name, MAX.name, '이름');
  const email = text(b.email, MAX.email, '이메일');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, '이메일 형식이 올바르지 않습니다.');
  const purpose = text(b.purpose, MAX.purpose, '방문 목적');

  const date = typeof b.date === 'string' ? b.date.trim() : '';
  if (!DATE_RE.test(date)) throw new HttpError(400, '방문 날짜를 선택해 주세요.');
  const d = new Date(date + 'T00:00:00+09:00');
  if (Number.isNaN(d.getTime())) throw new HttpError(400, '방문 날짜가 올바르지 않습니다.');
  /* 공휴일은 화면에서 거르고, 서버는 주말만 막는다 (공휴일 목록은 frontend/visit/booking/holidays.js) */
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(d);
  if (weekday === 'Sat' || weekday === 'Sun') throw new HttpError(400, '주말은 예약할 수 없습니다.');

  const time = typeof b.time === 'string' ? b.time.trim() : '';
  if (!TIME_RE.test(time)) throw new HttpError(400, '희망 시간을 선택해 주세요.');

  /* 화면에서 체크하지만 서버에서도 확인한다 — 동의 없이 저장하지 않는다 */
  if (b.consent !== true) throw new HttpError(400, '정보 전달 동의가 필요합니다.');

  if (await takenAt(date, time)) throw new HttpError(409, '이미 예약된 시간입니다. 다른 시간을 골라 주세요.');

  const saved = await create({ name, email, purpose, date, time, consent: true });
  res.status(201).json({ booking: { id: saved.id, date: saved.date, time: saved.time } });
});

/* GET /api/bookings — 받은 예약 보기 (관리자) */
bookingsRouter.get('/', requireAdmin, async (req, res) => {
  res.json({ bookings: await list() });
});

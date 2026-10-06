/* /api/bookings — 방문 예약 접수. 방문자가 쓰므로 공개.
   메일 알림은 예약 페이지가 Formspree로 직접 보낸다. 이 라우트는 관리자 화면이 쓸 기록만 남긴다.
   받은 예약을 보고 처리 상태를 바꾸는 일은 /api/admin/bookings 에 있다. */
import { Router } from 'express';
import { createIfFree, takenSlots } from '../repositories/booking.repository.js';
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

/* GET /api/bookings/taken — 이미 찬 자리 (공개).
   예약 페이지가 드롭다운에 (완료)를 붙이는 데 쓴다. 날짜와 시간만 나가고 신청자 정보는 나가지 않는다. */
bookingsRouter.get('/taken', async (req, res) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  res.json({ taken: await takenSlots(today) });
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

  /* 한 자리에는 한 예약만. 화면에서도 (완료)로 막지만, 두 사람이 거의 동시에 보내면 화면만으로는 막히지 않는다.
     마지막으로 거르는 곳은 여기이고, 확인과 저장이 한 묶음이라 둘 다 통과하는 일이 없다. */
  const saved = await createIfFree({ name, email, purpose, date, time, consent: true });
  if (!saved) {
    throw new HttpError(409, '방금 다른 분이 그 시간을 예약했습니다. 다른 시간을 골라 주세요.', { code: 'slot_taken' });
  }
  res.status(201).json({ booking: { id: saved.id, no: saved.no, date: saved.date, time: saved.time } });
});

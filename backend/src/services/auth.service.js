/* 관리자 로그인 · 세션.
   - 비밀번호는 환경 변수의 scrypt 해시와만 비교한다 (원문은 저장·기록하지 않음)
   - 로그인하면 세션 토큰을 돌려준다. 브라우저는 이 토큰을 페이지 메모리에만 두므로
     창·탭을 닫거나 새로고침하면 사라지고, 새 창에서는 비밀번호를 다시 입력해야 한다.
   - 저장소에는 토큰 원문이 아니라 sha256 값만 둔다 (저장소가 새어도 토큰으로 쓸 수 없음)
   - 30분 동안 요청이 없거나, 로그인 후 8시간이 지나면 만료
   - 한 IP가 15분 안에 5번, 전체가 하루 20번 틀리면 로그인 차단 */
import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config/index.js';
import { store } from '../store/index.js';
import { HttpError } from '../utils/httpError.js';
import { verifyPassword } from '../utils/password.js';

const A = config.admin;
const sessionKey = token => 'session:' + createHash('sha256').update(token).digest('hex');
const ipKey = ip => 'loginfail:ip:' + ip;
const GLOBAL_KEY = 'loginfail:all';

export const adminConfigured = () => !!A.passwordHash;

async function assertNotLocked(ip) {
  const [perIp, all] = await Promise.all([store.get(ipKey(ip)), store.get(GLOBAL_KEY)]);
  if ((all ?? 0) >= A.globalFailMax) throw new HttpError(429, '비밀번호를 너무 많이 틀려 로그인이 잠시 잠겼습니다. 내일 다시 시도하세요.');
  if ((perIp ?? 0) >= A.ipFailMax) throw new HttpError(429, '로그인 시도가 너무 많습니다. 15분 뒤에 다시 시도하세요.');
}

/* 성공하면 세션 토큰을 돌려준다 */
export async function login(password, ip) {
  if (!adminConfigured()) {
    throw new HttpError(503, '관리자 비밀번호가 아직 설정되지 않았습니다. backend 폴더에서 npm run set-password를 실행하세요.');
  }
  await assertNotLocked(ip);
  if (typeof password !== 'string' || !password || password.length > 200 || !(await verifyPassword(password, A.passwordHash))) {
    await Promise.all([store.incr(ipKey(ip), A.ipFailWindowSec), store.incr(GLOBAL_KEY, A.globalFailWindowSec)]);
    throw new HttpError(401, '비밀번호가 올바르지 않습니다.');
  }
  await store.del(ipKey(ip));
  const token = randomBytes(32).toString('base64url');
  await store.set(sessionKey(token), { createdAt: Date.now() }, A.sessionIdleSec);
  return token;
}

/* 유효하면 만료 시각을 뒤로 민다(30분 연장, 단 로그인 후 8시간까지) */
export async function touchSession(token) {
  if (!token) return false;
  const key = sessionKey(token);
  const s = await store.get(key);
  if (!s) return false;
  const left = A.sessionMaxSec - Math.floor((Date.now() - s.createdAt) / 1000);
  if (left <= 0) { await store.del(key); return false; }
  await store.set(key, s, Math.min(A.sessionIdleSec, left));
  return true;
}

export async function logout(token) {
  if (token) await store.del(sessionKey(token));
}

import { touchSession } from '../services/auth.service.js';
import { HttpError } from '../utils/httpError.js';

/* 토큰은 쿠키가 아니라 Authorization 헤더로만 받는다.
   브라우저가 자동으로 실어 보내는 값이 없으므로 다른 사이트가 관리자 요청을 위조할 수 없다. */
export const bearerToken = req => {
  const m = /^Bearer ([\w-]{20,100})$/.exec(req.get('Authorization') || '');
  return m ? m[1] : null;
};

/* 로그인한 관리자만 통과시킨다 */
export async function requireAdmin(req, res, next) {
  if (!(await touchSession(bearerToken(req)))) throw new HttpError(401, '로그인이 필요합니다.');
  next();
}

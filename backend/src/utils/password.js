/* 관리자 비밀번호 해시 (scrypt). 저장 형식: scrypt:N:r:p:salt:hash (base64url) */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const PARAMS = { N: 2 ** 15, r: 8, p: 1 };
const MAXMEM = 64 * 1024 * 1024;
const KEYLEN = 32;

const prep = pw => String(pw).normalize('NFKC');

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(prep(password), salt, KEYLEN, { ...PARAMS, maxmem: MAXMEM });
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64url'), key.toString('base64url')].join(':');
}

export async function verifyPassword(password, stored) {
  const [alg, N, r, p, salt, hash] = String(stored || '').split(':');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scrypt(prep(password), Buffer.from(salt, 'base64url'), expected.length, { N: +N, r: +r, p: +p, maxmem: MAXMEM });
  return timingSafeEqual(key, expected);
}

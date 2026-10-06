/* 환경 변수는 여기서만 읽는다. 다른 모듈은 process.env 대신 이 config를 쓴다. */
import { fileURLToPath } from 'node:url';

const list = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);
const int = (v, fallback) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : fallback);

const HOUR = 3600e3;

export const config = {
  port: int(process.env.PORT, 4000),
  corsOrigins: list(process.env.CORS_ORIGINS || 'http://localhost:8765,http://127.0.0.1:8765,http://localhost:4000'),
  userAgent: process.env.USER_AGENT || 'cupcake-cbd-explorer/0.1 (+https://cupcakeprofile.vercel.app)',

  nominatim: {
    base: 'https://nominatim.openstreetmap.org/',
    minIntervalMs: 1100,          // 이용 정책: 초당 1회
    cacheTtlMs: 24 * HOUR,
  },
  overpass: {
    /* 2026-09 측정: maps.mail.ru가 가장 빠르고 안정적이라 기본, overpass-api.de는 예비 */
    endpoints: ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter'],
    attemptTimeoutMs: 65000,
    cacheTtlMs: 6 * HOUR,
  },
  sgis: {
    base: 'https://sgisapi.mods.go.kr/OpenAPI3',
    key: process.env.SGIS_KEY || '',
    secret: process.env.SGIS_SECRET || '',
    tokenTtlMs: 3.5 * HOUR,
    cacheTtlMs: 24 * HOUR,
  },
  db: {
    url: process.env.DATABASE_URL || '',
  },

  admin: {
    /* 비밀번호 원문은 어디에도 두지 않는다. npm run set-password가 만든 scrypt 해시만 .env(배포: Vercel 환경 변수)에 저장 */
    passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
    sessionIdleSec: 30 * 60,          // 30분 동안 아무 요청이 없으면 만료
    sessionMaxSec: 8 * 3600,          // 로그인 후 8시간이 지나면 무조건 만료
    ipFailWindowSec: 15 * 60,         // 한 IP가 15분 안에
    ipFailMax: 5,                     //   5번 틀리면 그 IP 차단
    globalFailWindowSec: 24 * 3600,   // 모든 IP 합쳐 하루 안에
    globalFailMax: 20,                //   20번 틀리면 로그인 전체 차단 (짧은 비밀번호를 여러 IP로 맞히는 공격 방지)
  },

  /* 저장소
     - Upstash Redis 환경 변수가 있으면 Redis (Vercel 배포용 — Vercel Storage에서 연결하면 자동으로 들어감)
     - 없으면 로컬: 프로젝트는 dataDir의 JSON 파일, 세션·로그인 제한은 메모리 */
  store: {
    redisUrl: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
    redisToken: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
    prefix: 'cupcake:',
  },
  dataDir: process.env.DATA_DIR || fileURLToPath(new URL('../../data/', import.meta.url)),

  onVercel: !!process.env.VERCEL,
  // 외부 API 중계(Nominatim·Overpass·SGIS)는 로컬 개발용. 배포에서는 공개 프록시가 되지 않도록 끈다
  enableProxy: process.env.ENABLE_PROXY ? process.env.ENABLE_PROXY === 'true' : !process.env.VERCEL,
};

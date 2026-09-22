/* SGIS OpenAPI3 (통계청) — 행정동 경계, 주택총조사.
   키는 서버 .env(SGIS_KEY/SGIS_SECRET)가 기본이고, 요청에 키가 실려 오면 그것을 쓴다.
   accessToken 발급·갱신은 서버가 맡으므로 브라우저는 토큰을 모른다. */
import { config } from '../config/index.js';
import { cached } from '../repositories/cache.repository.js';
import { HttpError } from '../utils/httpError.js';

export const SGIS_PATHS = ['addr/stage.json', 'boundary/hadmarea.geojson', 'stats/house.json'];

export const serverHasSgisKey = () => !!(config.sgis.key && config.sgis.secret);

export function resolveCreds(creds = {}) {
  if (creds.key && creds.secret) return creds;
  if (serverHasSgisKey()) return { key: config.sgis.key, secret: config.sgis.secret };
  throw new HttpError(400, 'SGIS key is not configured', { i18n: { k: 'sgis.noKey' } });
}

async function sgisRaw(path, params, signal) {
  const u = new URL(`${config.sgis.base}/${path}`);
  u.search = new URLSearchParams(params);
  const r = await fetch(u, { signal, headers: { 'User-Agent': config.userAgent } });
  if (!r.ok) throw new HttpError(502, `SGIS /${path} HTTP ${r.status}`);
  const js = await r.json();
  const cd = Number(js.errCd ?? 0);
  if (cd !== 0) throw new HttpError(502, `${js.errMsg || 'SGIS error'} (${js.errCd})`, { code: cd });
  return js;
}

const tokens = new Map();   // consumer_key → { v, t }

async function authenticate({ key, secret }, signal, { force = false } = {}) {
  const hit = tokens.get(key);
  if (!force && hit && Date.now() - hit.t < config.sgis.tokenTtlMs) return hit.v;
  const js = await sgisRaw('auth/authentication.json', { consumer_key: key, consumer_secret: secret }, signal);
  tokens.set(key, { v: js.result.accessToken, t: Date.now() });
  return js.result.accessToken;
}

/* 키가 맞는지 확인만 한다 (설정 창의 [연결 테스트]) */
export async function sgisTest(creds, signal) {
  await authenticate(resolveCreds(creds), signal, { force: true });
}

export async function sgisGet(path, params, creds, signal) {
  if (!SGIS_PATHS.includes(path)) throw new HttpError(404, `Unknown SGIS path: ${path}`);
  const c = resolveCreds(creds);
  const qs = new URLSearchParams(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));

  // 통계·경계는 키와 무관한 공개 데이터라 키를 빼고 캐시한다
  return cached(`sgis:${path}?${qs}`, config.sgis.cacheTtlMs, async () => {
    try {
      return await sgisRaw(path, { accessToken: await authenticate(c, signal), ...params }, signal);
    } catch (e) {
      if (e.code !== -401) throw e;   // 토큰 만료 → 한 번 새로 받아 재시도
      return sgisRaw(path, { accessToken: await authenticate(c, signal, { force: true }), ...params }, signal);
    }
  });
}

/* Nominatim (OSM 지오코딩) — 지역 검색, 좌표 → 경계, 영문 이름 조회 */
import { config } from '../config/index.js';
import { cached } from '../repositories/cache.repository.js';
import { HttpError } from '../utils/httpError.js';
import { createThrottle } from '../utils/time.js';

export const NOMINATIM_PATHS = ['search', 'reverse', 'lookup'];

// 서버 전체에서 한 줄로 세운다 — 여러 사용자가 동시에 불러도 초당 1회를 넘지 않는다
const throttle = createThrottle(config.nominatim.minIntervalMs);

export async function nominatimGet(path, params, signal) {
  if (!NOMINATIM_PATHS.includes(path)) throw new HttpError(404, `Unknown Nominatim path: ${path}`);
  const qs = new URLSearchParams(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
  const key = `nominatim:${path}?${qs}`;

  return cached(key, config.nominatim.cacheTtlMs, () => throttle(async () => {
    const r = await fetch(`${config.nominatim.base}${path}?${qs}`, {
      signal,
      headers: { 'User-Agent': config.userAgent, Accept: 'application/json' },
    });
    if (!r.ok) throw new HttpError(502, `Nominatim HTTP ${r.status}`);
    return r.json();
  }));
}

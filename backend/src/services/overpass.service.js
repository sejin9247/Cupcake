/* Overpass API (OSM 건물 데이터).
   공용 서버는 혼잡하면 504를 돌려주므로 서버를 돌아가며 재시도하고,
   한 바퀴 실패하면 overpass-api.de 슬롯이 풀리길 기다렸다가 한 바퀴 더 돈다. */
import { config } from '../config/index.js';
import { cached } from '../repositories/cache.repository.js';
import { HttpError } from '../utils/httpError.js';
import { clamp, sleep } from '../utils/time.js';

const { endpoints: ENDPOINTS } = config.overpass;
const isSlotServer = ep => /overpass-api\.de/.test(ep);

/* overpass-api.de는 IP당 슬롯 2개이고 쿼리가 끝난 뒤에도 슬롯이 1분가량 묶인다.
   /api/status를 읽어 슬롯이 모두 풀릴 때까지 기다린다. */
async function slotWait(ep, signal) {
  if (!isSlotServer(ep)) { await sleep(5000, signal); return; }
  const statusUrl = ep.replace(/interpreter$/, 'status');
  for (let k = 0; k < 6; k++) {
    let txt;
    try { txt = await (await fetch(statusUrl, { signal, headers: { 'User-Agent': config.userAgent } })).text(); }
    catch (e) { if (signal?.aborted) throw e; await sleep(5000, signal); return; }
    const limit = +(txt.match(/Rate limit: (\d+)/)?.[1] ?? 0);
    const free = +(txt.match(/(\d+) slots? available now/)?.[1] ?? 0);
    if (limit && free >= limit) return;
    const waits = [...txt.matchAll(/in (\d+) seconds/g)].map(m => +m[1]);
    await sleep(clamp(waits.length ? Math.max(...waits) + 1 : 10, 2, 60) * 1000, signal);
  }
}

async function queryOnce(ep, query, signal) {
  const host = new URL(ep).host;
  const timeout = AbortSignal.timeout(config.overpass.attemptTimeoutMs);
  let r;
  try {
    r = await fetch(ep, {
      method: 'POST',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'User-Agent': config.userAgent },
      body: 'data=' + encodeURIComponent(query),
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    if (timeout.aborted) throw new HttpError(504, `${host} timed out`, { i18n: { k: 'op.timeout', v: { host } } });
    throw new HttpError(502, `${host}: ${e.message}`);
  }
  if (!r.ok) {
    const why = r.status === 429 ? { k: 'op.why429' } : r.status === 504 ? { k: 'op.why504' } : '';
    throw new HttpError(502, `${host} HTTP ${r.status}`, { i18n: { k: 'op.http', v: { host, status: r.status, why } } });
  }
  const js = await r.json();
  if (js.remark && /error|timed out/i.test(js.remark)) throw new HttpError(502, `${host}: ${js.remark}`);
  return js.elements || [];
}

/* preferred: 사용자가 설정에서 고른 서버. 허용 목록에 없으면 무시한다(임의 주소로 요청 방지). */
export async function overpassQuery(query, { preferred, signal } = {}) {
  if (typeof query !== 'string' || !query.trim()) throw new HttpError(400, 'query is required');
  if (query.length > 10000) throw new HttpError(413, 'query is too long');

  return cached(`overpass:${query}`, config.overpass.cacheTtlMs, async () => {
    const first = ENDPOINTS.includes(preferred) ? preferred : ENDPOINTS[0];
    const servers = [first, ...ENDPOINTS.filter(x => x !== first)];
    const slotServer = servers.find(isSlotServer) ?? servers[0];
    let lastErr;
    for (const [i, ep] of [...servers, ...servers].entries()) {
      if (i === servers.length) await slotWait(slotServer, signal);
      try {
        return await queryOnce(ep, query, signal);
      } catch (e) {
        if (signal?.aborted) throw e;
        lastErr = e;
        console.warn(`[overpass] ${e.message}`);
      }
    }
    throw lastErr;
  });
}

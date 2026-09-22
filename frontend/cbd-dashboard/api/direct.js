'use strict';

/* 직접 호출 소스 — 브라우저가 외부 API(Nominatim·Overpass·SGIS)를 바로 부른다.
   백엔드가 없을 때(배포 사이트, file://) 쓰인다. 함수 모양은 api/backend.js와 같다. */
function createDirectSource(getCreds) {
  const EXT = APP_CONFIG.external;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ----- Nominatim ----- */
  async function nominatim(path, params, signal) {
    const u = new URL(EXT.nominatim + path);
    u.search = new URLSearchParams(params);
    const r = await fetch(u, { signal });
    if (!r.ok) throw new Error(`Nominatim HTTP ${r.status}`);
    return r.json();
  }

  /* ----- Overpass ----- */
  /* overpass-api.de는 IP당 슬롯 2개이고, 쿼리가 끝난 뒤에도 슬롯이 1분가량 묶여
     연달아 보낸 요청은 504로 거절된다. /api/status를 읽어 슬롯이 모두 풀릴 때까지 기다린다. */
  async function slotWait(ep, signal, onRetry) {
    if (!/overpass-api\.de/.test(ep)) { await sleep(5000); return; }
    const statusUrl = ep.replace(/interpreter$/, 'status');
    for (let k = 0; k < 6; k++) {
      let txt;
      try { txt = await (await fetch(statusUrl, { signal })).text(); }
      catch (e) { if (signal.aborted) throw e; await sleep(5000); return; }
      const limit = +(txt.match(/Rate limit: (\d+)/)?.[1] ?? 0);
      const free = +(txt.match(/(\d+) slots? available now/)?.[1] ?? 0);
      if (limit && free >= limit) return;
      const waits = [...txt.matchAll(/in (\d+) seconds/g)].map(m => +m[1]);
      const w = clamp(waits.length ? Math.max(...waits) + 1 : 10, 2, 60);
      onRetry?.(i18nErr('op.slotWait', { s: w }));
      await sleep(w * 1000);
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    }
  }

  async function overpass(q, { signal, onRetry, preferred } = {}) {
    const first = EXT.overpass.includes(preferred) ? preferred : EXT.overpass[0];
    const servers = [first, ...EXT.overpass.filter(x => x !== first)];
    // 한 바퀴 모두 실패하면 overpass-api.de 슬롯이 풀리길 기다렸다가 한 바퀴 더 돈다
    const endpoints = [...servers, ...servers];
    const slotServer = servers.find(s => /overpass-api\.de/.test(s)) ?? servers[0];
    let lastErr;
    for (const [i, ep] of endpoints.entries()) {
      if (i === servers.length) await slotWait(slotServer, signal, onRetry);
      const host = new URL(ep).host;
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(), 65000);   // 정상 응답은 수 초 — 멈춘 서버에 오래 묶이지 않게
      const onAbort = () => timeout.abort();
      signal.addEventListener('abort', onAbort, { once: true });
      try {
        const r = await fetch(ep, {
          method: 'POST', signal: timeout.signal,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: 'data=' + encodeURIComponent(q),
        });
        if (!r.ok) {
          throw i18nErr('op.http', {
            host, status: r.status,
            why: r.status === 429 ? tk('op.why429') : r.status === 504 ? tk('op.why504') : '',
          });
        }
        const js = await r.json();
        if (js.remark && /error|timed out/i.test(js.remark)) throw new Error(`${host}: ${js.remark}`);
        return js.elements || [];
      } catch (err) {
        if (signal.aborted) throw err;
        lastErr = err.name === 'AbortError' ? i18nErr('op.timeout', { host }) : err;
        onRetry?.(lastErr, host);
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
      }
    }
    throw lastErr;
  }

  /* ----- SGIS ----- */
  let token = null;
  async function sgisRaw(path, params, signal) {
    const u = new URL(EXT.sgis + path);
    u.search = new URLSearchParams(params);
    const r = await fetch(u, { signal });
    if (!r.ok) throw new Error(`SGIS /${path} HTTP ${r.status}`);
    const js = await r.json();
    const cd = Number(js.errCd ?? 0);
    if (cd !== 0) { const e = new Error(`${js.errMsg || t('sgis.error')} (${js.errCd})`); e.code = cd; throw e; }
    return js;
  }
  async function auth(signal, { key, secret } = getCreds()) {
    if (token && token.key === key && Date.now() - token.t < 3.5 * 3600e3) return token.v;
    const js = await sgisRaw('auth/authentication.json', { consumer_key: key, consumer_secret: secret }, signal);
    token = { v: js.result.accessToken, t: Date.now(), key };
    return token.v;
  }
  async function sgis(path, params, signal) {
    const tok = await auth(signal);
    try {
      return await sgisRaw(path, { accessToken: tok, ...params }, signal);
    } catch (e) {
      if (e.code !== -401) throw e;
      token = null;
      return sgisRaw(path, { accessToken: await auth(signal), ...params }, signal);
    }
  }
  async function sgisTest(key, secret) {
    token = null;
    try { await auth(undefined, { key, secret }); }
    finally { token = null; }
  }

  return { nominatim, overpass, sgis, sgisTest, sgisReset() { token = null; } };
}

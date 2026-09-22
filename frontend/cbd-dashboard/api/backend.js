'use strict';

/* 백엔드 소스 — 모든 데이터 요청을 우리 서버(backend/)로 보낸다.
   재시도·요청 간격·SGIS 토큰·캐시는 서버가 맡는다. 함수 모양은 api/direct.js와 같다. */
function createBackendSource(base, getCreds) {
  base = base.replace(/\/$/, '');

  // 백엔드 오류 { error: { message, i18n?, code? } } → 화면 언어로 번역되는 Error
  async function request(path, { method = 'GET', params, body, signal, headers } = {}) {
    const url = base + path + (params ? '?' + new URLSearchParams(params) : '');
    const r = await fetch(url, {
      method, signal,
      headers: { ...(body && { 'Content-Type': 'application/json' }), ...headers },
      body: body && JSON.stringify(body),
    });
    const js = await r.json().catch(() => null);
    if (r.ok) return js;
    const info = js?.error ?? {};
    const e = info.i18n ? i18nErr(info.i18n.k, info.i18n.v) : new Error(info.message || `API HTTP ${r.status}`);
    if (info.code !== undefined) e.code = info.code;
    throw e;
  }

  // 브라우저 설정 창에 키를 넣었다면 함께 보낸다 (없으면 서버 .env 키 사용)
  function sgisHeaders({ key, secret } = getCreds()) {
    return key && secret ? { 'X-SGIS-Key': key, 'X-SGIS-Secret': secret } : {};
  }

  return {
    health: timeoutMs => request('/health', { signal: AbortSignal.timeout(timeoutMs) }),
    nominatim: (path, params, signal) => request(`/geo/nominatim/${path}`, { params, signal }),
    overpass: async (query, { signal, preferred } = {}) =>
      (await request('/overpass', { method: 'POST', body: { query, server: preferred }, signal })).elements,
    sgis: (path, params, signal) => request(`/sgis/${path}`, { params, signal, headers: sgisHeaders() }),
    sgisTest: (key, secret) => request('/sgis/test', { method: 'POST', headers: sgisHeaders({ key, secret }) }),
    sgisReset() { /* 토큰은 서버가 관리 */ },
  };
}

'use strict';

/* 데이터 계층 진입점. app.js는 외부 API를 직접 부르지 않고 DataAPI만 쓴다.
   시작할 때 백엔드가 응답하면 backend 소스, 아니면 direct 소스를 쓴다.
   새 API를 붙일 때는 두 소스(또는 backend만)에 함수를 추가하고 아래 via()로 내보낸다. */
const DataAPI = (() => {
  let creds = () => ({ key: '', secret: '' });
  const getCreds = () => creds();

  let source = createDirectSource(getCreds);
  let mode = 'direct';
  let serverSgis = false;

  const ready = (async () => {
    if (!APP_CONFIG.apiBase) return;
    const backend = createBackendSource(APP_CONFIG.apiBase, getCreds);
    const info = await backend.health(APP_CONFIG.healthTimeoutMs).catch(() => null);
    if (!info?.ok) { console.info('[api] 백엔드 응답 없음 — 외부 API를 직접 호출합니다'); return; }
    source = backend;
    mode = 'backend';
    serverSgis = !!info.sgis;
    console.info(`[api] 백엔드 사용: ${APP_CONFIG.apiBase}`);
  })();

  const via = name => async (...args) => { await ready; return source[name](...args); };

  return {
    ready,
    get mode() { return mode; },
    get serverHasSgisKey() { return serverSgis; },
    setCredentials(fn) { creds = fn; },

    nominatim: via('nominatim'),   // (path, params, signal) → JSON
    overpass: via('overpass'),     // (query, { signal, onRetry, preferred }) → elements[]
    sgis: via('sgis'),             // (path, params, signal) → JSON
    sgisTest: via('sgisTest'),     // (key, secret) → 성공하면 resolve
    sgisReset() { source.sgisReset(); },
  };
})();

'use strict';

/* 프론트엔드 설정 — 백엔드 주소와 외부 API 주소를 여기서만 정한다.

   apiBase
   - 값이 있으면 시작할 때 {apiBase}/health를 확인하고, 응답하면 모든 데이터 요청을 백엔드로 보낸다.
   - null이거나 백엔드가 꺼져 있으면 지금처럼 브라우저가 외부 API를 직접 호출한다.
   - 백엔드를 배포하면 배포 주소(예: 'https://api.example.com/api')를 넣는다. */
const APP_CONFIG = {
  apiBase: (() => {
    const { hostname, port } = location;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') return null;   // 배포 사이트·file:// → 직접 호출
    return port === '4000' ? '/api' : 'http://localhost:4000/api';          // 4000 = backend/.env의 PORT
  })(),
  healthTimeoutMs: 1500,

  // 직접 호출 모드에서 쓰는 외부 API (백엔드 모드에서는 backend/src/config가 같은 값을 가진다)
  external: {
    nominatim: 'https://nominatim.openstreetmap.org/',
    /* 2026-09 측정: overpass-api.de는 슬롯이 비어도 요청의 절반가량을 7~12초 뒤 504로 거절하고,
       kumi.systems·private.coffee는 응답이 없었다. maps.mail.ru는 같은 데이터 시각에 3~4초로 안정적이라 기본으로 쓴다. */
    overpass: ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter'],
    sgis: 'https://sgisapi.mods.go.kr/OpenAPI3/',
  },
};

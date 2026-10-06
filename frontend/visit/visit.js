'use strict';
/* ============================================================
   Open-Meteo에서 현재 기온·습도를 받아 채운다. API 키가 필요 없다.
   실패하면 숫자 자리를 '—'로 두고 안내 문구만 바꾼다 — 가짜 값을 넣지 않는다.
   ============================================================ */
(function () {
  const LAT = 36.8330, LON = 127.1790;          // 상명대학교 천안캠퍼스
  const $ = s => document.querySelector(s);

  const tempEl = $('#wxTemp'), humEl = $('#wxHum'), noteEl = $('#wxNote'), timeEl = $('#wxTime');
  if (!tempEl) return;

  /* 기상 코드 → 사람이 읽는 말 (Open-Meteo WMO code) */
  const SKY = {
    0: '맑음', 1: '대체로 맑음', 2: '구름 조금', 3: '흐림',
    45: '안개', 48: '서리 안개',
    51: '약한 이슬비', 53: '이슬비', 55: '짙은 이슬비',
    61: '약한 비', 63: '비', 65: '강한 비',
    71: '약한 눈', 73: '눈', 75: '강한 눈', 77: '싸락눈',
    80: '소나기', 81: '소나기', 82: '강한 소나기',
    85: '소낙눈', 86: '강한 소낙눈', 95: '천둥번개', 96: '천둥번개·우박', 99: '천둥번개·우박',
  };

  const url = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + LAT + '&longitude=' + LON
    + '&current=temperature_2m,relative_humidity_2m,weather_code'
    + '&timezone=Asia%2FSeoul';

  fetch(url)
    .then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
    .then(js => {
      const c = js && js.current;
      if (!c) throw new Error('no current');
      tempEl.firstChild.nodeValue = Math.round(c.temperature_2m * 10) / 10;
      humEl.firstChild.nodeValue = Math.round(c.relative_humidity_2m);
      noteEl.textContent = SKY[c.weather_code] || '현재 날씨';
      /* 관측 시각은 현지(서울) 기준으로 내려온다 */
      const t = String(c.time || '').replace('T', ' ').slice(0, 16);
      if (t) timeEl.textContent = t + ' 기준';
    })
    .catch(() => {
      noteEl.textContent = '날씨를 불러오지 못했습니다';
      timeEl.textContent = '잠시 후 새로고침해 주세요';
    });

  const y = $('#yr');
  if (y) y.textContent = String(new Date().getFullYear());
})();

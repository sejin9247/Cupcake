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

  /* ---------- 위성 지도 ----------
     Esri World Imagery — 키가 필요 없고 저작권 표기만 하면 된다.
     페이지에서 색을 가진 유일한 자리라 흑백 처리를 하지 않는다. */
  const box = $('#map');
  if (box && window.L) {
    const map = L.map(box, {
      center: [LAT, LON],
      zoom: 17,
      minZoom: 13,
      maxZoom: 19,
      zoomControl: true,
      /* 휠로 확대하면 페이지 스크롤이 지도에 먹혀 답답하다 — 지도를 한 번 누른 뒤에만 켠다 */
      scrollWheelZoom: false,
    });

    /* Leaflet이 기본으로 붙이는 'Leaflet' 링크와 국기 표식을 뗀다 — 출처 표기만 남긴다 */
    map.attributionControl.setPrefix('');

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    }).addTo(map);

    /* 표시는 검정 점 하나 — 사진 위에서 가장 조용하게 읽힌다 */
    L.marker([LAT, LON], {
      icon: L.divIcon({ className: 'pin', html: '<i></i>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      keyboard: false,
      title: '상명대학교 천안캠퍼스 B306',
    }).addTo(map);

    map.once('click', () => map.scrollWheelZoom.enable());
  } else if (box) {
    /* 지도 라이브러리가 열리지 않아도 빈 상자만 남기지 않는다 */
    box.classList.add('shot-off');
    box.textContent = '지도를 불러오지 못했습니다. 아래 ‘카카오맵에서 길찾기’로 확인해 주세요.';
  }

  const y = $('#yr');
  if (y) y.textContent = String(new Date().getFullYear());
})();

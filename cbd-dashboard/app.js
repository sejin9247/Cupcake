'use strict';

/* ============================================================
   constants & helpers
   ============================================================ */
const SGIS_BASE = 'https://sgisapi.mods.go.kr/OpenAPI3';
/* 2026-09 측정: overpass-api.de는 슬롯이 비어도 요청의 절반가량을 7~12초 뒤 504로 거절하고,
   kumi.systems·private.coffee는 응답이 없었다. maps.mail.ru는 같은 데이터 시각에 3~4초로 안정적이라 기본으로 쓴다. */
const OVERPASS_ENDPOINTS = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter'];
const BBOX_FILL = 0.75;   // 건물 외곽 사각형 면적 중 실제 바닥면적 비율(추정)
const NOMINATIM = 'https://nominatim.openstreetmap.org/';
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const MAX_AREA_KM2 = 2500;
const LQ_BREAKS = [0.5, 1, 1.5, 2, 3, 5];
const LQ_LABELS = ['<0.5', '0.5', '1', '1.5', '2', '3', '5+'];
const RAMP_LIGHT = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
const RAMP_DARK = ['#0d366b', '#184f95', '#256abf', '#2a78d6', '#5598e7', '#86b6ef', '#cde2fb'];
const SETTINGS_KEY = 'cbd-dash-settings-v1';
const THEME_KEY = 'cbd-dash-theme';

/* 건물 유형 — 색은 기준 팔레트 슬롯 1·3·4·5·6 (2번 주황은 지도의 CBD 표시와 겹쳐 제외; 1·3은 전쌍 검증 통과), 미분류는 중립 회색 */
const BLD_TYPES = [
  { key: 'res', light: '#2a78d6', dark: '#3987e5',
    values: ['apartments', 'residential', 'house', 'detached', 'semidetached_house', 'semi_detached_house', 'terrace', 'dormitory', 'bungalow', 'cabin', 'farm', 'hut', 'static_caravan', 'houseboat'] },
  { key: 'com', light: '#1baf7a', dark: '#199e70',
    values: ['commercial', 'office', 'officetel', 'retail', 'supermarket', 'kiosk', 'hotel', 'mall', 'shop', 'bank'] },
  { key: 'pub', light: '#eda100', dark: '#c98500',
    values: ['public', 'government', 'civic', 'school', 'university', 'college', 'kindergarten', 'hospital', 'clinic', 'fire_station', 'police', 'library', 'train_station', 'transportation', 'military', 'toilets'] },
  { key: 'rel', light: '#e87ba4', dark: '#d55181',
    values: ['religious', 'church', 'cathedral', 'chapel', 'mosque', 'temple', 'shrine', 'monastery', 'synagogue', 'museum', 'theatre', 'sports_hall', 'stadium', 'grandstand', 'pavilion'] },
  { key: 'ind', light: '#008300', dark: '#008300',
    values: ['industrial', 'factory', 'manufacture', 'warehouse', 'hangar', 'storage_tank'] },
  { key: 'unk', light: '#c3c2b7', dark: '#5f5e5a', values: [] },
];
const BLD_AMENITY = {
  pub: ['school', 'kindergarten', 'university', 'college', 'hospital', 'clinic', 'library', 'townhall', 'police', 'fire_station', 'post_office', 'community_centre', 'courthouse', 'social_facility'],
  rel: ['place_of_worship', 'theatre', 'arts_centre', 'cinema'],
  com: ['bank', 'restaurant', 'cafe', 'fast_food', 'pharmacy', 'marketplace', 'fuel', 'bar', 'pub'],
};
const bldLabel = t_ => t(`type.${t_.key}`);

proj4.defs('EPSG:5179', '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
const utmkToWgs = proj4('EPSG:5179', 'EPSG:4326');

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').replace(/\s+/g, '');
const num = v => { const n = Number(String(v ?? '').replace(/,/g, '')); return v !== '' && v != null && Number.isFinite(n) ? n : null; };
const locale = () => (lang === 'ko' ? 'ko-KR' : 'en-US');
const fmt = (v, d = 1) => Number.isFinite(v) ? v.toLocaleString(locale(), { maximumFractionDigits: d }) : '–';
const fmtFixed = (v, d = 1) => Number.isFinite(v) ? v.toLocaleString(locale(), { maximumFractionDigits: d, minimumFractionDigits: d }) : '–';
const fmtInt = v => Number.isFinite(v) ? Math.round(v).toLocaleString(locale()) : '–';
const nBldg = v => t('fmt.bldg', { n: fmtInt(v) });
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function isDark() {
  const th = document.documentElement.dataset.theme;
  return th === 'dark' || (th !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
}
function lqClass(lq) { let i = 0; while (i < LQ_BREAKS.length && lq >= LQ_BREAKS[i]) i++; return i; }
/* 지도 위 색은 UI 테마가 아니라 지도 바탕을 따른다: OSM 기본 타일은 항상 밝고, 흑백 타일만 다크 테마에서 반전된다 */
let grayBase = false;
const darkGround = () => grayBase && isDark();
function lqColor(lq) { return (darkGround() ? RAMP_DARK : RAMP_LIGHT)[lqClass(lq)]; }
function mapInk() {
  const d = darkGround();
  return {
    ground: d ? '#1a1a19' : '#ffffff', ink: d ? '#ffffff' : '#0b0b0b', ink2: d ? '#c3c2b7' : '#52514e',
    cbd: d ? '#d95926' : '#eb6834', sub: d ? '#9085e9' : '#4a3aa7',
  };
}
function niceStep(x) {
  if (!(x > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(x)), m = x / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}
async function pool(items, n, fn) {
  const q = [...items];
  await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => { while (q.length) await fn(q.shift()); }));
}
function readJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }
function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ } }

/* planar ring area (m²) around the ring's first vertex – accurate enough for building footprints and hex cells */
function ringAreaM2(ring) {
  const lat0 = ring[0][1] * Math.PI / 180, kx = 111320 * Math.cos(lat0), ky = 110574;
  const x0 = ring[0][0], y0 = ring[0][1];
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    s += ((ring[j][0] - x0) * kx) * ((ring[i][1] - y0) * ky) - ((ring[i][0] - x0) * kx) * ((ring[j][1] - y0) * ky);
  }
  return Math.abs(s) / 2;
}
function reprojectGeom(g) {
  const f = c => typeof c[0] === 'number' ? utmkToWgs.forward([c[0], c[1]]) : c.map(f);
  return { type: g.type, coordinates: f(g.coordinates) };
}

/* Nominatim 이용 정책(초당 1회)을 지키려고 부가 요청은 줄 세워 보낸다 */
let nominatimChain = Promise.resolve();
function nominatimLater(fn) {
  const p = nominatimChain.then(() => sleep(1100)).then(fn);
  nominatimChain = p.catch(() => {});
  return p;
}

/* ============================================================
   settings & theme
   ============================================================ */
const DEFAULTS = { sgisKey: '', sgisSecret: '', year: '2023', aptType: '02', floors: 15, overpass: OVERPASS_ENDPOINTS[0] };
let settings = { ...DEFAULTS, ...readJSON(SETTINGS_KEY, {}) };
// 예전 기본값(overpass-api.de·kumi)을 저장해 둔 브라우저도 한 번은 새 기본 서버로 옮긴다
if (!settings.overpassV2 || !OVERPASS_ENDPOINTS.includes(settings.overpass)) {
  settings.overpass = OVERPASS_ENDPOINTS[0];
  settings.overpassV2 = true;
}
const hasSgisKey = () => !!(settings.sgisKey && settings.sgisSecret);

function updateBadge() {
  const b = $('#sgisBadge');
  b.textContent = hasSgisKey() ? t('badge.on') : t('badge.off');
  b.classList.toggle('on', hasSgisKey());
}

/* 테마는 라이트 ↔ 다크 두 가지만 오간다. 저장된 선택이 없을 때만 처음 한 번 OS 설정을 따른다. */
const THEME_ICON = { light: '☀', dark: '☾' };
function applyTheme(th) {
  document.documentElement.dataset.theme = th;
  const other = th === 'dark' ? 'light' : 'dark';
  $$('.theme-btn').forEach(btn => {
    btn.querySelector('.theme-icon').textContent = THEME_ICON[th];
    const txt = btn.querySelector('.theme-txt');
    if (txt) txt.textContent = t(`theme.${th}`);
    btn.title = t('theme.switchTo', { mode: t(`theme.${other}`) });
    btn.setAttribute('aria-label', btn.title);
  });
}
let theme = readJSON(THEME_KEY, null);
if (theme !== 'light' && theme !== 'dark') theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
let themeFadeTimer = null;
function setTheme(next) {
  const swap = () => { theme = next; writeJSON(THEME_KEY, theme); applyTheme(theme); onThemeChange(); };
  if (reducedMotion()) { swap(); return; }
  // 보이지 않는 탭에서는 View Transition이 중단되므로 바로 바꾼다
  if (document.startViewTransition && document.visibilityState === 'visible') { document.startViewTransition(swap); return; }
  const root = document.documentElement;
  root.classList.add('theme-fade');
  void root.offsetWidth;                             // 전환 클래스를 먼저 적용한 뒤 색을 바꿔야 전환이 걸린다
  swap();
  clearTimeout(themeFadeTimer);
  themeFadeTimer = setTimeout(() => root.classList.remove('theme-fade'), 300);
}
$$('[data-theme-toggle]').forEach(b => b.addEventListener('click', () => setTheme(theme === 'dark' ? 'light' : 'dark')));

/* ============================================================
   map (OpenStreetMap tiles)
   ============================================================ */
const map = L.map('map', { zoomControl: false, minZoom: 5 }).setView([36.35, 127.8], 7);
L.control.zoom({ position: 'bottomright' }).addTo(map);
const baseLayers = {
  osm: L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTR }),
  gray: L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTR, className: 'basemap-gray' }),
};
baseLayers.osm.addTo(map);
map.on('baselayerchange', e => { grayBase = e.layer === baseLayers.gray; onThemeChange(); });

const PANES = { dongFill: 410, hex: 420, dongLine: 430, region: 435, apts: 440, bld: 445, cbd: 450 };
const renderers = {};
for (const [name, z] of Object.entries(PANES)) {
  map.createPane(name).style.zIndex = z;
  renderers[name] = L.canvas({ pane: name, padding: 0.3 });
}
const layers = {
  dongFill: L.layerGroup(), hex: L.layerGroup().addTo(map), dongLine: L.layerGroup().addTo(map),
  region: L.layerGroup().addTo(map), apts: L.layerGroup(), cbd: L.layerGroup().addTo(map),
  bldRing: L.layerGroup().addTo(map), bldPts: L.layerGroup(),
};
const drawLayer = L.layerGroup().addTo(map);

let layerCtl = null, sgisAttr = null;
function buildLayerControl() {
  layerCtl?.remove();
  layerCtl = L.control.layers(
    { [t('base.osm')]: baseLayers.osm, [t('base.gray')]: baseLayers.gray },
    {
      [t('layer.hex')]: layers.hex,
      [t('layer.dongFill')]: layers.dongFill,
      [t('layer.dongLine')]: layers.dongLine,
      [t('layer.apts')]: layers.apts,
      [t('layer.cbd')]: layers.cbd,
      [t('layer.bldRing')]: layers.bldRing,
      [t('layer.bldPts')]: layers.bldPts,
    },
    { collapsed: innerWidth < 1200, position: 'topright' },
  ).addTo(map);
  if (sgisAttr) map.attributionControl.removeAttribution(sgisAttr);
  sgisAttr = t('attr.sgis');
  map.attributionControl.addAttribution(sgisAttr);
}

const legend = L.control({ position: 'bottomleft' });
legend.onAdd = () => { const d = L.DomUtil.create('div', 'map-legend'); d.id = 'mapLegend'; return d; };
legend.addTo(map);
function renderLegend() {
  const ramp = darkGround() ? RAMP_DARK : RAMP_LIGHT;
  $('#mapLegend').innerHTML = `
    <div class="t">${esc(t('legend.title'))}</div>
    <div class="ramp">${ramp.map(c => `<i style="background:${c}"></i>`).join('')}</div>
    <div class="ramp-l">${LQ_LABELS.map(l => `<span>${l}</span>`).join('')}</div>
    <div class="k"><span class="ln"></span>${esc(t('legend.cbd'))}</div>
    <div class="k"><span class="ln sub"></span>${esc(t('legend.sub'))}</div>`;
}

/* ============================================================
   UI: steps, tooltips, busy
   ============================================================ */
const STEPS = [['geo', 'Nominatim'], ['osm', 'Overpass'], ['sgis', 'SGIS'], ['calc', '']];
const stepState = {};
function renderSteps() {
  $('#steps').innerHTML = STEPS.map(([id, src]) => `
    <li id="step-${id}" data-status="wait">
      <span class="ic" aria-hidden="true"></span>
      <span><span class="lb">${esc(t(`step.${id}`))}${src ? ` <span class="src">· ${src}</span>` : ''}</span>
      <span class="sr" data-sr></span>
      <span class="detail"></span></span>
    </li>`).join('');
  for (const id of STEPS.map(s => s[0])) paintStep(id);
}
function paintStep(id) {
  const li = $(`#step-${id}`); if (!li) return;
  const s = stepState[id] || { status: 'wait', detail: '' };
  li.dataset.status = s.status;
  li.querySelector('.ic').textContent = { ok: '✓', err: '!', skip: '–' }[s.status] || '';
  li.querySelector('[data-sr]').textContent = t(`status.${s.status}`);
  li.querySelector('.detail').textContent = tx(s.detail);
}
function setStep(id, status, detail = '') { stepState[id] = { status, detail }; paintStep(id); }
function resetSteps() { for (const k of Object.keys(stepState)) delete stepState[k]; renderSteps(); }

const tip = $('#tip');
function moveTip(e) {
  const pad = 14; const r = tip.getBoundingClientRect();
  let x = e.clientX + pad, y = e.clientY + pad;
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
document.addEventListener('mouseover', e => {
  const el = e.target.closest('[data-tip]');
  if (!el) return;
  tip.innerHTML = el.dataset.tip; tip.hidden = false; moveTip(e);
});
document.addEventListener('mousemove', e => { if (!tip.hidden) moveTip(e); });
document.addEventListener('mouseout', e => {
  const el = e.target.closest('[data-tip]');
  if (el && !el.contains(e.relatedTarget)) tip.hidden = true;
});

let busyMsg = tk('busy.default');
function setBusy(on, msg) {
  $('#goBtn').disabled = on;
  $('#busyPill').hidden = !on;
  if (msg) busyMsg = msg;
  $('#busyTxt').textContent = tx(busyMsg);
}

function renderExamples() {
  $('#examples').innerHTML = t('examples').map(x => `<button class="chip" type="button" data-q="${esc(x)}">${esc(x)}</button>`).join('');
}
$('#examples').addEventListener('click', e => {
  const b = e.target.closest('[data-q]'); if (!b) return;
  $('#q').value = b.dataset.q; startSearch(b.dataset.q);
});
function renderRadiusOptions() {
  const sel = $('#bldRadius'), cur = sel.value || '3';
  sel.innerHTML = [1, 2, 3, 5].map(r => `<option value="${r}"${String(r) === cur ? ' selected' : ''}>${esc(t('bld.radius', { r }))}</option>`).join('');
}
function renderBldRules() {
  $('#bldRules').innerHTML = BLD_TYPES.filter(x => x.values.length)
    .map(x => `<div><b>${esc(bldLabel(x))}</b> — building=${x.values.join(', ')}</div>`).join('') +
    `<div>${t('bld.ruleFallback')}</div><div>${t('bld.ruleUnk')}</div>`;
}

/* ============================================================
   state
   ============================================================ */
const state = {
  runId: 0, abort: null, candidates: [], activeCand: -1, lastRegion: null,
  region: null, apts: [], medianFp: 400, dongs: null, sgisLevel: null, result: null,
  names: new Map(), heroMsg: tk('hero.placeholder'),
};

/* ============================================================
   data sources
   ============================================================ */
async function nominatimSearch(q, signal) {
  const u = new URL(NOMINATIM + 'search');
  u.search = new URLSearchParams({
    q, format: 'jsonv2', countrycodes: 'kr', polygon_geojson: '1', polygon_threshold: '0.0002',
    addressdetails: '1', limit: '8', 'accept-language': 'ko',
  });
  const r = await fetch(u, { signal });
  if (!r.ok) throw new Error(`Nominatim HTTP ${r.status}`);
  const js = await r.json();
  return js
    .filter(x => x.geojson && /Polygon/.test(x.geojson.type))
    .sort((a, b) => (b.category === 'boundary') - (a.category === 'boundary'));
}

async function nominatimReverseArea(latlng, zoom, signal) {
  const u = new URL(NOMINATIM + 'reverse');
  u.search = new URLSearchParams({
    lat: latlng.lat.toFixed(6), lon: latlng.lng.toFixed(6), zoom, format: 'jsonv2',
    polygon_geojson: '1', polygon_threshold: '0.0002', 'accept-language': 'ko',
  });
  const r = await fetch(u, { signal });
  if (!r.ok) throw new Error(`Nominatim HTTP ${r.status}`);
  const js = await r.json();
  return js?.geojson && /Polygon/.test(js.geojson.type) ? js : null;
}

async function nominatimReverseName(lat, lon, forLang) {
  const key = `${forLang}|${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (state.names.has(key)) return state.names.get(key);
  const u = new URL(NOMINATIM + 'reverse');
  u.search = new URLSearchParams({ lat, lon, format: 'jsonv2', zoom: '15', 'accept-language': forLang });
  try {
    const r = await fetch(u); const js = await r.json(); const a = js.address || {};
    const name = a.quarter || a.suburb || a.neighbourhood || a.village || a.town || a.city_district || a.borough || js.name || null;
    state.names.set(key, name);
    return name;
  } catch { return null; }
}

/* Overpass의 area() 질의는 서버 부하에 민감해 자주 504가 나므로,
   영역 bbox로 질의한 뒤 브라우저에서 폴리곤으로 잘라낸다 (직접 그린 영역도 같은 경로). */
async function fetchApartments(region, signal, onRetry) {
  const [w, s, e, n] = region.bbox.map(v => +v.toFixed(6));
  const bb = `(${s},${w},${n},${e})`;
  // 윤곽 전체(geom) 대신 외곽 사각형(bb)만 받아 응답 크기를 절반 이하로 줄인다
  const q = `[out:json][timeout:60];` +
    `way["building"="apartments"]${bb};out tags bb qt;` +
    `relation["building"="apartments"]${bb};out tags center qt;`;
  return overpassQuery(q, signal, onRetry);
}

/* overpass-api.de는 IP당 슬롯 2개이고, 쿼리가 끝난 뒤에도 슬롯이 1분가량 묶여
   연달아 보낸 요청은 504로 거절된다. /api/status를 읽어 슬롯이 모두 풀릴 때까지 기다린다. */
async function overpassSlotWait(ep, signal, onRetry) {
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

/* 같은 지역을 다시 분석할 때(후보 재선택, 설정 변경 등) 공용 서버에 다시 요청하지 않도록 최근 결과를 보관 */
const overpassCache = new Map();
const OVERPASS_CACHE_MAX = 6;

async function overpassQuery(q, signal, onRetry) {
  if (overpassCache.has(q)) {
    const hit = overpassCache.get(q);
    overpassCache.delete(q); overpassCache.set(q, hit);
    return hit;
  }
  const servers = [settings.overpass, ...OVERPASS_ENDPOINTS.filter(x => x !== settings.overpass)];
  // 한 바퀴 모두 실패하면 overpass-api.de 슬롯이 풀리길 기다렸다가 한 바퀴 더 돈다
  const endpoints = [...servers, ...servers];
  const slotServer = servers.find(s => /overpass-api\.de/.test(s)) ?? servers[0];
  let lastErr;
  for (const [i, ep] of endpoints.entries()) {
    if (i === servers.length) await overpassSlotWait(slotServer, signal, onRetry);
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
      const els = js.elements || [];
      overpassCache.set(q, els);
      if (overpassCache.size > OVERPASS_CACHE_MAX) overpassCache.delete(overpassCache.keys().next().value);
      return els;
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

function parseApartments(elements, region) {
  const out = [], fps = [];
  const [bw, bs, be, bn] = region.bbox;
  const inside = (lon, lat) => lon >= bw && lon <= be && lat >= bs && lat <= bn && turf.booleanPointInPolygon([lon, lat], region.feature);
  for (const el of elements) {
    let lon, lat, fp = null;
    if (el.bounds) {
      const b = el.bounds;
      lon = (b.minlon + b.maxlon) / 2; lat = (b.minlat + b.maxlat) / 2;
      fp = (b.maxlon - b.minlon) * 111320 * Math.cos(lat * Math.PI / 180) * (b.maxlat - b.minlat) * 110574 * BBOX_FILL;
      if (!(fp > 20 && fp < 60000)) fp = null;
    } else if (el.type === 'way' && el.geometry?.length >= 3) {
      const ring = el.geometry.filter(Boolean).map(p => [p.lon, p.lat]);
      const n = ring.length - (ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? 1 : 0);
      let sx = 0, sy = 0;
      for (let i = 0; i < n; i++) { sx += ring[i][0]; sy += ring[i][1]; }
      lon = sx / n; lat = sy / n;
      if (n >= 3) { fp = ringAreaM2(ring.slice(0, n)); if (!(fp > 20 && fp < 60000)) fp = null; }
    } else if (el.center) {
      lon = el.center.lon; lat = el.center.lat;
    } else continue;
    if (!inside(lon, lat)) continue;
    const lv = parseFloat(el.tags?.['building:levels']);
    out.push({
      id: `${el.type}/${el.id}`, lon, lat, fp,
      levels: Number.isFinite(lv) && lv > 0 && lv < 120 ? lv : null,
      name: el.tags?.name || el.tags?.['addr:housename'] || '',
    });
    if (fp) fps.push(fp);
  }
  fps.sort((a, b) => a - b);
  return { apts: out, medianFp: fps.length ? fps[Math.floor(fps.length / 2)] : 400 };
}

/* ----- 건물 유형 (CBD 중심 반경) ----- */
async function fetchBuildings(center, radiusKm, signal, onRetry) {
  const dLat = radiusKm / 110.574, dLon = radiusKm / (111.32 * Math.cos(center.lat * Math.PI / 180));
  const bb = `(${(center.lat - dLat).toFixed(6)},${(center.lon - dLon).toFixed(6)},${(center.lat + dLat).toFixed(6)},${(center.lon + dLon).toFixed(6)})`;
  const q = `[out:json][timeout:90];(way["building"]${bb};relation["building"]${bb};);out tags center qt;`;
  return overpassQuery(q, signal, onRetry);
}

const BLD_INDEX = new Map(BLD_TYPES.flatMap(x => x.values.map(v => [v, x.key])));
function classifyBuilding(tags = {}) {
  for (const v of [tags.building, tags['building:use']]) if (BLD_INDEX.has(v)) return BLD_INDEX.get(v);
  const a = tags.amenity;
  if (BLD_AMENITY.pub.includes(a)) return 'pub';
  if (BLD_AMENITY.rel.includes(a) || tags.religion) return 'rel';
  if (tags.shop || tags.office || BLD_AMENITY.com.includes(a) || /^(hotel|motel|guest_house|hostel)$/.test(tags.tourism || '')) return 'com';
  if (tags.craft || tags.industrial || tags.man_made === 'works') return 'ind';
  return 'unk';
}
function summarizeBuildings(elements, center, radiusKm) {
  const kx = 111.32 * Math.cos(center.lat * Math.PI / 180), ky = 110.574, r2 = radiusKm * radiusKm;
  const counts = Object.fromEntries(BLD_TYPES.map(x => [x.key, 0]));
  const pts = [];
  for (const el of elements) {
    const c = el.center; if (!c) continue;
    if (((c.lon - center.lon) * kx) ** 2 + ((c.lat - center.lat) * ky) ** 2 > r2) continue;
    const type = classifyBuilding(el.tags);
    counts[type]++;
    pts.push({ lat: c.lat, lon: c.lon, type });
  }
  return { center, radiusKm, counts, pts, total: pts.length };
}

/* ----- SGIS ----- */
let sgisToken = null;
async function sgisRaw(path, params, signal) {
  const u = new URL(SGIS_BASE + path);
  u.search = new URLSearchParams(params);
  const r = await fetch(u, { signal });
  if (!r.ok) throw new Error(`SGIS ${path} HTTP ${r.status}`);
  const js = await r.json();
  const cd = Number(js.errCd ?? 0);
  if (cd !== 0) { const e = new Error(`${js.errMsg || t('sgis.error')} (${js.errCd})`); e.code = cd; throw e; }
  return js;
}
async function sgisAuth(signal, key = settings.sgisKey, secret = settings.sgisSecret) {
  if (sgisToken && sgisToken.key === key && Date.now() - sgisToken.t < 3.5 * 3600e3) return sgisToken.v;
  const js = await sgisRaw('/auth/authentication.json', { consumer_key: key, consumer_secret: secret }, signal);
  sgisToken = { v: js.result.accessToken, t: Date.now(), key };
  return sgisToken.v;
}
async function sgis(path, params, signal) {
  const tok = await sgisAuth(signal);
  try {
    return await sgisRaw(path, { accessToken: tok, ...params }, signal);
  } catch (e) {
    if (e.code !== -401) throw e;
    sgisToken = null;
    return sgisRaw(path, { accessToken: await sgisAuth(signal), ...params }, signal);
  }
}
function sidoKey(name) {
  const n = norm(name).replace(/(특별자치도|특별자치시|특별시|광역시|도)$/, '');
  const alias = { 전라북: '전북', 전라남: '전남', 경상북: '경북', 경상남: '경남', 충청북: '충북', 충청남: '충남' };
  return alias[n] || n;
}

async function loadSgis(region, signal, onProgress) {
  const parts = region.parts;
  const year = settings.year;
  const sidos = (await sgis('/addr/stage.json', {}, signal)).result || [];
  let sido = null;
  for (const p of [...parts].reverse()) {
    sido = sidos.find(s => sidoKey(s.addr_name) === sidoKey(p));
    if (sido) break;
  }
  if (!sido) throw i18nErr('sgis.noSido');
  const sggs = (await sgis('/addr/stage.json', { cd: sido.cd }, signal)).result || [];
  const own = norm(parts[0]);
  let codes, level;
  if (sidoKey(parts[0]) === sidoKey(sido.addr_name)) {
    if (sggs.length <= 1) { codes = [sggs[0]?.cd ?? sido.cd]; level = 'sgis.lvlEmd'; }
    else { codes = [sido.cd]; level = 'sgis.lvlSgg'; }
  } else if (/(동|읍|면|리|가)$/.test(parts[0])) {
    const e = i18nErr('sgis.dongSkip'); e.skip = true; throw e;
  } else {
    const m = sggs.filter(s => {
      const n = norm(s.addr_name);
      return n === own || n.startsWith(own) || (n.endsWith(own) && parts.slice(1).some(p => n.startsWith(norm(p))));
    });
    if (!m.length) throw i18nErr('sgis.noCode', { name: parts[0] });
    codes = m.map(s => s.cd); level = 'sgis.lvlEmd';
  }

  const features = [], stats = new Map(), warnings = [];
  const stat = cd => { if (!stats.has(cd)) stats.set(cd, { apt: null, tot: null }); return stats.get(cd); };
  let done = 0;
  await pool(codes, 3, async cd => {
    const soft = p => p.catch(e => { if (e.name === 'AbortError') throw e; warnings.push(e); return { result: [] }; });
    const [geo, apt, tot] = await Promise.all([
      sgis('/boundary/hadmarea.geojson', { year, adm_cd: cd, low_search: 1 }, signal),
      soft(sgis('/stats/house.json', { year, adm_cd: cd, low_search: 1, house_type: settings.aptType }, signal)),
      soft(sgis('/stats/house.json', { year, adm_cd: cd, low_search: 1 }, signal)),
    ]);
    for (const f of geo.features || []) {
      if (!f.geometry) continue;
      features.push({
        type: 'Feature',
        properties: { adm_cd: String(f.properties.adm_cd), adm_nm: f.properties.adm_nm },
        geometry: reprojectGeom(f.geometry),
      });
    }
    for (const r of apt.result || []) stat(String(r.adm_cd)).apt = num(r.house_cnt);
    for (const r of tot.result || []) stat(String(r.adm_cd)).tot = num(r.house_cnt);
    onProgress?.(++done, codes.length);
  });
  if (!features.length) throw i18nErr('sgis.empty', { year });
  return { level, features, stats, warnings };
}

/* ============================================================
   region sources: search · map click · drawing
   ============================================================ */
function splitParts(displayName, name) {
  const parts = displayName.split(',').map(s => s.trim())
    .filter(p => p && p !== '대한민국' && p !== 'South Korea' && !/^\d{5}(-\d+)?$/.test(p));
  if (name && norm(parts[0]) !== norm(name)) parts.unshift(name);
  return parts;
}
function regionFromNominatim(c) {
  const parts = splitParts(c.display_name, c.name);
  const feature = { type: 'Feature', properties: {}, geometry: c.geojson };
  return {
    kind: 'osm', osmType: c.osm_type, osmId: c.osm_id, parts, addresstype: c.addresstype,
    names: { ko: { name: c.name || parts[0], display: parts.join(' · ') } },
    feature, bbox: turf.bbox(feature), areaKm2: turf.area(feature) / 1e6,
  };
}
function regionFromLatLngs(latlngs) {
  const ring = latlngs.map(ll => [ll.lng, ll.lat]);
  ring.push(ring[0]);
  const feature = turf.polygon([ring]);
  return {
    kind: 'custom', vertices: latlngs.length, parts: ['직접 그린 영역'],
    feature, bbox: turf.bbox(feature), areaKm2: turf.area(feature) / 1e6,
  };
}
const regionName = r => !r ? '' : r.kind === 'custom' ? t('region.custom') : (r.names[lang] ?? r.names.ko).name;
const regionDisplay = r => !r ? '' : r.kind === 'custom' ? t('region.customDisplay', { n: r.vertices }) : (r.names[lang] ?? r.names.ko).display;

/* 영어 모드에서는 OSM lookup으로 영문 이름을 덧붙인다 (SGIS 매칭은 한글 이름을 그대로 쓴다) */
async function ensureEnglishNames(regions) {
  const need = regions.filter(r => r && r.kind === 'osm' && !r.names.en && !r.enPending).slice(0, 40);
  if (!need.length) return;
  need.forEach(r => { r.enPending = true; });
  try {
    const ids = need.map(r => `${r.osmType[0].toUpperCase()}${r.osmId}`).join(',');
    const js = await nominatimLater(async () => {
      const u = new URL(NOMINATIM + 'lookup');
      u.search = new URLSearchParams({ osm_ids: ids, format: 'jsonv2', 'accept-language': 'en' });
      const r = await fetch(u);
      return r.ok ? r.json() : [];
    });
    for (const x of js || []) {
      const r = need.find(v => String(v.osmId) === String(x.osm_id) && v.osmType === x.osm_type);
      if (!r) continue;
      const parts = splitParts(x.display_name, x.name);
      r.names.en = { name: x.name || parts[0], display: parts.join(' · ') };
    }
  } catch { /* 이름은 부가 정보라 실패해도 분석에 영향 없음 */ }
  need.forEach(r => { r.enPending = false; });
  if (lang === 'en') { renderResults(state.activeCand); paintStep('geo'); if (state.result) renderAll(); }
}

function beginRun() {
  const run = ++state.runId;
  state.abort?.abort();
  const ac = new AbortController(); state.abort = ac;
  $('#mapEmpty').hidden = true;
  resetSteps(); clearResults();
  return { run, signal: ac.signal };
}
function failRun(e, run) {
  if (e.name === 'AbortError' || run !== state.runId) return;
  console.error(e);
  const running = $$('#steps li[data-status="run"]');
  if (running.length) running.forEach(li => setStep(li.id.slice(5), 'err', e));
  else setStep('geo', 'err', e);
  heroMessage(tk('hero.fail'));
}

/* --- search --- */
let lastStart = { q: '', t: 0 };
function startSearch(q) {
  q = q.trim(); if (!q) { $('#q').focus(); return; }
  if (q === lastStart.q && Date.now() - lastStart.t < 800) return;   // IME 확정 + submit 중복 방지
  lastStart = { q, t: Date.now() };
  showView('app');
  try { history.replaceState(null, '', '#' + new URLSearchParams({ q })); } catch { /* file:// */ }
  runSearch(q);
}
async function runSearch(q) {
  setMode(null);
  const { run, signal } = beginRun();
  setBusy(true, tk('busy.search'));
  setStep('geo', 'run', tk('geo.searching', { q }));
  try {
    const found = await nominatimSearch(q, signal);
    if (run !== state.runId) return;
    state.candidates = found.map(regionFromNominatim);
    if (lang === 'en') ensureEnglishNames(state.candidates);
    if (!found.length) {
      renderResults();
      setStep('geo', 'err', tk('geo.notFound'));
      heroMessage(tk('hero.noResults'));
      return;
    }
    renderResults(0);
    await analyzeRegion(state.candidates[0], run, signal);
  } catch (e) { failRun(e, run); }
  finally { if (run === state.runId) setBusy(false); }
}
async function runRegion(region, { keepCandidates = false } = {}) {
  setMode(null);
  if (!keepCandidates) { state.candidates = []; renderResults(); }
  const { run, signal } = beginRun();
  setBusy(true, tk('busy.prep'));
  try { await analyzeRegion(region, run, signal); }
  catch (e) { failRun(e, run); }
  finally { if (run === state.runId) setBusy(false); }
}
function renderResults(active = -1) {
  const box = $('#results'), c = state.candidates;
  if (active >= 0) state.activeCand = active;
  box.hidden = c.length < 2;
  if (box.hidden) return;
  box.innerHTML = `<div class="results-h"><span>${esc(t('results.head', { n: c.length }))}</span><button type="button" class="x" data-close aria-label="${esc(t('results.close'))}">×</button></div>` +
    c.map((r, i) => `<button type="button" class="cand" data-i="${i}" aria-current="${i === state.activeCand}">${esc(regionName(r))}<small>${esc(regionDisplay(r))} · ${fmt(r.areaKm2, 1)} km²</small></button>`).join('');
}
$('#results').addEventListener('click', e => {
  if (e.target.closest('[data-close]')) { $('#results').hidden = true; return; }
  const b = e.target.closest('[data-i]'); if (!b) return;
  const i = +b.dataset.i;
  renderResults(i);
  runRegion(state.candidates[i], { keepCandidates: true });
});
$('#searchForm').addEventListener('submit', e => { e.preventDefault(); startSearch($('#q').value); });
$('#q').addEventListener('keydown', e => {
  // 한글 조합 중 Enter는 조합 확정에 쓰여 submit이 빠질 수 있으므로 확정 직후 검색한다
  if (e.key === 'Enter' && e.isComposing) {
    e.preventDefault();
    $('#q').addEventListener('compositionend', () => startSearch($('#q').value), { once: true });
  }
});

/* --- map click / drawing modes --- */
const pickLabel = lv => t(`pickName.${lv}`);
/* Nominatim reverse zoom은 지역마다 반환 단위가 달라(서울 z10=동, 분당 z10=구) 순서대로 시도한다 */
const PICK_ZOOMS = { sido: [5], sgg: [10, 8], dong: [13, 12, 10] };
const dongLike = r => /^(suburb|quarter|neighbourhood|village|hamlet)$/.test(r.addresstype || '') || /(동|읍|면|리|가)$/.test(r.name || '');
let mode = null, hintOverride = null;
const draw = { pts: [], cursor: null };

function setMode(m) {
  mode = m; hintOverride = null;
  $('#pickBtn').setAttribute('aria-pressed', String(m === 'pick'));
  $('#drawBtn').setAttribute('aria-pressed', String(m === 'draw'));
  map.getContainer().classList.toggle('picking', !!m);
  draw.pts = []; draw.cursor = null; renderDraw();
  if (m === 'draw') map.doubleClickZoom.disable(); else map.doubleClickZoom.enable();
  if (m) { $('#mapEmpty').hidden = true; $('#results').hidden = true; }
  renderHint();
}
function renderHint() {
  const h = $('#mapHint');
  const btn = (act, key) => `<button type="button" class="link" data-${act}>${esc(t(key))}</button>`;
  let html = null;
  if (hintOverride === 'need3') html = `${esc(t('hint.need3'))} · ${btn('cancel', 'hint.cancel')}`;
  else if (mode === 'pick') html = `${t('hint.pick', { level: pickLabel($('#pickLevel').value) })} · ${btn('cancel', 'hint.cancel')}`;
  else if (mode === 'draw') html = `${t('hint.draw', { finish: btn('finish', 'hint.finish') })} · ${btn('undo', 'hint.undo')} · ${btn('cancel', 'hint.cancel')}`;
  h.hidden = !html;
  if (html) h.innerHTML = html;
}
$('#mapHint').addEventListener('click', e => {
  if (e.target.closest('[data-cancel]')) setMode(null);
  else if (e.target.closest('[data-finish]')) finishDraw();
  else if (e.target.closest('[data-undo]')) { draw.pts.pop(); renderDraw(); }
});
$('#pickBtn').addEventListener('click', () => setMode(mode === 'pick' ? null : 'pick'));
$('#drawBtn').addEventListener('click', () => setMode(mode === 'draw' ? null : 'draw'));
$('#pickLevel').addEventListener('change', () => setMode('pick'));
addEventListener('keydown', e => {
  if (e.key === 'Escape' && mode) setMode(null);
  if (e.key === 'Enter' && mode === 'draw' && document.activeElement === document.body) finishDraw();
});

map.on('click', e => {
  if (mode === 'pick') { pickAt(e.latlng); return; }
  if (mode !== 'draw') return;
  const last = draw.pts.at(-1);
  if (last && map.latLngToContainerPoint(last).distanceTo(e.containerPoint) < 6) return;
  draw.pts.push(e.latlng); renderDraw();
});
map.on('dblclick', () => { if (mode === 'draw') finishDraw(); });
map.on('mousemove', e => { if (mode === 'draw' && draw.pts.length) { draw.cursor = e.latlng; renderDraw(); } });

function renderDraw() {
  drawLayer.clearLayers();
  if (!draw.pts.length) return;
  const { cbd: color, ground: surf } = mapInk();
  const path = draw.cursor ? [...draw.pts, draw.cursor] : draw.pts;
  const style = { renderer: renderers.cbd, color, weight: 2, dashArray: '6 4', interactive: false };
  if (path.length >= 3) L.polygon(path, { ...style, fillColor: color, fillOpacity: .1 }).addTo(drawLayer);
  else L.polyline(path, style).addTo(drawLayer);
  for (const p of draw.pts) L.circleMarker(p, { renderer: renderers.cbd, radius: 4, color: surf, weight: 2, fillColor: color, fillOpacity: 1, interactive: false }).addTo(drawLayer);
}
function finishDraw() {
  if (draw.pts.length < 3) { hintOverride = 'need3'; renderHint(); return; }
  const region = regionFromLatLngs(draw.pts);
  try { history.replaceState(null, '', '#app'); } catch { /* file:// */ }
  runRegion(region);
}

async function pickAt(latlng) {
  const level = $('#pickLevel').value;
  setMode(null);
  state.candidates = []; renderResults();
  const { run, signal } = beginRun();
  L.circleMarker(latlng, { renderer: renderers.cbd, radius: 6, color: mapInk().ground, weight: 2, fillColor: mapInk().cbd, fillOpacity: 1, interactive: false }).addTo(drawLayer);
  setBusy(true, tk('busy.pick', { level: pickLabel(level) }));
  setStep('geo', 'run', tk('geo.picking', { level: pickLabel(level), lat: latlng.lat.toFixed(4), lon: latlng.lng.toFixed(4) }));
  try {
    let hit = null, fallback = null;
    const zooms = PICK_ZOOMS[level];
    for (let i = 0; i < zooms.length; i++) {
      if (i) await sleep(1100);                         // Nominatim 이용 정책: 초당 1회
      const r = await nominatimReverseArea(latlng, zooms[i], signal);
      if (run !== state.runId) return;
      if (!r) continue;
      const ok = level === 'sgg' ? !dongLike(r) : level === 'dong' ? dongLike(r) : true;
      if (ok) { hit = r; break; }
      fallback ??= r;
    }
    drawLayer.clearLayers();
    if (!hit && !fallback) {
      setStep('geo', 'err', tk('geo.pickFail'));
      heroMessage(tk('hero.noBoundary'));
      return;
    }
    const region = regionFromNominatim(hit ?? fallback);
    if (!hit) region.note = tk('geo.note', { level: pickLabel(level), name: () => regionName(region) });
    if (lang === 'en') ensureEnglishNames([region]);
    $('#q').value = region.parts.slice(0, 2).reverse().join(' ');
    try { history.replaceState(null, '', '#' + new URLSearchParams({ q: $('#q').value })); } catch { /* file:// */ }
    await analyzeRegion(region, run, signal);
  } catch (e) { failRun(e, run); }
  finally { if (run === state.runId) setBusy(false); }
}

/* ============================================================
   pipeline
   ============================================================ */
function clearResults() {
  tip.hidden = true;
  clearTimeout(bld.timer);
  bld.ac?.abort();
  Object.assign(bld, { ac: null, data: null, req: null, loading: false, error: null, retryMsg: null });
  for (const g of Object.values(layers)) g.clearLayers();
  drawLayer.clearLayers();
  state.region = null; state.apts = []; state.dongs = null; state.result = null;
  heroMessage(tk('hero.analyzing'));
  $('#tiles').innerHTML = '';
  renderEmptyPanels();
}
function renderEmptyPanels() {
  const after = `<div class="empty-msg">${esc(t('common.afterAnalysis'))}</div>`;
  if (!state.result) {
    $('#histChart').innerHTML = after;
    $('#clusterChart').innerHTML = after;
    $('#bldChart').innerHTML = after;
    $('#dongChart').innerHTML = `<div class="empty-msg">${esc(hasSgisKey() ? t('common.afterAnalysis') : t('common.needKey'))}</div>`;
    $('#dongDetails').hidden = true;
  }
}

async function analyzeRegion(region, run, signal) {
  state.region = region; state.lastRegion = region;
  setStep('geo', 'ok', tk('geo.ok', {
    display: () => regionDisplay(region) + (region.note ? ` · ${tx(region.note)}` : ''),
    area: () => fmt(region.areaKm2),
  }));
  drawRegion();
  map.fitBounds([[region.bbox[1], region.bbox[0]], [region.bbox[3], region.bbox[2]]], { padding: [40, 40] });

  if (region.areaKm2 > MAX_AREA_KM2) {
    setStep('osm', 'err', tk('osm.tooBig', { area: () => fmt(region.areaKm2, 0), max: () => fmtInt(MAX_AREA_KM2) }));
    heroMessage(tk('hero.tooBig'));
    return;
  }

  setStep('osm', 'run', region.areaKm2 > 400 ? tk('osm.bigWait') : tk('osm.querying'));
  setBusy(true, tk('busy.osm'));
  const osmP = fetchApartments(region, signal, err => {
    if (run === state.runId) setStep('osm', 'run', tk('osm.retry', { msg: err }));
  }).then(els => {
    if (run !== state.runId) return null;
    const parsed = parseApartments(els, region);
    const withLv = parsed.apts.filter(a => a.levels).length;
    setStep('osm', parsed.apts.length ? 'ok' : 'err', parsed.apts.length
      ? tk('osm.ok', { n: () => fmtInt(parsed.apts.length), p: () => fmt(withLv / parsed.apts.length * 100, 0) })
      : tk('osm.none'));
    return parsed;
  }).catch(e => {
    if (signal.aborted) throw e;
    setStep('osm', 'err', tk('osm.fail', { msg: e }));
    return { apts: [], medianFp: 400, error: e };
  });

  let sgisP = Promise.resolve(null);
  if (region.kind === 'custom') {
    setStep('sgis', 'skip', tk('sgis.custom'));
  } else if (!hasSgisKey()) {
    setStep('sgis', 'skip', tk('sgis.noKey'));
  } else {
    setStep('sgis', 'run', tk('sgis.auth'));
    sgisP = loadSgis(region, signal, (d, n) => { if (run === state.runId) setStep('sgis', 'run', tk('sgis.progress', { d, n })); })
      .then(s => {
        if (run !== state.runId) return null;
        setStep('sgis', 'ok', tk('sgis.ok', {
          level: tk(s.level), n: s.features.length, year: settings.year,
          warn: s.warnings.length ? tk('sgis.warn', { msg: s.warnings[0] }) : '',
        }));
        return s;
      })
      .catch(e => {
        if (signal.aborted) throw e;
        setStep('sgis', e.skip ? 'skip' : 'err', e);
        return null;
      });
  }

  const [osm, sg] = await Promise.all([osmP, sgisP]);
  if (run !== state.runId || !osm) return;
  state.apts = osm.apts; state.medianFp = osm.medianFp;
  state.sgisLevel = sg?.level || null;
  state.dongs = sg ? buildDongs(sg) : null;

  if (!state.apts.length && !state.dongs) {
    heroMessage(tk('hero.noData'));
    setStep('calc', 'err', tk('calc.noData'));
    return;
  }
  setStep('calc', 'run', tk('calc.running'));
  setBusy(true, tk('busy.calc'));
  await sleep(20);
  if (run !== state.runId) return;
  drawApartments();
  drawDongLines();
  recompute();
  const r = state.result;
  setStep('calc', 'ok', r.cbdSource === 'hex'
    ? tk('calc.ok', { cells: () => fmtInt(r.cells.length), side: () => fmt(r.sideKm * 1000, 0), n: () => fmtInt(r.allClusterCount) })
    : tk('calc.dongOnly'));
}

/* ----- SGIS dongs: area, point membership ----- */
function buildDongs(sg) {
  const dongs = sg.features.map(f => {
    const st = sg.stats.get(f.properties.adm_cd) || {};
    const full = f.properties.adm_nm || f.properties.adm_cd;
    return {
      cd: f.properties.adm_cd, fullKo: full, nameKo: full.split(' ').at(-1), feature: f,
      areaKm2: turf.area(f) / 1e6, bbox: turf.bbox(f), aptUnits: st.apt ?? null, totHouses: st.tot ?? null, ptIdx: [],
    };
  });
  state.apts.forEach((a, i) => {
    for (const d of dongs) {
      const b = d.bbox;
      if (a.lon < b[0] || a.lon > b[2] || a.lat < b[1] || a.lat > b[3]) continue;
      if (turf.booleanPointInPolygon([a.lon, a.lat], d.feature)) { d.ptIdx.push(i); break; }
    }
  });
  return dongs;
}
/* SGIS에는 영문 이름이 없어 영어 모드에서는 로마자로 옮겨 쓴다 */
const dongName = d => (lang === 'en' ? romanizeAdmin(d.nameKo) : d.nameKo);
const dongFull = d => (lang === 'en' ? d.fullKo.split(' ').reverse().map(romanizeAdmin).join(', ') : d.fullKo);

/* ============================================================
   analysis
   ============================================================ */
function readControls() {
  return {
    threshold: +$('#thr').value,
    cellKm: +$('#cell').value,
    smooth: +$('#smooth').value,
    mode: $('input[name="mode"]:checked').value,
  };
}
function weightOf(a, m) {
  if (m !== 'floor') return 1;
  return (a.fp ?? state.medianFp) * (a.levels ?? settings.floors) / 1000;
}
const unitOf = m => t(m === 'floor' ? 'unit.kfloor' : 'unit.bldg');

function computeHex(P) {
  const R = state.region, bbox = R.bbox;
  const lat0 = (bbox[1] + bbox[3]) / 2, lon0 = (bbox[0] + bbox[2]) / 2;
  const kx = 111.32 * Math.cos(lat0 * Math.PI / 180), ky = 110.574;
  const proj = (lon, lat) => [(lon - lon0) * kx, (lat - lat0) * ky];

  const pts = state.apts.map(a => { const [x, y] = proj(a.lon, a.lat); return { a, x, y, w: weightOf(a, P.mode) }; }).filter(p => p.w > 0);
  const N = pts.length, W = pts.reduce((s, p) => s + p.w, 0);
  const D = W / R.areaKm2;

  let side = P.cellKm > 0 ? P.cellKm : clamp(Math.sqrt(R.areaKm2 / 650 / 2.598), 0.12, 3);
  const bboxArea = (bbox[2] - bbox[0]) * kx * (bbox[3] - bbox[1]) * ky;
  while (bboxArea / (2.598 * side * side) > 7000) side *= 1.25;

  const padLon = side * 2 / kx, padLat = side * 2 / ky;
  const grid = turf.hexGrid([bbox[0] - padLon, bbox[1] - padLat, bbox[2] + padLon, bbox[3] + padLat], side, { units: 'kilometers' });
  let cells = grid.features.map(f => {
    const ring = f.geometry.coordinates[0];
    let sx = 0, sy = 0;
    for (let k = 0; k < 6; k++) { sx += ring[k][0]; sy += ring[k][1]; }
    const lon = sx / 6, lat = sy / 6, [x, y] = proj(lon, lat);
    return { feature: f, lon, lat, x, y, raw: 0, n: 0, f: 0, lq: 0, cl: -1 };
  });
  const empty = { cells: [], clusters: [], allClusterCount: 0, N, W, D, sideKm: side, cellArea: 0, threshold: P.threshold, mode: P.mode };
  if (!cells.length) return empty;

  const mid = cells[Math.floor(cells.length / 2)];
  let nn = Infinity;
  for (const c of cells) { const d = Math.hypot(c.x - mid.x, c.y - mid.y); if (d > 1e-9 && d < nn) nn = d; }
  const cellArea = ringAreaM2(mid.feature.geometry.coordinates[0].slice(0, 6)) / 1e6;

  const bucket = (arr, size) => {
    const h = new Map();
    for (const o of arr) {
      const k = `${Math.floor(o.x / size)},${Math.floor(o.y / size)}`;
      (h.get(k) || h.set(k, []).get(k)).push(o);
    }
    return h;
  };
  const near = (h, size, x, y, fn) => {
    const i = Math.floor(x / size), j = Math.floor(y / size);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const arr = h.get(`${i + di},${j + dj}`); if (arr) for (const o of arr) fn(o);
    }
  };

  // 건물 → 가장 가까운 격자 중심 (= 그 육각형에 포함)
  const cellHash = bucket(cells, nn);
  for (const p of pts) {
    let best = null, bd = Infinity;
    near(cellHash, nn, p.x, p.y, c => { const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2; if (d < bd) { bd = d; best = c; } });
    if (best) { best.raw += p.w; best.n++; }
  }
  cells = cells.filter(c => c.n > 0 || turf.booleanPointInPolygon([c.lon, c.lat], R.feature));

  // km²당 밀도
  if (P.smooth > 0 && N) {
    const h = side * P.smooth, cut = 3 * h, cut2 = cut * cut, inv2h2 = 1 / (2 * h * h), k = 1 / (2 * Math.PI * h * h);
    const ph = bucket(pts, cut);
    for (const c of cells) {
      let s = 0;
      near(ph, cut, c.x, c.y, p => { const d2 = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (d2 < cut2) s += p.w * Math.exp(-d2 * inv2h2); });
      c.f = s * k;
    }
  } else {
    for (const c of cells) c.f = c.raw / cellArea;
  }
  for (const c of cells) c.lq = D > 0 ? c.f / D : 0;

  // 후보 격자 → 인접 군집
  let cand = cells.filter(c => c.lq >= P.threshold && c.f > 0);
  let fallback = false;
  if (!cand.length && N) {
    const sorted = cells.filter(c => c.f > 0).sort((a, b) => b.lq - a.lq);
    cand = sorted.slice(0, Math.max(3, Math.ceil(cells.length * 0.03)));
    fallback = true;
  }
  const parent = new Map(cand.map(c => [c, c]));
  const find = c => { while (parent.get(c) !== c) { parent.set(c, parent.get(parent.get(c))); c = parent.get(c); } return c; };
  const candHash = bucket(cand, nn);
  const adj2 = (nn * 1.2) ** 2;
  for (const c of cand) {
    near(candHash, nn, c.x, c.y, o => {
      if (o !== c && (o.x - c.x) ** 2 + (o.y - c.y) ** 2 <= adj2) { const a = find(c), b = find(o); if (a !== b) parent.set(a, b); }
    });
  }
  const groups = new Map();
  for (const c of cand) { const r = find(c); (groups.get(r) || groups.set(r, []).get(r)).push(c); }
  const clusters = [...groups.values()].map(cs => {
    let mass = 0, n = 0, peak = 0, sx = 0, sy = 0, sf = 0;
    for (const c of cs) {
      mass += c.f * cellArea; n += c.n; peak = Math.max(peak, c.lq);
      sx += c.lon * c.f; sy += c.lat * c.f; sf += c.f;
    }
    const areaKm2 = cs.length * cellArea;
    return { cells: cs, mass, n, peak, areaKm2, lqMean: D > 0 ? (mass / areaKm2) / D : 0, lon: sx / sf, lat: sy / sf };
  }).sort((a, b) => b.mass - a.mass);

  const cbdMass = clusters[0]?.mass || 0;
  const shown = clusters.filter((c, i) => i === 0 || c.mass >= cbdMass * 0.05).slice(0, 5);
  shown.forEach((cl, i) => { for (const c of cl.cells) c.cl = i; cl.rank = i; });

  return { cells, clusters: shown, allClusterCount: clusters.length, N, W, D, sideKm: side, cellArea, threshold: P.threshold, fallback, mode: P.mode };
}

function computeDongs(P, hex) {
  const dongs = state.dongs; if (!dongs?.length) return null;
  const totArea = dongs.reduce((s, d) => s + d.areaKm2, 0);
  const rows = dongs.map(d => ({ d, osmW: d.ptIdx.reduce((s, i) => s + weightOf(state.apts[i], P.mode), 0), osmN: d.ptIdx.length }));
  const totOsm = rows.reduce((s, r) => s + r.osmW, 0);
  const aptKnown = rows.filter(r => r.d.aptUnits != null);
  const totApt = aptKnown.reduce((s, r) => s + r.d.aptUnits, 0);
  const totAptArea = aptKnown.reduce((s, r) => s + r.d.areaKm2, 0);
  for (const r of rows) {
    const a = r.d.areaKm2 || 1e-9;
    r.lqOsm = totOsm > 0 ? (r.osmW / a) / (totOsm / totArea) : null;
    r.lqSgis = r.d.aptUnits != null && totApt > 0 ? (r.d.aptUnits / a) / (totApt / totAptArea) : null;
    const vs = [r.lqOsm, r.lqSgis].filter(v => v != null);
    r.comp = vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null;
    r.aptShare = r.d.aptUnits != null && r.d.totHouses ? r.d.aptUnits / r.d.totHouses : null;
  }
  const ranking = rows.filter(r => r.comp != null).sort((a, b) => b.comp - a.comp);
  const cbd = hex?.clusters?.[0];
  const cbdDong = cbd ? rows.find(r => turf.booleanPointInPolygon([cbd.lon, cbd.lat], r.d.feature)) || null : null;
  return { rows, ranking, totApt, totOsm, cbdDong, hasSgisStats: aptKnown.length > 0 };
}

let recomputeTimer = null;
function scheduleRecompute() { clearTimeout(recomputeTimer); recomputeTimer = setTimeout(recompute, 120); }

function recompute() {
  if (!state.region || (!state.apts.length && !state.dongs)) return;
  const P = readControls();
  const hex = state.apts.length ? computeHex(P)
    : { cells: [], clusters: [], allClusterCount: 0, N: 0, W: 0, D: 0, sideKm: 0, threshold: P.threshold, mode: P.mode };
  const dong = computeDongs(P, hex);
  if (dong) for (const cl of hex.clusters) {
    cl.dong = dong.rows.find(r => turf.booleanPointInPolygon([cl.lon, cl.lat], r.d.feature))?.d || null;
  }
  const cbdSource = hex.clusters.length ? 'hex' : (dong?.ranking.length ? 'dong' : null);
  state.result = { ...hex, dong, cbdSource, P };
  renderAll();
  scheduleBuildingMix();
  if (!dong) resolveClusterNames();
}

async function resolveClusterNames() {
  const r = state.result, run = state.runId, forLang = lang;
  for (const cl of r.clusters.slice(0, 3)) {
    cl.revNames ??= {};
    if (cl.dong || cl.revNames[forLang] !== undefined) continue;
    const name = await nominatimLater(() => nominatimReverseName(cl.lat, cl.lon, forLang));
    if (run !== state.runId || state.result !== r) return;
    cl.revNames[forLang] = name;
    renderHero(); renderClusterChart();
  }
}

/* ============================================================
   rendering – map
   ============================================================ */
function drawRegion() {
  layers.region.clearLayers();
  L.geoJSON(state.region.feature, {
    renderer: renderers.region, interactive: false,
    style: { color: mapInk().ink, weight: 2, opacity: .7, dashArray: '2 5', fill: false },
  }).addTo(layers.region);
}
function drawApartments() {
  layers.apts.clearLayers();
  const color = mapInk().ink2;
  for (const a of state.apts) {
    L.circleMarker([a.lat, a.lon], { renderer: renderers.apts, radius: 2, stroke: false, fillColor: color, fillOpacity: .75, interactive: false }).addTo(layers.apts);
  }
}
function drawDongLines() {
  layers.dongLine.clearLayers();
  if (!state.dongs) return;
  L.geoJSON(turf.featureCollection(state.dongs.map(d => d.feature)), {
    renderer: renderers.dongLine, interactive: false,
    style: { color: mapInk().ink2, weight: 1, opacity: .5, fill: false },
  }).addTo(layers.dongLine);
}
function hexTip(c, r) {
  const tag = c.cl === 0 ? `<b style="color:var(--cbd)">●</b> ${esc(t('tip.cbd'))}<br>`
    : c.cl > 0 ? `<b style="color:var(--sub)">●</b> ${esc(t('cluster.subN', { n: c.cl }))}<br>` : '';
  return `${tag}${t('tip.apts', { n: fmtInt(c.n) })}<br>
    <span class="m">${esc(t('tip.density', { v: fmt(c.f, 1), u: unitOf(r.mode) }))}</span><br>
    ${esc(t('tip.vsAvg'))} <b>×${fmtFixed(c.lq, 2)}</b>`;
}
function drawHex(r) {
  layers.hex.clearLayers();
  if (!r.cells.length) return;
  const surf = mapInk().ground;
  for (const c of r.cells) {
    if (c.f <= 0 || (c.n === 0 && c.lq < 0.05)) continue;
    L.polygon(c.feature.geometry.coordinates[0].map(([x, y]) => [y, x]), {
      renderer: renderers.hex, color: surf, weight: 1, opacity: .9, fillColor: lqColor(c.lq), fillOpacity: .72,
    }).bindTooltip(() => hexTip(c, r), { sticky: true, direction: 'top', opacity: 1 }).addTo(layers.hex);
  }
}
function clusterOutline(cl) {
  if (cl._outline) return cl._outline;
  let g = null;
  try { g = cl.cells.length === 1 ? cl.cells[0].feature : turf.union(turf.featureCollection(cl.cells.map(c => c.feature))); } catch { g = null; }
  if (!g) g = turf.convex(turf.featureCollection(cl.cells.map(c => turf.point([c.lon, c.lat])))) || cl.cells[0].feature;
  return (cl._outline = g);
}
function drawCbd(r) {
  layers.cbd.clearLayers();
  const { ground: surf, cbd: cbdC, sub: subC } = mapInk();
  if (r.cbdSource === 'hex') {
    [...r.clusters].reverse().forEach(cl => {
      const isC = cl.rank === 0, color = isC ? cbdC : subC;
      L.geoJSON(clusterOutline(cl), {
        renderer: renderers.cbd, interactive: false,
        style: { color, weight: isC ? 3 : 2, opacity: 1, dashArray: isC ? null : '6 4', fill: false },
      }).addTo(layers.cbd);
      L.circleMarker([cl.lat, cl.lon], { renderer: renderers.cbd, radius: isC ? 7 : 5, color: surf, weight: 2, fillColor: color, fillOpacity: 1 })
        .bindTooltip(isC ? 'CBD' : t('cluster.subN', { n: cl.rank }), { permanent: true, direction: 'top', offset: [0, -7], className: 'lbl', opacity: 1 })
        .addTo(layers.cbd);
    });
  } else if (r.cbdSource === 'dong') {
    const top = r.dong.ranking[0];
    L.geoJSON(top.d.feature, { renderer: renderers.cbd, interactive: false, style: { color: cbdC, weight: 3, fill: false } }).addTo(layers.cbd);
    const [lon, lat] = turf.pointOnFeature(top.d.feature).geometry.coordinates;
    L.circleMarker([lat, lon], { renderer: renderers.cbd, radius: 7, color: surf, weight: 2, fillColor: cbdC, fillOpacity: 1 })
      .bindTooltip('CBD', { permanent: true, direction: 'top', offset: [0, -7], className: 'lbl', opacity: 1 }).addTo(layers.cbd);
  }
}
function drawDongFill(r) {
  layers.dongFill.clearLayers();
  if (!r.dong) return;
  const surf = mapInk().ground;
  for (const row of r.dong.rows) {
    L.geoJSON(row.d.feature, {
      renderer: renderers.dongFill,
      style: { color: surf, weight: 1, fill: row.comp != null, fillColor: row.comp != null ? lqColor(row.comp) : surf, fillOpacity: .72 },
    }).bindTooltip(() => dongTip(row, r), { sticky: true, direction: 'top', opacity: 1 }).addTo(layers.dongFill);
  }
}
function dongTip(row, r) {
  return `<b>${esc(dongFull(row.d))}</b><br>
    <span class="m">${esc(t('dong.tipArea', { a: fmt(row.d.areaKm2, 2) }))}</span><br>
    ${esc(t('dong.tipSgis', { v: row.d.aptUnits != null ? t('fmt.units', { n: fmtInt(row.d.aptUnits) }) : '–' }))}${row.aptShare != null ? ` <span class="m">${esc(t('dong.tipShare', { p: fmt(row.aptShare * 100, 0) }))}</span>` : ''}<br>
    ${esc(t('dong.tipOsm', { n: fmtInt(row.osmN) }))}${r.mode === 'floor' ? ` <span class="m">(${fmt(row.osmW, 0)} ${esc(unitOf(r.mode))})</span>` : ''}<br>
    LQ SGIS ×${fmtFixed(row.lqSgis, 2)} · OSM ×${fmtFixed(row.lqOsm, 2)}<br>
    ${esc(t('dong.tipComp'))} <b>×${fmtFixed(row.comp, 2)}</b>`;
}

/* ============================================================
   rendering – panel
   ============================================================ */
function heroMessage(msg) {
  state.heroMsg = msg;
  $('#hero').className = 'card hero placeholder';
  $('#hero').innerHTML = `<div class="eyebrow"><span class="dot"></span>${esc(t('hero.eyebrow'))}</div><div class="name">${esc(tx(msg))}</div>`;
}
function clusterName(cl) {
  if (cl.dong) return t('cluster.area', { name: dongName(cl.dong) });
  const rev = cl.revNames?.[lang];
  return rev ? t('cluster.area', { name: rev }) : null;
}
function renderHero() {
  const r = state.result, hero = $('#hero');
  if (!r?.cbdSource) { heroMessage(tk('hero.insufficient')); return; }
  hero.className = 'card hero';
  if (r.cbdSource === 'dong') {
    const top = r.dong.ranking[0];
    hero.innerHTML = `
      <div class="eyebrow"><span class="dot"></span>${esc(t('hero.byDong'))}</div>
      <div class="name">${esc(dongFull(top.d))}</div>
      <div class="num">×${fmtFixed(top.comp, 1)}<small>${esc(t('hero.vsAvg'))}</small></div>
      <div class="desc">${esc(t('hero.dongOnlyDesc'))}</div>`;
    return;
  }
  const cbd = r.clusters[0];
  const name = clusterName(cbd) || t('hero.center', { lat: cbd.lat.toFixed(4), lon: cbd.lon.toFixed(4) });
  const share = r.N ? cbd.n / r.N : 0;
  const bestDong = r.dong?.ranking[0];
  hero.innerHTML = `
    <div class="eyebrow"><span class="dot"></span>${esc(t('hero.eyebrow'))} · ${esc(regionName(state.region))}</div>
    <div class="name">${esc(name)}</div>
    <div class="num">×${fmtFixed(cbd.lqMean, 1)}<small>${esc(t('hero.densityVsAvg'))}</small></div>
    <div class="desc">${esc(t('hero.desc', {
      area: fmt(cbd.areaKm2, 2), pa: fmt(cbd.areaKm2 / state.region.areaKm2 * 100, 1),
      ps: fmt(share * 100, 1), peak: fmtFixed(cbd.peak, 1),
    }))}</div>
    ${r.fallback ? `<div class="note">${esc(t('hero.fallback', { thr: fmtFixed(r.threshold, 1) }))}</div>` : ''}
    ${bestDong && r.dong.cbdDong && bestDong !== r.dong.cbdDong
      ? `<div class="note">${t('hero.bestDong', { name: esc(dongName(bestDong.d)), v: fmtFixed(bestDong.comp, 1) })}</div>` : ''}`;
}

function renderTiles() {
  const r = state.result, R = state.region;
  const u = unitOf(r.mode);
  const cbd = r.cbdSource === 'hex' ? r.clusters[0] : null;
  const tiles = [
    [t('tile.area'), fmt(R.areaKm2, 1), 'km²'],
    [t('tile.apts'), fmtInt(r.N), t('unit.bldg')],
    [t('tile.avg'), fmt(r.D, r.D < 10 ? 2 : 1), `${u}/km²`],
    [t('tile.cbdArea'), cbd ? fmt(cbd.areaKm2, 2) : '–', 'km²'],
    [t('tile.cbdShare'), cbd && r.N ? fmt(cbd.n / r.N * 100, 1) : '–', '%'],
    r.dong?.hasSgisStats
      ? [t('tile.sgisApt'), fmtInt(r.dong.totApt), t('unit.units')]
      : [t('tile.side'), r.sideKm ? fmt(r.sideKm * 1000, 0) : '–', 'm'],
  ];
  $('#tiles').innerHTML = tiles.map(([l, v, s]) => `<div class="tile"><div class="l" title="${esc(l)}">${esc(l)}</div><div class="v">${v}<small>${esc(s)}</small></div></div>`).join('');
}

function barTop(x, y, w, h, rad) {
  if (h <= 0) return '';
  const rr = Math.min(rad, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function renderHist() {
  const r = state.result, el = $('#histChart');
  const vals = r.cells.filter(c => c.n > 0).map(c => c.lq).sort((a, b) => a - b);
  if (!vals.length) { el.innerHTML = `<div class="empty-msg">${esc(t('hist.none'))}</div>`; return; }
  const q99 = vals[Math.floor(0.99 * (vals.length - 1))];
  const maxX = Math.max(r.threshold * 1.4, Math.min(q99 * 1.05, 20), 2);
  const bw = niceStep(maxX / 22);
  const nb = Math.ceil(maxX / bw);
  const bins = Array.from({ length: nb }, (_, i) => ({ x0: i * bw, x1: (i + 1) * bw, n: 0 }));
  for (const v of vals) bins[Math.min(nb - 1, Math.floor(v / bw))].n++;
  const W = 380, H = 170, L0 = 34, R0 = 8, T0 = 12, B0 = 24;
  const iw = W - L0 - R0, ih = H - T0 - B0;
  const maxN = Math.max(...bins.map(b => b.n));
  const ys = niceStep(maxN / 3), yMax = Math.max(ys, Math.ceil(maxN / ys) * ys);
  const sx = v => L0 + v / (nb * bw) * iw, sy = v => T0 + ih - v / yMax * ih;
  const colW = iw / nb;
  let g = '';
  for (let tv = 0; tv <= yMax + 1e-9; tv += ys) {
    g += `<line class="gridline" x1="${L0}" x2="${W - R0}" y1="${sy(tv)}" y2="${sy(tv)}"/><text x="${L0 - 6}" y="${sy(tv) + 3.5}" text-anchor="end">${fmtInt(tv)}</text>`;
  }
  const xs = niceStep(nb * bw / 6);
  for (let tv = 0; tv <= nb * bw + 1e-9; tv += xs) g += `<text x="${sx(tv)}" y="${H - 7}" text-anchor="middle">×${fmt(tv, 1)}</text>`;
  const barW = Math.min(24, colW - 2);
  bins.forEach((b, i) => {
    const on = b.x0 >= r.threshold - 1e-9;
    const partial = !on && b.x1 > r.threshold;
    const x = sx(b.x0) + (colW - barW) / 2;
    g += `<path d="${barTop(x, sy(b.n), barW, sy(0) - sy(b.n), 4)}" fill="${on ? 'var(--cbd)' : 'var(--bar-soft)'}"/>`;
    const label = i === nb - 1 ? t('hist.over', { v: fmt(b.x0, 2) }) : `×${fmt(b.x0, 2)} – ${fmt(b.x1, 2)}`;
    const tipHtml = `<b>LQ ${esc(label)}</b><br>${esc(t('hist.cells', { n: fmtInt(b.n), p: fmt(b.n / vals.length * 100, 1) }))}` +
      (on ? `<br><span class="m">${esc(t('hist.candZone'))}</span>` : partial ? `<br><span class="m">${esc(t('hist.partial'))}</span>` : '');
    g += `<rect class="hit" x="${sx(b.x0)}" y="${T0}" width="${colW}" height="${ih}" data-tip="${esc(tipHtml)}"/>`;
  });
  g += `<line class="baseline" x1="${L0}" x2="${W - R0}" y1="${sy(0)}" y2="${sy(0)}"/>`;
  const tx0 = sx(Math.min(r.threshold, nb * bw));
  const flip = tx0 > W - 110;
  g += `<line class="thr" x1="${tx0}" x2="${tx0}" y1="${T0 - 4}" y2="${sy(0)}"/>`;
  g += `<text class="thr-l" x="${tx0 + (flip ? -5 : 5)}" y="${T0 + 6}" text-anchor="${flip ? 'end' : 'start'}">${esc(t('hist.thr', { v: fmtFixed(r.threshold, 1) }))}</text>`;
  const over = vals.filter(v => v >= r.threshold).length;
  el.innerHTML = `
    <div class="legend-row">
      <span><i class="sw" style="background:var(--cbd)"></i>${esc(t('hist.legendCand', { v: fmtFixed(r.threshold, 1), n: fmtInt(over) }))}</span>
      <span><i class="sw" style="background:var(--bar-soft)"></i>${esc(t('hist.legendOther', { n: fmtInt(vals.length - over) }))}</span>
    </div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('hist.aria'))}">${g}</svg>`;
}

function renderClusterChart() {
  const r = state.result, el = $('#clusterChart');
  if (r.cbdSource !== 'hex') { el.innerHTML = `<div class="empty-msg">${esc(t('cluster.none'))}</div>`; return; }
  const maxShare = Math.max(...r.clusters.map(c => c.n / (r.N || 1)), 1e-9);
  const rows = r.clusters.map(cl => {
    const isC = cl.rank === 0;
    const share = r.N ? cl.n / r.N : 0;
    const label = isC ? 'CBD' : t('cluster.subN', { n: cl.rank });
    const nm = clusterName(cl);
    const tipHtml = `<b>${esc(label)}</b>${nm ? ` · ${esc(nm)}` : ''}<br>
      ${esc(t('cluster.tipApts', { n: fmtInt(cl.n), p: fmt(share * 100, 1) }))}<br>
      <span class="m">${esc(t('cluster.tipArea', { a: fmt(cl.areaKm2, 2), c: cl.cells.length }))}</span><br>
      ${esc(t('cluster.tipLq', { m: fmtFixed(cl.lqMean, 2), pk: fmtFixed(cl.peak, 2) }))}<br>
      <span class="m">${esc(t('cluster.tipClick'))}</span>`;
    return `<div class="bar-row" data-cl="${cl.rank}" data-tip="${esc(tipHtml)}">
      <div class="nm">${esc(label)}${nm ? `<br><small>${esc(nm)}</small>` : ''}</div>
      <div class="track"><div class="fill" style="width:calc(${share / maxShare} * (100% - 110px));background:${isC ? 'var(--cbd)' : 'var(--sub)'}"></div>
      <span class="val">${fmt(share * 100, 1)}% · ×${fmtFixed(cl.lqMean, 1)}</span></div>
    </div>`;
  }).join('');
  const more = r.allClusterCount > r.clusters.length
    ? `<div class="ref-note">${esc(t('cluster.more', { n: r.allClusterCount - r.clusters.length }))}</div>` : '';
  el.innerHTML = `
    <div class="legend-row"><span><i class="sw" style="background:var(--cbd)"></i>CBD</span><span><i class="sw" style="background:var(--sub)"></i>${esc(t('cluster.legendSub'))}</span><span style="color:var(--muted)">${esc(t('cluster.legendVal'))}</span></div>
    <div class="bars">${rows}</div>${more}`;
}
$('#clusterChart').addEventListener('click', e => {
  const row = e.target.closest('[data-cl]'); if (!row) return;
  const cl = state.result?.clusters[+row.dataset.cl]; if (!cl) return;
  const b = turf.bbox(clusterOutline(cl));
  map.fitBounds([[b[1], b[0]], [b[3], b[2]]], { padding: [60, 60], maxZoom: 16 });
});

function renderDongChart() {
  const r = state.result, el = $('#dongChart');
  if (!r.dong) {
    const msg = state.region?.kind === 'custom' ? t('dong.custom')
      : hasSgisKey() ? t('dong.loadFail') : t('dong.needKey');
    el.innerHTML = `<div class="empty-msg">${esc(msg)}</div>`;
    $('#dongDetails').hidden = true;
    return;
  }
  const d = r.dong;
  $('#dongSub').textContent = d.hasSgisStats ? t('dong.subStats', { year: settings.year }) : t('dong.subOsm');
  const top = d.ranking.slice(0, 12);
  if (!top.length) { el.innerHTML = `<div class="empty-msg">${esc(t('dong.noLq'))}</div>`; return; }
  const maxV = Math.max(...top.map(x => x.comp), 1.2);
  const trackCalc = '(100% - 50px)';
  const cbdRow = r.cbdSource === 'dong' ? d.ranking[0] : d.cbdDong;
  const rows = top.map(row => `<div class="bar-row" data-cd="${esc(row.d.cd)}" data-tip="${esc(dongTip(row, r))}">
      <div class="nm" title="${esc(dongFull(row.d))}">${esc(dongName(row.d))}</div>
      <div class="track"><div class="fill" style="width:calc(${row.comp / maxV} * ${trackCalc});background:${row === cbdRow ? 'var(--cbd)' : 'var(--bar)'}"></div>
      <span class="val">×${fmtFixed(row.comp, 1)}</span>
      <span class="refline" style="left:calc(${1 / maxV} * ${trackCalc})"></span></div>
    </div>`).join('');
  el.innerHTML = `
    <div class="legend-row"><span><i class="sw" style="background:var(--cbd)"></i>${esc(t('dong.legendCbd'))}</span><span><i class="sw" style="background:var(--bar)"></i>${esc(t('dong.legendOther'))}</span><span style="color:var(--muted)">${esc(t('dong.legendRef'))}</span></div>
    <div class="bars">${rows}</div>
    ${d.ranking.length > 12 ? `<div class="ref-note">${esc(t('dong.more', { n: d.ranking.length }))}</div>` : ''}`;

  $('#dongDetails').hidden = false;
  $('#dongTable').innerHTML = `<table>
    <thead><tr>${t('dong.th').map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${d.ranking.map(row => `<tr class="${row === cbdRow ? 'is-cbd' : ''}">
      <td>${esc(dongName(row.d))}</td><td>${fmtFixed(row.d.areaKm2, 2)}</td><td>${row.d.aptUnits != null ? fmtInt(row.d.aptUnits) : '–'}</td>
      <td>${row.aptShare != null ? fmt(row.aptShare * 100, 0) + '%' : '–'}</td><td>${fmtInt(row.osmN)}</td>
      <td>${fmtFixed(row.lqSgis, 2)}</td><td>${fmtFixed(row.lqOsm, 2)}</td><td><b>${fmtFixed(row.comp, 2)}</b></td></tr>`).join('')}</tbody></table>`;
}
$('#dongChart').addEventListener('click', e => {
  const row = e.target.closest('[data-cd]'); if (!row || !state.dongs) return;
  const d = state.dongs.find(x => x.cd === row.dataset.cd); if (!d) return;
  if (!map.hasLayer(layers.dongFill)) map.addLayer(layers.dongFill);
  map.fitBounds([[d.bbox[1], d.bbox[0]], [d.bbox[3], d.bbox[2]]], { padding: [60, 60], maxZoom: 16 });
});

/* ----- 건물 유형 구성 (도넛) ----- */
const bld = { ac: null, data: null, req: null, loading: false, error: null, retryMsg: null, timer: null };
const bldColor = (x, dark = isDark()) => (dark ? x.dark : x.light);
const distKm = (a, b) => Math.hypot((a.lon - b.lon) * 111.32 * Math.cos(a.lat * Math.PI / 180), (a.lat - b.lat) * 110.574);

/* 칸 안 라벨은 채움색과 대비가 더 큰 쪽(흰색/먹색)을 쓴다 */
function textOn(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (lum + 0.05) / 0.05 > 1.05 / (lum + 0.05) ? '#0b0b0b' : '#ffffff';
}
function bldCenter(r) {
  if (r.cbdSource === 'hex') return { lat: r.clusters[0].lat, lon: r.clusters[0].lon, labelKey: 'bld.cCbd' };
  if (r.cbdSource === 'dong') {
    const [lon, lat] = turf.pointOnFeature(r.dong.ranking[0].d.feature).geometry.coordinates;
    return { lat, lon, labelKey: 'bld.cDong' };
  }
  const [lon, lat] = turf.centroid(state.region.feature).geometry.coordinates;
  return { lat, lon, labelKey: 'bld.cRegion' };
}
function scheduleBuildingMix() { clearTimeout(bld.timer); bld.timer = setTimeout(() => updateBuildingMix(), 700); }

async function updateBuildingMix(force = false) {
  const r = state.result; if (!r || !state.region) return;
  const center = bldCenter(r), radiusKm = +$('#bldRadius').value, region = state.region;
  const same = x => x && x.region === region && x.radiusKm === radiusKm && distKm(x.center, center) < 0.3;
  if (!force && same(bld.data)) return;            // 임계값을 조금 바꿔 중심이 300 m 안에서 움직이면 다시 받지 않는다
  if (!force && bld.loading && same(bld.req)) return;

  bld.ac?.abort();
  const ac = new AbortController();
  Object.assign(bld, { ac, loading: true, error: null, retryMsg: null, req: { center, radiusKm, region } });
  renderBuildingMix();
  try {
    const els = await fetchBuildings(center, radiusKm, ac.signal, err => {
      if (ac !== bld.ac) return;
      bld.retryMsg = err; renderBuildingMix();
    });
    if (ac !== bld.ac) return;
    bld.data = { ...summarizeBuildings(els, center, radiusKm), region };
  } catch (e) {
    if (ac.signal.aborted) return;
    bld.error = e; bld.data = null;
  } finally {
    if (ac === bld.ac) { bld.loading = false; renderBuildingMix(); drawBuildingLayer(); }
  }
}

function donutArc(cx, cy, R, r, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const pt = (rad, a) => `${(cx + rad * Math.sin(a)).toFixed(2)},${(cy - rad * Math.cos(a)).toFixed(2)}`;
  return `M${pt(R, a0)}A${R},${R} 0 ${large} 1 ${pt(R, a1)}L${pt(r, a1)}A${r},${r} 0 ${large} 0 ${pt(r, a0)}Z`;
}

function renderBuildingMix() {
  const el = $('#bldChart');
  const radiusKm = +$('#bldRadius').value;
  const center = bld.loading ? bld.req?.center : bld.data?.center;
  $('#bldSub').textContent = t('bld.sub', { center: t(center?.labelKey ?? 'bld.cCbd'), r: radiusKm });
  if (!state.result) { el.innerHTML = `<div class="empty-msg">${esc(t('common.afterAnalysis'))}</div>`; return; }
  if (bld.loading) {
    el.innerHTML = `<div class="loading-msg"><span class="spin"></span><span>${esc(t('bld.loading', { r: radiusKm }))}${bld.retryMsg ? `<br><small>${esc(t('bld.retry', { msg: bld.retryMsg }))}</small>` : ''}</span></div>`;
    return;
  }
  if (bld.error) {
    el.innerHTML = `<div class="empty-msg">${esc(t('bld.fail', { msg: bld.error }))} · <button type="button" class="link" data-bld-retry>${esc(t('bld.retryBtn'))}</button></div>`;
    return;
  }
  const d = bld.data;
  if (!d) { el.innerHTML = `<div class="empty-msg">${esc(t('common.afterAnalysis'))}</div>`; return; }
  if (!d.total) { el.innerHTML = `<div class="empty-msg">${esc(t('bld.none', { r: d.radiusKm }))}</div>`; return; }

  const dark = isDark();
  const types = BLD_TYPES.map(x => ({ ...x, label: bldLabel(x), n: d.counts[x.key], share: d.counts[x.key] / d.total, color: bldColor(x, dark) }));
  const cx = 90, cy = 90, R = 88, r = 48;
  let a = 0, segs = '', labels = '';
  for (const x of types) {
    if (!x.n) continue;
    const a1 = a + x.share * 2 * Math.PI;
    const tipAttr = esc(`<b>${esc(x.label)}</b><br>${esc(nBldg(x.n))} · ${fmtFixed(x.share * 100, 1)}%`);
    segs += x.share > 0.9999
      ? `<path d="${donutArc(cx, cy, R, r, 0, Math.PI)}" fill="${x.color}" data-tip="${tipAttr}"/><path d="${donutArc(cx, cy, R, r, Math.PI, 2 * Math.PI)}" fill="${x.color}" data-tip="${tipAttr}"/>`
      : `<path d="${donutArc(cx, cy, R, r, a, a1)}" fill="${x.color}" data-tip="${tipAttr}"/>`;
    if (x.share >= 0.09) {
      const m = (a + a1) / 2, rr = (R + r) / 2;
      labels += `<text class="seg-l" x="${(cx + rr * Math.sin(m)).toFixed(1)}" y="${(cy - rr * Math.cos(m) + 4).toFixed(1)}" text-anchor="middle" fill="${textOn(x.color)}">${fmtFixed(x.share * 100, 1)}%</text>`;
    }
    a = a1;
  }
  const unkShare = d.counts.unk / d.total;
  el.innerHTML = `
    <div class="donut-title">${esc(t('bld.head', { r: d.radiusKm, n: fmtInt(d.total) }))}</div>
    <div class="donut-wrap">
      <svg class="donut" viewBox="0 0 180 180" role="img" aria-label="${esc(t('bld.aria', { r: d.radiusKm }))}">
        ${segs}${labels}
        <text class="c-num" x="90" y="92" text-anchor="middle">${fmtFixed((1 - unkShare) * 100, 1)}%</text>
        <text class="c-sub" x="90" y="109" text-anchor="middle">${esc(t('bld.known'))}</text>
      </svg>
      <div class="bld-legend">
        ${types.map(x => `<div class="lg-row${x.n ? '' : ' zero'}" data-tip="${esc(`<b>${esc(x.label)}</b><br>${esc(nBldg(x.n))} · ${fmtFixed(x.share * 100, 1)}%`)}">
          <i class="sw" style="background:${x.color}"></i><span>${esc(x.label)}</span>
          <span class="lg-c">${esc(nBldg(x.n))}</span><span class="lg-p">${fmtFixed(x.share * 100, 1)}%</span></div>`).join('')}
      </div>
    </div>
    ${unkShare > 0.3 ? `<div class="ref-note">${esc(t('bld.unkNote', { p: fmt(unkShare * 100, 0) }))}</div>` : ''}`;
}

function drawBuildingLayer() {
  layers.bldRing.clearLayers(); layers.bldPts.clearLayers();
  const d = bld.data;
  if (!d || !state.region || d.region !== state.region) return;
  const dark = darkGround();
  L.circle([d.center.lat, d.center.lon], {
    radius: d.radiusKm * 1000, renderer: renderers.region, color: mapInk().ink, weight: 1.5, opacity: .7, dashArray: '8 6', fill: false, interactive: false,
  }).addTo(layers.bldRing);
  const col = Object.fromEntries(BLD_TYPES.map(x => [x.key, bldColor(x, dark)]));
  for (const p of d.pts) {
    L.circleMarker([p.lat, p.lon], { renderer: renderers.bld, radius: 2.5, stroke: false, fillColor: col[p.type], fillOpacity: .9, interactive: false }).addTo(layers.bldPts);
  }
}
$('#bldRadius').addEventListener('change', () => updateBuildingMix());
$('#bldChart').addEventListener('click', e => { if (e.target.closest('[data-bld-retry]')) updateBuildingMix(true); });

function renderAll() {
  tip.hidden = true;   // 다시 그리면 마우스 아래 요소가 바뀌어 mouseout이 오지 않는다
  const r = state.result; if (!r) return;
  drawHex(r); drawDongFill(r); drawCbd(r);
  renderHero(); renderTiles(); renderHist(); renderClusterChart(); renderDongChart();
}
function onThemeChange() {
  renderLegend(); renderDraw();
  if (state.region) { drawRegion(); drawApartments(); drawDongLines(); }
  if (state.result) renderAll();
  renderBuildingMix(); drawBuildingLayer();
}

/* ============================================================
   분석 조건 설명 팝오버: 그림 + 설명
   ============================================================ */
const figSvg = (w, h, body) => `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">${body}</svg>`;
const figArrow = (x, y) => `<path d="M${x - 7},${y}h12m-4,-4l4,4-4,4" stroke="var(--muted)" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
function hexPath(cx, cy, s) {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 30);
    d += `${i ? 'L' : 'M'}${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)}`;
  }
  return d + 'Z';
}
const figRamp = () => (isDark() ? RAMP_DARK : RAMP_LIGHT);

/* 같은 격자 값에 임계값만 달리 적용 */
function figThreshold() {
  const vals = [[0.4, 1.2, 1.8, 1.1, 0.5], [0.9, 2.2, 3.6, 2.0, 0.8], [0.6, 1.6, 2.4, 1.3, 0.4]];
  const panel = (ox, thr, title, capKey) => {
    const s = 10.5, w = Math.sqrt(3) * s;
    let g = '', n = 0;
    vals.forEach((row, r) => row.forEach((v, c) => {
      const on = v >= thr; if (on) n++;
      g += `<path d="${hexPath(ox + 12 + c * w + (r % 2 ? w / 2 : 0), 30 + r * 1.5 * s, s - 0.9)}" fill="${on ? 'var(--cbd)' : figRamp()[lqClass(v)]}"/>`;
    }));
    return `<text class="t-b" x="${ox + 58}" y="11" text-anchor="middle">${esc(title)}</text>${g}
      <text x="${ox + 58}" y="86" text-anchor="middle">${esc(t(capKey, { n }))}</text>`;
  };
  return figSvg(262, 92, panel(4, 1.5, t('help.thr.figA'), 'help.thr.capA') + figArrow(131, 42) + panel(142, 3.0, t('help.thr.figB'), 'help.thr.capB'));
}

/* 같은 건물 분포를 작은 칸 / 큰 칸으로 집계 */
const HELP_PTS = (() => {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pts = [];
  for (const [cx, cy, sd, k] of [[38, 44, 9, 26], [80, 56, 6, 14], [22, 66, 5, 8], [92, 30, 12, 6]]) {
    for (let i = 0; i < k; i++) {
      const r = Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * sd, th = 2 * Math.PI * rnd();
      pts.push([clamp(cx + r * Math.cos(th), 3, 113), clamp(cy + r * Math.sin(th), 19, 75)]);
    }
  }
  return pts;
})();
function figCell() {
  const panel = (ox, s, id, title, caption) => {
    const w = Math.sqrt(3) * s, cells = [];
    for (let r = 0, y = 17; y <= 80 + s; r++, y += 1.5 * s) {
      for (let x = (r % 2 ? w / 2 : 0); x <= 118 + w; x += w) cells.push({ x, y, n: 0 });
    }
    for (const [px, py] of HELP_PTS) {
      let best = null, bd = Infinity;
      for (const c of cells) { const d = (c.x - px) ** 2 + (c.y - py) ** 2; if (d < bd) { bd = d; best = c; } }
      best.n++;
    }
    const avg = HELP_PTS.length * (2.598 * s * s) / (116 * 58);
    const g = cells.map(c => `<path d="${hexPath(ox + c.x, c.y, s - 0.5)}" fill="${c.n ? figRamp()[lqClass(c.n / avg)] : 'none'}" stroke="var(--grid)" stroke-width="${c.n ? 0 : 0.6}"/>`).join('');
    const dots = HELP_PTS.map(([px, py]) => `<circle cx="${(ox + px).toFixed(1)}" cy="${py.toFixed(1)}" r="1.1" fill="var(--ink)" opacity=".55"/>`).join('');
    return `<text class="t-b" x="${ox + 58}" y="11" text-anchor="middle">${esc(title)}</text>
      <clipPath id="${id}"><rect x="${ox}" y="17" width="116" height="60" rx="4"/></clipPath>
      <g clip-path="url(#${id})">${g}${dots}</g>
      <text x="${ox + 58}" y="89" text-anchor="middle">${esc(caption)}</text>`;
  };
  return figSvg(262, 94, panel(4, 5, 'hpc1', t('help.cell.figA'), t('help.cell.capA')) + figArrow(131, 47) + panel(142, 13, 'hpc2', t('help.cell.figB'), t('help.cell.capB')));
}

/* 칸별 개수(막대) vs 커널로 부드럽게 만든 밀도(곡선) */
function figSmooth() {
  const counts = [0, 1, 0, 2, 6, 3, 1, 0, 0, 3, 5, 2, 0, 1, 0, 0];
  const W = 116, H = 56, top = 20, bw = W / counts.length, maxC = 6;
  const bars = (ox, fill) => counts.map((c, i) => c ? `<rect x="${(ox + i * bw + 0.6).toFixed(1)}" y="${top + H - c / maxC * H}" width="${(bw - 1.2).toFixed(1)}" height="${c / maxC * H}" rx="1.5" fill="${fill}"/>` : '').join('');
  const curve = (ox, sigma) => {
    const f = x => counts.reduce((s, c, j) => s + c * Math.exp(-((x - j - 0.5) ** 2) / (2 * sigma * sigma)), 0);
    const xs = Array.from({ length: 65 }, (_, k) => k / 64 * counts.length), ys = xs.map(f), m = Math.max(...ys);
    return xs.map((x, k) => `${k ? 'L' : 'M'}${(ox + x * bw).toFixed(1)},${(top + H - ys[k] / m * H * 0.92).toFixed(1)}`).join('');
  };
  const base = ox => `<line x1="${ox}" x2="${ox + W}" y1="${top + H}" y2="${top + H}" stroke="var(--axis)"/>`;
  const ox2 = 142;
  return figSvg(262, 98,
    `<text class="t-b" x="62" y="11" text-anchor="middle">${esc(t('help.smooth.figA'))}</text>${bars(4, 'var(--bar)')}${base(4)}
     <text x="62" y="92" text-anchor="middle">${esc(t('help.smooth.capA'))}</text>
     ${figArrow(131, 48)}
     <text class="t-b" x="${ox2 + 58}" y="11" text-anchor="middle">${esc(t('help.smooth.figB'))}</text>${bars(ox2, 'var(--grid)')}${base(ox2)}
     <path d="${curve(ox2, 1.3)}" fill="none" stroke="var(--bar)" stroke-width="2" stroke-linejoin="round"/>
     <path d="${curve(ox2, 3.2)}" fill="none" stroke="var(--cbd)" stroke-width="2" stroke-dasharray="4 3" stroke-linejoin="round"/>
     <line x1="${ox2 + 2}" x2="${ox2 + 14}" y1="89" y2="89" stroke="var(--bar)" stroke-width="2"/><text x="${ox2 + 17}" y="92">${esc(t('help.smooth.mid'))}</text>
     <line x1="${ox2 + 52}" x2="${ox2 + 64}" y1="89" y2="89" stroke="var(--cbd)" stroke-width="2" stroke-dasharray="4 3"/><text x="${ox2 + 67}" y="92">${esc(t('help.smooth.strong'))}</text>`);
}

/* 저층 3동 + 고층 1동을 동수 / 연면적으로 셀 때 */
function figMode() {
  const blds = [{ w: 18, f: 5 }, { w: 18, f: 5 }, { w: 18, f: 6 }, { w: 22, f: 25 }];
  const ground = 74, unit = 2.1, gap = 7;
  const panel = (ox, title, weight, caption) => {
    let x = ox + 8, g = '';
    const base = blds[0].w * blds[0].f;
    for (const b of blds) {
      const h = b.f * unit;
      g += `<rect x="${x}" y="${ground - h}" width="${b.w}" height="${h}" rx="1.5" fill="var(--bar-soft)"/>`;
      for (let fl = 1; fl < b.f; fl += 2) g += `<line x1="${x + 3}" x2="${x + b.w - 3}" y1="${ground - fl * unit}" y2="${ground - fl * unit}" stroke="var(--surface)" stroke-width=".8" opacity=".7"/>`;
      g += `<text class="t-b" x="${x + b.w / 2}" y="${ground - h - 3}" text-anchor="middle">${weight(b, base)}</text>`;
      x += b.w + gap;
    }
    return `<text class="t-b" x="${ox + 58}" y="11" text-anchor="middle">${esc(title)}</text>${g}
      <line x1="${ox + 2}" x2="${ox + 114}" y1="${ground}" y2="${ground}" stroke="var(--axis)"/>
      <text x="${ox + 58}" y="89" text-anchor="middle">${esc(caption)}</text>`;
  };
  return figSvg(262, 94,
    panel(4, t('help.mode.figA'), () => '1', t('help.mode.capA')) + figArrow(131, 50) +
    panel(142, t('help.mode.figB'), (b, base) => fmt(b.w * b.f / base, 1), t('help.mode.capB')));
}

const HELP = {
  thr: { fig: figThreshold, current: () => `×${(+$('#thr').value).toFixed(1)}` },
  cell: {
    fig: figCell,
    current: () => {
      const auto = +$('#cell').value === 0, side = state.result?.sideKm;
      return auto
        ? t('help.cell.auto') + (side ? ` · ${t('help.cell.side', { m: fmt(side * 1000, 0) })}` : '')
        : $('#cell').selectedOptions[0].text;
    },
  },
  smooth: { fig: figSmooth, current: () => $('#smooth').selectedOptions[0].text },
  mode: { fig: figMode, current: () => $('input[name="mode"]:checked').parentElement.textContent.trim() },
};

const helpPop = $('#helpPop');
let helpAnchor = null, helpTimer = null, helpHideTimer = null;

function positionHelp(anchor) {
  const a = anchor.getBoundingClientRect(), card = anchor.closest('.card').getBoundingClientRect();
  const pw = helpPop.offsetWidth, ph = helpPop.offsetHeight, m = 8;
  const midY = a.top + a.height / 2;
  let side, x, y;
  if (card.left - pw - 16 >= m) {                   // 넓은 화면: 패널 왼쪽(지도 위)에 띄운다
    side = 'left'; x = card.left - pw - 16;
  } else if (a.right + 14 + pw <= innerWidth - m) { // 중간 폭: 항목 이름 오른쪽 옆에 띄워 이름을 가리지 않는다
    side = 'right'; x = a.right + 14;
  }
  if (side) {
    y = clamp(midY - ph / 2, m, innerHeight - ph - m);
    helpPop.style.setProperty('--ay', `${clamp(midY - y, 14, ph - 14)}px`);
  } else {                                           // 휴대폰 폭: 아래·위 중 공간이 넓은 쪽
    const below = innerHeight - a.bottom, above = a.top;
    side = below >= ph + 20 || below >= above ? 'bottom' : 'top';
    y = side === 'bottom' ? Math.min(a.bottom + 12, innerHeight - ph - m) : Math.max(m, a.top - ph - 12);
    x = clamp(a.left - 8, m, innerWidth - pw - m);
    helpPop.style.setProperty('--ax', `${a.left + 30 - x}px`);
  }
  helpPop.dataset.side = side;
  helpPop.style.left = `${x}px`; helpPop.style.top = `${y}px`;
}
function openHelp(anchor) {
  const key = anchor.dataset.help, h = HELP[key]; if (!h) return;
  clearTimeout(helpHideTimer);
  $$('.help-t.open').forEach(el => el.classList.remove('open'));
  anchor.classList.add('open');
  helpAnchor = anchor;
  helpPop.innerHTML = `
    <div class="hp-head"><span class="hp-title">${esc(t(`help.${key}.title`))}</span><span class="hp-cur">${esc(t('help.current', { v: h.current() }))}</span></div>
    <div class="hp-fig">${h.fig()}</div>
    <p class="hp-what">${t(`help.${key}.what`)}</p>
    <div class="hp-rows">${t(`help.${key}.rows`).map(([tag, txt]) => `<div class="hp-row"><span class="hp-tag">${esc(tag)}</span><span>${esc(txt)}</span></div>`).join('')}</div>
    ${I18N[lang][`help.${key}.note`] ? `<div class="hp-note">${esc(t(`help.${key}.note`))}</div>` : ''}`;
  const wasShown = !helpPop.hidden && helpPop.classList.contains('show');
  helpPop.hidden = false;
  positionHelp(anchor);
  if (!wasShown) {
    helpPop.classList.remove('show');
    void helpPop.offsetWidth;                        // 시작 상태를 확정해야 전환 애니메이션이 재생된다
    helpPop.classList.add('show');
  }
}
function closeHelp() {
  if (!helpAnchor) return;
  helpAnchor.classList.remove('open');
  helpAnchor = null;
  helpPop.classList.remove('show');
  helpHideTimer = setTimeout(() => { if (!helpAnchor) helpPop.hidden = true; }, 220);
}
$$('.help-t').forEach(el => {
  el.addEventListener('mouseenter', () => { clearTimeout(helpTimer); helpTimer = setTimeout(() => openHelp(el), helpAnchor ? 0 : 120); });
  el.addEventListener('mouseleave', () => { clearTimeout(helpTimer); helpTimer = setTimeout(closeHelp, 90); });
  const qi = el.querySelector('.qi');
  // 라벨 안의 ? 를 눌러도 입력칸으로 포커스가 넘어가지 않게 하고, 터치 기기에서는 탭으로 열고 닫는다
  qi.addEventListener('click', e => { e.preventDefault(); helpAnchor === el ? closeHelp() : openHelp(el); });
  qi.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); helpAnchor === el ? closeHelp() : openHelp(el); } });
  qi.addEventListener('focus', () => { if (qi.matches(':focus-visible')) openHelp(el); });
  qi.addEventListener('blur', closeHelp);
});
addEventListener('keydown', e => { if (e.key === 'Escape') { closeHelp(); closeAbout(); } });
addEventListener('scroll', () => { if (helpAnchor) positionHelp(helpAnchor); }, true);
addEventListener('resize', () => { if (helpAnchor) positionHelp(helpAnchor); });

/* ============================================================
   About 팝오버 (마우스 옆에 뜨는 안내)
   ============================================================ */
const aboutPop = $('#aboutPop');
let aboutOpen = false;
function openAbout(x, y) {
  aboutPop.innerHTML = `
    <div class="ab-head">
      <h2 class="ab-title">${esc(t('about.title'))}</h2>
      <button type="button" class="x" data-close aria-label="${esc(t('about.close'))}">×</button>
    </div>
    <p class="ab-lead">${t('about.lead')}</p>
    <ul class="ab-list">${t('about.items').map(([ic, ti, de]) =>
      `<li><span class="ab-ic" aria-hidden="true">${ic}</span><span><b>${esc(ti)}</b><span>${esc(de)}</span></span></li>`).join('')}</ul>
    <div class="ab-foot">${esc(t('about.foot'))}</div>`;
  aboutPop.hidden = false;
  const pw = aboutPop.offsetWidth, ph = aboutPop.offsetHeight, m = 10;
  const left = x + 16 + pw <= innerWidth - m, top = y + 16 + ph <= innerHeight - m;
  const px = clamp(left ? x + 16 : x - 16 - pw, m, innerWidth - pw - m);
  const py = clamp(top ? y + 16 : y - 16 - ph, m, innerHeight - ph - m);
  aboutPop.style.left = `${px}px`; aboutPop.style.top = `${py}px`;
  aboutPop.style.transformOrigin = `${left ? 'left' : 'right'} ${top ? 'top' : 'bottom'}`;
  void aboutPop.offsetWidth;
  aboutPop.classList.add('show');
  aboutOpen = true;
  $$('[data-about]').forEach(b => b.setAttribute('aria-expanded', 'true'));
}
function closeAbout() {
  if (!aboutOpen) return;
  aboutOpen = false;
  aboutPop.classList.remove('show');
  $$('[data-about]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  setTimeout(() => { if (!aboutOpen) aboutPop.hidden = true; }, 220);
}
$$('[data-about]').forEach(btn => btn.addEventListener('click', e => {
  if (aboutOpen) { closeAbout(); return; }
  const r = btn.getBoundingClientRect();
  const x = e.clientX || r.left + r.width / 2, y = e.clientY || r.bottom;
  openAbout(x, y);
}));
aboutPop.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeAbout(); });
document.addEventListener('mousedown', e => {
  if (!aboutOpen) return;
  if (e.target.closest('#aboutPop') || e.target.closest('[data-about]')) return;
  closeAbout();
});

/* ============================================================
   표지: 큰 글자 · 입체 그래픽 · 화면 전환
   ============================================================ */
function heroArtSvg() {
  const s = 44, W = Math.sqrt(3) * s, sq = 0.58;
  const ring = [210, 270, 330, 30, 90, 150].map((deg, i) => {
    const a = deg * Math.PI / 180;
    return { px: W * Math.cos(a), py: W * Math.sin(a), h: [128, 92, 158, 74, 120, 58][i], tone: i % 2 ? 'b' : 'w' };
  });
  const prisms = [...ring, { px: 0, py: 0, h: 205, tone: 'b' }].sort((a, b) => (a.py - b.py) || (a.px - b.px));

  const pts = [];
  const body = prisms.map((p, idx) => {
    const v = [];
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      v.push([p.px + s * Math.cos(a), (p.py + s * Math.sin(a)) * sq]);
    }
    v.forEach(([x, y]) => { pts.push([x, y], [x, y - p.h]); });
    const top = v.map(([x, y]) => `${x.toFixed(1)},${(y - p.h).toFixed(1)}`).join(' ');
    const face = (i, j) => `${v[i][0].toFixed(1)},${(v[i][1] - p.h).toFixed(1)} ${v[j][0].toFixed(1)},${(v[j][1] - p.h).toFixed(1)} ${v[j][0].toFixed(1)},${v[j][1].toFixed(1)} ${v[i][0].toFixed(1)},${v[i][1].toFixed(1)}`;
    const g = p.tone === 'b' ? 'b' : 'w';
    const rim = p.tone === 'b' ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.10)';
    const glass = p.tone === 'w'
      ? `<line x1="${v[3][0].toFixed(1)}" y1="${(v[3][1] - p.h).toFixed(1)}" x2="${v[3][0].toFixed(1)}" y2="${v[3][1].toFixed(1)}" stroke="#4fc3ff" stroke-width="1.6" opacity=".75"/>
         <line x1="${v[0][0].toFixed(1)}" y1="${(v[0][1] - p.h).toFixed(1)}" x2="${v[0][0].toFixed(1)}" y2="${v[0][1].toFixed(1)}" stroke="#ff7a3d" stroke-width="1.6" opacity=".75"/>` : '';
    return `<g class="pr" style="animation-delay:${(idx * 0.42).toFixed(2)}s">
      <polygon points="${face(0, 1)}" fill="url(#${g}R)" stroke="${rim}"/>
      <polygon points="${face(1, 2)}" fill="url(#${g}F)" stroke="${rim}"/>
      <polygon points="${face(2, 3)}" fill="url(#${g}L)" stroke="${rim}"/>
      ${glass}
      <polygon points="${top}" fill="url(#${g}T)" stroke="${rim}"/>
      ${p.tone === 'b' ? `<ellipse cx="${(p.px - s * 0.22).toFixed(1)}" cy="${((p.py) * sq - p.h - s * 0.12).toFixed(1)}" rx="${(s * 0.42).toFixed(1)}" ry="${(s * 0.2).toFixed(1)}" fill="#ffffff" opacity=".22"/>` : ''}
    </g>`;
  }).join('');

  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const pad = 16;
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  const w = Math.max(...xs) - Math.min(...xs) + pad * 2, h = Math.max(...ys) - Math.min(...ys) + pad * 2;
  const grad = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  return `<svg viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      ${grad('bT', '#59595b', '#101012')}${grad('bR', '#2b2b2e', '#0a0a0c')}${grad('bF', '#1b1b1e', '#050506')}${grad('bL', '#3c3c40', '#141416')}
      ${grad('wT', '#ffffff', '#e4e4e6')}${grad('wR', '#f7f7f8', '#cfcfd3')}${grad('wF', '#e9e9ec', '#b9b9bf')}${grad('wL', '#ffffff', '#dcdce0')}
    </defs>
    <ellipse cx="0" cy="${(s * sq * 1.1).toFixed(1)}" rx="${(W + s).toFixed(1)}" ry="${(s * 0.55).toFixed(1)}" fill="#000" opacity=".10"/>
    ${body}
  </svg>`;
}

function renderHeadline() {
  const box = $('#hlBox'), lines = $$('.hl-line', box);
  t('land.lines').forEach((txtLine, i) => { if (lines[i]) lines[i].textContent = txtLine; });
  box.setAttribute('aria-label', t('land.aria'));
  fitHeadline();
}
function fitHeadline() {
  if (document.body.dataset.view !== 'landing') return;
  const box = $('#hlBox'), lines = $$('.hl-line', box);
  const boxW = box.clientWidth;
  if (!boxW) return;
  const sizes = lines.map(l => {
    l.style.fontSize = '100px';
    const w = l.getBoundingClientRect().width;
    return w ? 100 * boxW / w : 100;
  });
  const lh = 0.9;   // 표지 제목은 항상 영문 대문자
  // 가운데 영역 높이에 맞춰 키운다 (창이 낮아도 위아래 문구를 밀어내지 않게)
  const mainH = $('.land-main')?.clientHeight || innerHeight;
  const below = $('.land-below')?.offsetHeight ?? 150;
  const maxH = Math.min(innerHeight * 0.46, mainH - below * 2 - 60);
  const total = sizes.reduce((s, v) => s + v * lh, 0);
  const k = Math.min(1, maxH / total);
  lines.forEach((l, i) => { l.style.fontSize = `${(sizes[i] * k).toFixed(1)}px`; });
}
$('#heroArt').querySelector('.art-in').innerHTML = heroArtSvg();

/* ----- 화면 전환 (표지 ↔ 분석) ----- */
let mapReady = false;
function showView(v) {
  if (document.body.dataset.view === v) return;
  const swap = () => {
    document.body.dataset.view = v;
    closeAbout(); closeHelp();
    if (v === 'app') {
      map.invalidateSize();
      if (!state.region && !mapReady) { map.setView([36.35, 127.8], 7); mapReady = true; }
    } else fitHeadline();
  };
  if (document.startViewTransition && document.visibilityState === 'visible' && !reducedMotion()) document.startViewTransition(swap);
  else swap();
}
function route() {
  const h = location.hash.slice(1);
  const q = new URLSearchParams(h).get('q');
  showView(q || h === 'app' ? 'app' : 'landing');
  return q;
}
addEventListener('hashchange', () => {
  const q = route();
  if (q && q !== lastStart.q) { $('#q').value = q; startSearch(q); }
});
$('#startBtn').addEventListener('click', () => { location.hash = 'app'; });
$$('[data-home]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); location.hash = ''; }));
addEventListener('resize', fitHeadline);
document.fonts?.ready.then(fitHeadline);

/* ============================================================
   언어 전환
   ============================================================ */
function applyLang() {
  applyStaticI18n();
  applyTheme(theme);
  updateBadge();
  renderExamples();
  renderRadiusOptions();
  renderBldRules();
  renderSteps();
  renderHeadline();
  renderLegend();
  buildLayerControl();
  renderHint();
  renderResults();
  renderYearOptions();
  $('#busyTxt').textContent = tx(busyMsg);
  $$('[data-help-aria]').forEach(el => el.setAttribute('aria-label', t('ctl.helpAria', { name: t(`ctl.${el.dataset.helpAria}`) })));
  if (state.result) renderAll(); else heroMessage(state.heroMsg);
  renderEmptyPanels();
  renderBuildingMix();
  if (aboutOpen) { const r = aboutPop.getBoundingClientRect(); closeAbout(); openAbout(r.left, r.top); }
  if (helpAnchor) openHelp(helpAnchor);
}
function setLang(next) {
  if (next === lang) return;
  const swap = () => {
    lang = next;
    writeJSON(LANG_KEY, lang);
    $$('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    applyLang();
    if (lang === 'en') ensureEnglishNames([state.region, ...state.candidates]);
    if (state.result && !state.result.dong) resolveClusterNames();
  };
  if (document.startViewTransition && document.visibilityState === 'visible' && !reducedMotion()) document.startViewTransition(swap);
  else swap();
}
$$('.lang button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));

/* ============================================================
   controls & settings
   ============================================================ */
$('#thr').addEventListener('input', e => { $('#thrOut').textContent = '×' + (+e.target.value).toFixed(1); scheduleRecompute(); });
['#cell', '#smooth'].forEach(s => $(s).addEventListener('change', scheduleRecompute));
$$('input[name="mode"]').forEach(i => i.addEventListener('change', scheduleRecompute));

const dlg = $('#settingsDlg'), form = $('#settingsForm');
function renderYearOptions() {
  const cur = form.elements.year.value || settings.year;
  form.elements.year.innerHTML = Array.from({ length: 10 }, (_, i) => 2024 - i)
    .map(y => `<option value="${y}"${String(y) === String(cur) ? ' selected' : ''}>${esc(t('dlg.yearOpt', { y }))}</option>`).join('');
}
$('#settingsBtn').addEventListener('click', () => {
  renderYearOptions();
  for (const k of Object.keys(DEFAULTS)) if (form.elements[k]) form.elements[k].value = settings[k];
  $('#sgisTestMsg').textContent = '';
  dlg.showModal();
});
$('#clearKeys').addEventListener('click', () => { form.elements.sgisKey.value = ''; form.elements.sgisSecret.value = ''; });
$('#testSgis').addEventListener('click', async () => {
  const msg = $('#sgisTestMsg');
  const key = form.elements.sgisKey.value.trim(), secret = form.elements.sgisSecret.value.trim();
  if (!key || !secret) { msg.style.color = 'var(--crit)'; msg.textContent = t('dlg.needBoth'); return; }
  msg.style.color = 'var(--ink2)'; msg.textContent = t('dlg.testing');
  try {
    sgisToken = null;
    await sgisAuth(undefined, key, secret);
    msg.style.color = 'var(--good)'; msg.textContent = t('dlg.ok');
  } catch (e) {
    sgisToken = null;
    msg.style.color = 'var(--crit)'; msg.textContent = t('dlg.fail', { msg: errText(e) });
  }
});
dlg.addEventListener('close', () => {
  if (dlg.returnValue !== 'save') return;
  const prev = JSON.stringify(settings);
  settings = {
    sgisKey: form.elements.sgisKey.value.trim(), sgisSecret: form.elements.sgisSecret.value.trim(),
    year: form.elements.year.value, aptType: form.elements.aptType.value.trim() || '02',
    floors: clamp(+form.elements.floors.value || 15, 1, 80), overpass: form.elements.overpass.value, overpassV2: true,
  };
  if (JSON.stringify(settings) === prev) return;
  sgisToken = null;
  writeJSON(SETTINGS_KEY, settings);
  updateBadge();
  if (state.lastRegion) runRegion(state.lastRegion, { keepCandidates: true });
});

new ResizeObserver(() => map.invalidateSize()).observe($('.map-wrap'));

/* ============================================================
   boot
   ============================================================ */
$$('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
applyLang();
(() => {
  const q = route();
  if (q) { $('#q').value = q; startSearch(q); }
})();

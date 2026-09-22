'use strict';
/* ============================================================
   VOYAGE — 스크롤에 따라 이어지는 항해 장면 (canvas 2D)

   0.00 ~ 0.12  먼 바다   잔잔한 수면 위에 배가 멀리 떠 있다
   0.12 ~ 0.32  접근     카메라가 배 쪽으로 다가간다
   0.32 ~ 0.46  승선     갑판이 아래에서 올라오며 시점이 배 위로 옮겨간다
   0.46 ~ 0.64  항해     갑판에서 앞을 보며 전진, 물살과 해안선이 지나간다
   0.64 ~ 0.88  이륙     드론이 뜨듯 갑판이 멀어지고 배 전체가 보이기 시작한다
   0.88 ~ 1.00  상공     고도를 더 올려 항적만 남은 바다를 내려다본다

   모든 카메라 값은 track()으로 이어 붙여 구간 경계에서 튀지 않는다.
   진행도는 스크롤 값을 그대로 쓰지 않고 프레임마다 감쇠 보간한다.
   ============================================================ */
(function () {
  const cvs = document.getElementById('sea');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  addEventListener('resize', resize, { passive: true });

  /* ---------- 유틸 ---------- */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  /* smootherstep — 양 끝의 기울기가 0이라 구간이 이어져도 꺾임이 보이지 않는다 */
  const sss = t => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
  const ss = (e0, e1, x) => sss((x - e0) / (e1 - e0));

  /* 키프레임 사이를 smootherstep으로 잇는다: track(p, [[위치, 값], ...]) */
  function track(p, stops) {
    if (p <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (p <= stops[i][0]) {
        const a = stops[i - 1], b = stops[i];
        return lerp(a[1], b[1], sss((p - a[0]) / (b[0] - a[0])));
      }
    }
    return stops[stops.length - 1][1];
  }

  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(c1, c2, t) {
    const a = hex(c1), b = hex(c2);
    return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) + ',' + Math.round(lerp(a[2], b[2], t)) + ')';
  }
  /* 임의 개수의 색 키프레임 보간 */
  function pal(keys, t) {
    const n = keys.length - 1, x = clamp(t, 0, 1) * n;
    const i = Math.min(Math.floor(x), n - 1);
    return mix(keys[i], keys[i + 1], x - i);
  }

  /* ---------- 팔레트 (새벽 → 아침 → 한낮 → 상공) ---------- */
  const SKY_TOP = ['#6d84a0', '#7e9cc0', '#79a8d2', '#a8c6dd'];
  const SKY_MID = ['#b0aeb8', '#a9bfd6', '#bcd3e4', '#d2e1ec'];
  const SKY_HZN = ['#e6d4c7', '#ead0be', '#e6ddd8', '#eff4f7'];
  const SEA_NEAR = ['#8b8d96', '#7d93a7', '#5f7f99', '#2b4d68'];
  const SEA_DEEP = ['#2a2f37', '#20303f', '#12283a', '#03070c'];

  /* ---------- 카메라 (모두 p의 연속 함수) ---------- */
  const cam = {
    /* 수평선 높이 — 고도가 올라갈수록 화면 위로 */
    hzn: p => H * track(p, [[0, .445], [.32, .425], [.46, .405], [.64, .385], [.88, .245], [1, .205]]),
    /* 색 진행 */
    tone: p => track(p, [[0, 0], [.32, .30], [.58, .58], [.82, .82], [1, 1]]),
    /* 고도 0 → 1 — 초반에 빠르게 떠올라야 갑판이 멀어지는 게 눈에 보인다 */
    lift: p => track(p, [[.64, 0], [.76, .45], [.88, .85], [1, 1]]),
    /* 물살 속도 — 항해 구간에서 빨라진다 */
    speed: p => track(p, [[0, .30], [.30, .45], [.50, 1], [.66, 1], [.90, .5], [1, .42]]),
  };

  /* ---------- 하늘 ---------- */
  function sky(p, hzn, tone) {
    const g = ctx.createLinearGradient(0, 0, 0, hzn);
    g.addColorStop(0, pal(SKY_TOP, tone));
    g.addColorStop(.62, pal(SKY_MID, tone));
    g.addColorStop(1, pal(SKY_HZN, tone));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, hzn + 1);
  }

  /* 구름 — 고도가 올라가면 아래로 흐르며 커진다(지나쳐 올라가는 느낌) */
  const CLOUDS = [
    [.10, .17, .26, .030, .34], [.42, .11, .34, .026, .26],
    [.74, .20, .30, .034, .30], [.28, .27, .22, .022, .22],
    [.90, .30, .26, .028, .20], [.58, .33, .30, .020, .16],
  ];
  function clouds(p, hzn, drift, lift) {
    const a = track(p, [[0, .55], [.5, .8], [.86, .8], [1, 0]]);
    if (a <= .01) return;
    ctx.save();
    for (let i = 0; i < CLOUDS.length; i++) {
      const c = CLOUDS[i];
      const par = 0.45 + i * 0.12;                         // 시차
      const sc = 1 + lift * 1.5 * par;
      const y = hzn * c[1] * 2.1 + lift * H * 0.62 * par;
      if (y > hzn + H * 0.1) continue;
      let x = (c[0] + drift * 0.012 * par) % 1.25 - 0.12;
      x *= W;
      const rw = c[2] * W * 0.62 * sc, rh = c[3] * H * 1.5 * sc;
      ctx.globalAlpha = a * c[4] * (1 - clamp((y - hzn * .5) / (hzn * .9), 0, 1) * .7);
      /* 가장자리가 흐려지는 방사 그라데이션 — 단색 타원은 접시처럼 보인다 */
      const g = ctx.createRadialGradient(x, y, 0, x, y, rw);
      g.addColorStop(0, 'rgba(255,255,255,.85)');
      g.addColorStop(.45, 'rgba(255,255,255,.34)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, rh / rw);            // 납작하게
      ctx.translate(-x, -y);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rw, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function sun(p, hzn, tone) {
    const a = track(p, [[0, 1], [.55, .85], [.9, .25], [1, .12]]);
    const x = W * track(p, [[0, .74], [.5, .66], [1, .58]]);
    const y = hzn - H * (0.06 + cam.lift(p) * 0.06);
    const g = ctx.createRadialGradient(x, y, 0, x, y, H * 0.58);
    g.addColorStop(0, 'rgba(255,238,214,' + (0.40 * a) + ')');
    g.addColorStop(.42, 'rgba(255,226,202,' + (0.12 * a) + ')');
    g.addColorStop(1, 'rgba(255,226,202,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, hzn + H * 0.3);
  }

  /* 해안선 — 항해 구간에만 수평선 위로 스쳐 지나간다 */
  function coast(p, hzn, drift, tone) {
    const a = track(p, [[.30, 0], [.44, .55], [.68, .5], [.82, 0]]);
    if (a <= .01) return;
    const base = hzn + 1, hMax = H * 0.040;
    const off = (drift * 0.05) % 6.283;
    ctx.save();
    ctx.globalAlpha = a * 0.55;
    ctx.fillStyle = mix(pal(SKY_HZN, tone), '#48596b', .5);
    ctx.beginPath();
    ctx.moveTo(-1, base);
    for (let x = 0; x <= W; x += 10) {
      const u = x / W * 3.4 + off;
      /* 봉우리 사이가 수평선까지 내려앉아 섬처럼 끊겨 보이게 한다 */
      let h = Math.sin(u) * .62 + Math.sin(u * 2.3 + 1.1) * .26 + Math.sin(u * 5.7) * .12;
      h = Math.max(0, h - 0.30) / 0.70;
      ctx.lineTo(x, base - h * hMax);
    }
    ctx.lineTo(W + 1, base);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* ---------- 바다 ---------- */
  function sea(p, hzn, tone, phase) {
    const g = ctx.createLinearGradient(0, hzn, 0, H);
    g.addColorStop(0, pal(SKY_HZN, tone));
    g.addColorStop(.08, pal(SEA_NEAR, tone));
    g.addColorStop(1, pal(SEA_DEEP, tone));
    ctx.fillStyle = g;
    ctx.fillRect(0, hzn, W, H - hzn);

    const rows = W < 760 ? 28 : 46, span = H - hzn;
    ctx.lineWidth = 1;
    for (let i = 1; i < rows; i++) {
      const u = i / rows;
      const y = hzn + span * Math.pow(u, 2.15);
      const amp = 0.4 + u * u * 9;
      const alpha = (0.035 + u * 0.10) * (1 - cam.lift(p) * 0.45);
      ctx.strokeStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      for (let x = 0; x <= W; x += 26) {
        const yy = y
          + Math.sin((x * 0.006) + phase * (0.5 + u) + i * 2.9) * amp
          + Math.sin((x * 0.017) - phase * 0.8 + i * 1.3) * amp * 0.45
          + Math.sin((x * 0.031) + phase * 0.4 + i * 0.7) * amp * 0.22;
        x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    const gl = ctx.createLinearGradient(0, hzn, 0, hzn + span * 0.16);
    gl.addColorStop(0, 'rgba(255,255,255,.30)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, hzn, W, span * 0.16);
  }

  /* ---------- 선박 (측면) ---------- */
  function hullPath(g, L) {
    const h = L * 0.115;
    g.beginPath();
    g.moveTo(-L * 0.50, -h * 0.30);
    g.lineTo(-L * 0.44, -h * 0.74);
    g.lineTo(L * 0.16, -h * 0.88);
    g.lineTo(L * 0.44, -h * 1.10);
    g.lineTo(L * 0.52, -h * 0.55);
    g.lineTo(L * 0.44, h * 0.30);
    g.lineTo(-L * 0.42, h * 0.34);
    g.closePath();
  }

  function vesselSide(x, y, L, a, tone) {
    if (a <= 0.01) return;
    const h = L * 0.115;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);

    ctx.save();
    ctx.scale(1, -0.86);
    ctx.globalAlpha = a * 0.34;
    hullPath(ctx, L);
    ctx.fillStyle = tone;
    ctx.fill();
    ctx.fillRect(-L * 0.02, 0, L * 0.035, -L * 0.34);
    ctx.restore();
    for (let i = 0; i < 16; i++) {
      ctx.globalAlpha = a * (0.10 + i * 0.045);
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      ctx.fillRect(-L * 0.6, i * (L * 0.028), L * 1.2, L * 0.012);
    }
    ctx.globalAlpha = a;

    hullPath(ctx, L);
    ctx.fillStyle = tone;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-L * 0.40, -h * 0.76);
    ctx.lineTo(L * 0.14, -h * 0.88);
    ctx.lineTo(L * 0.16, -h * 0.72);
    ctx.lineTo(-L * 0.39, -h * 0.60);
    ctx.closePath();
    ctx.fillStyle = 'rgba(150,170,190,.30)';
    ctx.fill();

    ctx.fillStyle = tone;
    ctx.fillRect(L * 0.02, -L * 0.30, L * 0.022, L * 0.22);
    ctx.beginPath();
    ctx.ellipse(L * 0.031, -L * 0.315, L * 0.045, L * 0.030, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = tone; ctx.lineWidth = Math.max(1, L * 0.006);
    ctx.beginPath(); ctx.moveTo(-L * 0.20, -h * 0.80); ctx.lineTo(-L * 0.22, -L * 0.24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-L * 0.12, -h * 0.82); ctx.lineTo(-L * 0.10, -L * 0.20); ctx.stroke();
    ctx.restore();
  }

  /* ---------- 갑판 시점 ---------- */
  function deckView(hzn, phase, a, offsetY, scale, roll) {
    if (a <= 0.01) return;
    const vy = hzn + H * 0.045;
    ctx.save();
    ctx.globalAlpha = a;
    /* 소실점을 기준으로 밀고 줄인다 — 승선할 땐 아래에서 올라오고, 이륙할 땐 멀어진다 */
    ctx.translate(W / 2, vy);
    ctx.rotate(roll);
    ctx.scale(scale, scale);
    ctx.translate(-W / 2, -vy + offsetY);

    const halfB = W * 0.23, halfT = W * 0.019;
    const g = ctx.createLinearGradient(0, vy, 0, H);
    g.addColorStop(0, 'rgba(24,32,42,.86)');
    g.addColorStop(.45, '#16202b');
    g.addColorStop(1, '#0a1119');

    /* 뱃머리 물살 */
    const bw = ctx.createLinearGradient(0, vy, 0, vy + (H - vy) * 0.5);
    bw.addColorStop(0, 'rgba(255,255,255,0)');
    bw.addColorStop(1, 'rgba(255,255,255,.16)');
    ctx.beginPath();
    ctx.moveTo(W / 2 - halfT * 2.4, vy);
    ctx.lineTo(W / 2 + halfT * 2.4, vy);
    ctx.lineTo(W / 2 + halfB * 1.7, H);
    ctx.lineTo(W / 2 - halfB * 1.7, H);
    ctx.closePath();
    ctx.fillStyle = bw; ctx.fill();

    ctx.beginPath();
    ctx.moveTo(W / 2 - halfT, vy);
    ctx.lineTo(W / 2 + halfT, vy);
    ctx.lineTo(W / 2 + halfB, H);
    ctx.lineTo(W / 2 - halfB, H);
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1;
    for (const k of [-0.55, -0.2, 0.2, 0.55]) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + halfT * k, vy);
      ctx.lineTo(W / 2 + halfB * k, H);
      ctx.stroke();
    }
    /* 갑판 이음매가 흘러가며 전진감을 준다 */
    for (let i = 0; i < 9; i++) {
      const u = ((i + (phase * 0.06) % 1) / 9);
      const uu = Math.pow(u, 2.1), y = vy + (H - vy) * uu;
      const hw = lerp(halfT, halfB, uu);
      ctx.globalAlpha = a * (0.04 + uu * 0.13);
      ctx.beginPath(); ctx.moveTo(W / 2 - hw, y); ctx.lineTo(W / 2 + hw, y); ctx.stroke();
    }
    ctx.globalAlpha = a;

    const mx = W / 2, my = vy + (H - vy) * 0.30, mh = H * 0.30;
    ctx.fillStyle = '#0d141c';
    ctx.fillRect(mx - W * 0.0042, my - mh, W * 0.0084, mh);
    ctx.beginPath();
    ctx.ellipse(mx, my - mh - H * 0.026, W * 0.021, H * 0.031, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0d141c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(mx - W * 0.02, my - mh * 0.55); ctx.lineTo(mx - W * 0.03, my - mh * 1.05); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx + W * 0.02, my - mh * 0.5); ctx.lineTo(mx + W * 0.028, my - mh * 0.95); ctx.stroke();
    ctx.restore();
  }

  /* ---------- 위에서 본 선박 ---------- */
  function vesselTop(x, y, L, ang, a) {
    if (a <= 0.01) return;
    const w = L * 0.2;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.rotate(ang);

    const wk = ctx.createLinearGradient(0, 0, 0, L * 3.4);
    wk.addColorStop(0, 'rgba(255,255,255,.16)');
    wk.addColorStop(.35, 'rgba(255,255,255,.07)');
    wk.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, L * 0.5);
    ctx.lineTo(w * 0.45, L * 0.5);
    ctx.lineTo(w * 1.5, L * 3.4);
    ctx.lineTo(-w * 1.5, L * 3.4);
    ctx.closePath();
    ctx.fillStyle = wk; ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -L * 0.62);
    ctx.quadraticCurveTo(w * 0.95, -L * 0.2, w * 0.85, L * 0.44);
    ctx.lineTo(-w * 0.85, L * 0.44);
    ctx.quadraticCurveTo(-w * 0.95, -L * 0.2, 0, -L * 0.62);
    ctx.closePath();
    ctx.fillStyle = '#0d141c'; ctx.fill();
    ctx.fillStyle = 'rgba(150,172,196,.15)';
    ctx.fillRect(-w * 0.48, -L * 0.24, w * 0.96, L * 0.52);
    /* 갑판 위 마스트 그림자 — 고도가 낮을 때만 보인다 */
    if (L > W * 0.12) {
      ctx.fillStyle = '#080d13';
      ctx.beginPath();
      ctx.ellipse(0, -L * 0.04, w * 0.14, L * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- 프레임 ---------- */
  let target = 0, current = 0;       // 스크롤 목표값 / 실제로 그리는 값
  let phase = 0, drift = 0;
  let onscreen = true;
  let last = performance.now();
  const listeners = [];

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;

    /* 스테이지를 지나 본문을 읽는 동안에는 그릴 필요가 없다 */
    if (!onscreen && Math.abs(target - current) < 0.001) {
      requestAnimationFrame(frame);
      return;
    }

    /* 진행도 감쇠 보간 — 휠 한 칸의 계단을 미끄러지듯 따라간다.
       거리가 멀면(Skip intro, 앵커 이동) 더 빨리 붙어 늘어지지 않게 한다. */
    const d = target - current;
    if (reduce) {
      current = target;
    } else if (Math.abs(d) < 0.0002) {
      current = target;
    } else {
      const k = Math.abs(d) > 0.3 ? 14 : 6.5;
      current += d * (1 - Math.exp(-dt * k));
    }
    const p = current;

    if (!reduce) {
      phase += dt * cam.speed(p) * 1.9;
      drift += dt;
    }

    const hzn = cam.hzn(p);
    const tone = cam.tone(p);
    const lift = cam.lift(p);

    ctx.clearRect(0, 0, W, H);
    sky(p, hzn, tone);
    clouds(p, hzn, drift, lift);
    sun(p, hzn, tone);
    coast(p, hzn, drift, tone);
    sea(p, hzn, tone, phase);

    const bob = reduce ? 0 : Math.sin(phase * 0.5) * H * 0.004;
    const roll = reduce ? 0 : Math.sin(phase * 0.33) * 0.006;

    /* --- 외부 시점: 배로 다가가다 시점이 배 아래로 내려간다 ---
       크게 키워서 겹쳐 지우면 유령처럼 보인다. 대신 화면 밖으로 내려보내고
       그 자리에서 갑판이 올라오게 해 카메라가 배에 올라탄 것처럼 잇는다. */
    const aOut = 1 - ss(.28, .40, p);
    if (aOut > 0.01) {
      const approach = track(p, [[0, 0], [.10, .05], [.28, .55], [.42, 1]]);
      const L = W * lerp(0.26, 0.56, approach);
      const wy = hzn + (H - hzn) * lerp(0.42, 1.28, approach) + bob;
      const side = lerp(0.10, 0.55, approach);     // 동행 선박은 바깥으로 밀려난다
      const sideL = W * lerp(.6, 1.1, approach);
      vesselSide(-W * side, hzn + (H - hzn) * lerp(.44, 1.0, approach) + bob * .6, sideL, aOut * 0.9, '#1a222c');
      vesselSide(W * (1 + side), hzn + (H - hzn) * lerp(.40, .94, approach) + bob * .8, sideL, aOut * 0.9, '#1a222c');
      vesselSide(W * 0.5, wy, L, aOut, '#141b23');
    }

    /* --- 갑판: 승선하며 아래에서 올라오고, 이륙하며 멀어진다 --- */
    const aDeck = ss(.30, .44, p) * (1 - ss(.64, .76, p));
    if (aDeck > 0.01) {
      const board = ss(.30, .44, p);
      /* 이륙하면 갑판이 아래로 떨어지며 작아진다 */
      const offsetY = lerp(H * 0.62, 0, board) + lift * H * 0.9;
      const scale = lerp(1.22, 1, board) * (1 - lift * 0.8);
      deckView(hzn, phase, aDeck, offsetY, scale, roll);
    }

    /* --- 상공: 갑판이 충분히 멀어진 뒤에 배 전체가 드러난다 --- */
    const aTop = ss(.73, .85, p);
    if (aTop > 0.01) {
      const L = W * lerp(0.30, 0.052, sss((lift - .1) / .9));
      const cy = hzn + (H - hzn) * lerp(0.72, 0.40, lift) + bob;
      vesselTop(W * 0.5, cy, L, 0, aTop);
      const wing = ss(.80, 1, p);
      if (wing > 0.01) {
        vesselTop(W * 0.21, cy + (H - hzn) * 0.20, L * 0.82, 0.20, aTop * wing * 0.8);
        vesselTop(W * 0.80, cy + (H - hzn) * 0.16, L * 0.82, -0.18, aTop * wing * 0.8);
      }
    }

    for (let i = 0; i < listeners.length; i++) listeners[i](p);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* set(v)        스크롤이 목표값을 밀어 넣는다
     set(v, true)  보간 없이 즉시 맞춘다 — 스크롤된 위치로 새로고침했을 때 0부터 흘러오면 안 된다
     get()         지금 그려지고 있는 값
     onFrame(fn)   보간된 값을 매 프레임 받아 간다 */
  window.VOYAGE = {
    set: (v, snap) => { target = clamp(v, 0, 1); if (snap) current = target; },
    get: () => current,
    onFrame: fn => { listeners.push(fn); },
    visible: v => { onscreen = !!v; },
  };
})();

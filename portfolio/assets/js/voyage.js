'use strict';
/* ============================================================
   VOYAGE — 스크롤에 따라 움직이는 바다 장면 (canvas 2D)
   0.00 ~ 0.30  외부 시점: 잔잔한 바다 위의 배 (양옆 동행 선박)
   0.30 ~ 0.62  갑판 시점: 배를 타고 앞을 바라보며 전진
   0.62 ~ 1.00  상공 시점: 카메라가 떠올라 항공뷰로 전환
   영상 파일 없이 전부 캔버스로 그린다.
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
  function ss(edge0, edge1, x) {           // smoothstep
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(c1, c2, t) {
    const a = hex(c1), b = hex(c2);
    return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) + ',' + Math.round(lerp(a[2], b[2], t)) + ')';
  }
  /* 3개 키프레임 사이를 잇는 색 보간 */
  function pal(keys, p) {
    if (p <= 0.5) return mix(keys[0], keys[1], p / 0.5);
    return mix(keys[1], keys[2], (p - 0.5) / 0.5);
  }

  /* ---------- 팔레트 (참고 이미지의 새벽 → 낮 → 상공) ---------- */
  const SKY_TOP = ['#7e93ab', '#6f9ec9', '#a4c3da'];
  const SKY_MID = ['#b3b2bb', '#a9c2d8', '#cfe0ea'];
  const SKY_HZN = ['#e4d2c6', '#e8cfc0', '#eef3f6'];
  const SEA_NEAR = ['#8e9099', '#7e94a8', '#2c4e69'];
  const SEA_DEEP = ['#2b3038', '#1b2a3a', '#03070c'];

  /* ---------- 장면 요소 ---------- */
  function sky(p) {
    const hzn = H * lerp(lerp(0.44, 0.40, ss(0, .5, p)), 0.23, ss(.55, 1, p));
    const g = ctx.createLinearGradient(0, 0, 0, hzn);
    g.addColorStop(0, pal(SKY_TOP, p));
    g.addColorStop(.62, pal(SKY_MID, p));
    g.addColorStop(1, pal(SKY_HZN, p));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, hzn + 1);
    return hzn;
  }

  function sun(p, hzn) {
    const a = 1 - ss(.55, .92, p);
    if (a <= 0.01) return;
    const x = W * 0.74, y = hzn - H * 0.06;
    const g = ctx.createRadialGradient(x, y, 0, x, y, H * 0.55);
    g.addColorStop(0, 'rgba(255,238,214,' + (0.42 * a) + ')');
    g.addColorStop(.45, 'rgba(255,225,200,' + (0.12 * a) + ')');
    g.addColorStop(1, 'rgba(255,225,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, hzn + H * 0.3);
  }

  function sea(p, hzn, t) {
    const g = ctx.createLinearGradient(0, hzn, 0, H);
    g.addColorStop(0, pal(SKY_HZN, p));
    g.addColorStop(.08, pal(SEA_NEAR, p));
    g.addColorStop(1, pal(SEA_DEEP, p));
    ctx.fillStyle = g;
    ctx.fillRect(0, hzn, W, H - hzn);

    /* 수평 파문 — 아래로 갈수록 간격이 벌어지는 원근 */
    const rows = W < 760 ? 26 : 44, span = H - hzn;
    ctx.lineWidth = 1;
    for (let i = 1; i < rows; i++) {
      const u = i / rows;
      const y = hzn + span * Math.pow(u, 2.15);
      const amp = 0.4 + u * u * 9;
      const alpha = (0.035 + u * 0.10) * (1 - ss(.70, 1, p) * 0.5);
      ctx.strokeStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      for (let x = 0; x <= W; x += 26) {
        const yy = y + Math.sin((x * 0.006) + t * (0.5 + u) + i * 2.9) * amp
          + Math.sin((x * 0.017) - t * 0.8 + i * 1.3) * amp * 0.45
          + Math.sin((x * 0.031) + t * 0.4 + i * 0.7) * amp * 0.22;
        x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    /* 수평선 아래 반짝임 */
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

    /* 수면 반사 */
    ctx.save();
    ctx.scale(1, -0.86);
    ctx.globalAlpha = a * 0.34;
    hullPath(ctx, L);
    ctx.fillStyle = tone;
    ctx.fill();
    ctx.fillRect(-L * 0.02, 0, L * 0.035, -L * 0.34);
    ctx.restore();
    /* 반사 흐리기 — 수면색 가로줄로 덮는다 */
    ctx.globalAlpha = a;
    for (let i = 0; i < 16; i++) {
      ctx.globalAlpha = a * (0.10 + i * 0.045);
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      ctx.fillRect(-L * 0.6, i * (L * 0.028), L * 1.2, L * 0.012);
    }
    ctx.globalAlpha = a;

    /* 선체 */
    hullPath(ctx, L);
    ctx.fillStyle = tone;
    ctx.fill();

    /* 태양광 갑판 */
    ctx.beginPath();
    ctx.moveTo(-L * 0.40, -h * 0.76);
    ctx.lineTo(L * 0.14, -h * 0.88);
    ctx.lineTo(L * 0.16, -h * 0.72);
    ctx.lineTo(-L * 0.39, -h * 0.60);
    ctx.closePath();
    ctx.fillStyle = 'rgba(150,170,190,.30)';
    ctx.fill();

    /* 마스트 + 돔 안테나 */
    ctx.fillStyle = tone;
    ctx.fillRect(L * 0.02, -L * 0.30, L * 0.022, L * 0.22);
    ctx.beginPath();
    ctx.ellipse(L * 0.031, -L * 0.315, L * 0.045, L * 0.030, 0, 0, Math.PI * 2);
    ctx.fill();
    /* 가는 안테나 */
    ctx.strokeStyle = tone; ctx.lineWidth = Math.max(1, L * 0.006);
    ctx.beginPath(); ctx.moveTo(-L * 0.20, -h * 0.80); ctx.lineTo(-L * 0.22, -L * 0.24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-L * 0.12, -h * 0.82); ctx.lineTo(-L * 0.10, -L * 0.20); ctx.stroke();
    ctx.restore();
  }

  /* ---------- 갑판 시점 ---------- */
  function deckView(p, hzn, t, a) {
    if (a <= 0.01) return;
    const roll = reduce ? 0 : Math.sin(t * 0.45) * 0.006;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2, H);
    ctx.rotate(roll);
    ctx.translate(-W / 2, -H);

    const vy = hzn + H * 0.045;            // 갑판이 수렴하는 소실점
    const halfB = W * 0.23, halfT = W * 0.019;
    const g = ctx.createLinearGradient(0, vy, 0, H);
    g.addColorStop(0, 'rgba(24,32,42,.86)');
    g.addColorStop(.45, '#16202b');
    g.addColorStop(1, '#0a1119');
    ctx.beginPath();
    ctx.moveTo(W / 2 - halfT, vy);
    ctx.lineTo(W / 2 + halfT, vy);
    ctx.lineTo(W / 2 + halfB, H);
    ctx.lineTo(W / 2 - halfB, H);
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill();

    /* 태양광 패널 이음매 */
    ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1;
    for (const k of [-0.55, -0.2, 0.2, 0.55]) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + halfT * k, vy);
      ctx.lineTo(W / 2 + halfB * k, H);
      ctx.stroke();
    }
    for (let i = 1; i < 9; i++) {
      const u = Math.pow(i / 9, 2.1), y = vy + (H - vy) * u;
      const hw = lerp(halfT, halfB, u);
      ctx.globalAlpha = a * (0.05 + u * 0.12);
      ctx.beginPath(); ctx.moveTo(W / 2 - hw, y); ctx.lineTo(W / 2 + hw, y); ctx.stroke();
    }
    ctx.globalAlpha = a;

    /* 마스트 + 돔 */
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

  /* ---------- 항공 시점 ---------- */
  function vesselTop(x, y, L, ang, a) {
    if (a <= 0.01) return;
    const w = L * 0.2;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.rotate(ang);

    /* 항적 — 옅고 길게 */
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

    /* 선체 — 가늘고 길게 */
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.62);
    ctx.quadraticCurveTo(w * 0.95, -L * 0.2, w * 0.85, L * 0.44);
    ctx.lineTo(-w * 0.85, L * 0.44);
    ctx.quadraticCurveTo(-w * 0.95, -L * 0.2, 0, -L * 0.62);
    ctx.closePath();
    ctx.fillStyle = '#0d141c'; ctx.fill();
    ctx.fillStyle = 'rgba(150,172,196,.22)';
    ctx.fillRect(-w * 0.48, -L * 0.24, w * 0.96, L * 0.52);
    ctx.restore();
  }

  /* ---------- 프레임 ---------- */
  let progress = 0, time = 0, last = performance.now();

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (!reduce) time += dt;
    const p = progress;

    ctx.clearRect(0, 0, W, H);
    const hzn = sky(p);
    sun(p, hzn);
    sea(p, hzn, time);

    const bob = reduce ? 0 : Math.sin(time * 0.7) * H * 0.004;

    /* 외부 시점 */
    const aOut = 1 - ss(.24, .36, p);
    if (aOut > 0.01) {
      const L = W * lerp(0.31, 0.38, ss(0, .3, p));
      const wy = hzn + (H - hzn) * 0.56 + bob;
      /* 양옆 동행 선박 — 더 크고 어둡게, 화면 밖으로 반쯤 걸치게 */
      vesselSide(-W * 0.10, hzn + (H - hzn) * 0.52 + bob * 0.6, W * 0.72, aOut * 0.9, '#1a222c');
      vesselSide(W * 1.10, hzn + (H - hzn) * 0.47 + bob * 0.8, W * 0.72, aOut * 0.9, '#1a222c');
      vesselSide(W * 0.5, wy, L, aOut, '#141b23');
    }

    /* 갑판 시점 */
    deckView(p, hzn, time, ss(.26, .40, p) * (1 - ss(.58, .70, p)));

    /* 항공 시점 */
    const aTop = ss(.60, .76, p);
    if (aTop > 0.01) {
      const rise = ss(.60, 1, p);
      const L = W * lerp(0.10, 0.055, rise);
      const cy = hzn + (H - hzn) * lerp(0.30, 0.42, rise);
      vesselTop(W * 0.5, cy + bob, L, 0, aTop);
      vesselTop(W * 0.21, cy + (H - hzn) * 0.20, L * 0.82, 0.20, aTop * 0.8);
      vesselTop(W * 0.80, cy + (H - hzn) * 0.16, L * 0.82, -0.18, aTop * 0.8);
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* 외부에서 진행도를 밀어 넣는다 (site.js) */
  window.VOYAGE = { set: v => { progress = clamp(v, 0, 1); } };
})();

'use strict';
/* ============================================================
   VOYAGE — 스크롤에 따라 이어지는 나룻배 항해 장면 (canvas 2D + 작은 3D 투영)

   나룻배 한 척(과 동행 배 셋)을 3D 좌표로 만들어 두고, 카메라 하나가 끊기지 않는 경로로 움직인다.
   장면을 갈아 끼우지 않으므로 옆모습 → 승선 → 항해 → 상공이 한 번의 카메라 이동으로 이어진다.

   0.00 ~ 0.14  먼 바다   오른쪽 옆에서 나룻배를 바라본다 (사공·삿갓·노·뜸이 보이는 옆모습)
   0.14 ~ 0.38  접근     뱃머리 쪽으로 돌아 들어가며 다가간다
   0.38 ~ 0.46  승선     뱃전을 넘어 앞자리에 앉으며 고개를 앞으로 돌린다
   0.46 ~ 0.64  항해     앞자리에서 뱃머리 너머를 본다 — 배와 함께 흔들린다
   0.64 ~ 1.00  상공     뒤로 물러나며 떠올라 배와 항적을 내려다본다

   좌표: x 오른쪽(우현) · y 위 · z 뱃머리 방향. 단위는 대략 미터, 수면은 y = 0.
   카메라 위치·시선은 단조 3차 보간(Fritsch–Carlson)으로 이어 구간 경계에서 멈칫하지 않고 넘치지도 않는다.
   진행도는 스크롤 값을 그대로 쓰지 않고 프레임마다 감쇠 보간한다.
   ============================================================ */
(function () {
  const cvs = document.getElementById('sea');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, DPR = 1, F = 1;   // F: 초점 거리(px)
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    F = Math.max(W * 0.95, H * 0.75);
  }
  resize();
  addEventListener('resize', resize, { passive: true });

  /* ---------- 유틸 ---------- */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  /* smootherstep — 양 끝의 기울기가 0이라 구간이 이어져도 꺾임이 보이지 않는다 */
  const sss = t => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
  const ss = (e0, e1, x) => sss((x - e0) / (e1 - e0));

  /* 키프레임 사이를 smootherstep으로 잇는다: track(p, [[위치, 값], ...]) — 색·투명도용 */
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

  /* 단조 3차 보간 — 키프레임을 지날 때 속도가 0으로 떨어지지 않고(연속 이동), 값이 넘치지도 않는다(카메라가 물속으로 안 들어감) */
  function monotone(keys) {
    const n = keys.length, t = keys.map(k => k[0]), v = keys.map(k => k[1]);
    const d = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) d[i] = (v[i + 1] - v[i]) / (t[i + 1] - t[i]);
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
    }
    return p => {
      if (p <= t[0]) return v[0];
      if (p >= t[n - 1]) return v[n - 1];
      let i = 0;
      while (p > t[i + 1]) i++;
      const h = t[i + 1] - t[i], s = (p - t[i]) / h, s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * v[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * v[i + 1] + (s3 - s2) * h * m[i + 1];
    };
  }

  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = c => 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';
  function mix(c1, c2, t) {
    const a = hex(c1), b = hex(c2);
    return rgb([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
  }
  /* 임의 개수의 색 키프레임 보간 */
  function pal(keys, t) {
    const n = keys.length - 1, x = clamp(t, 0, 1) * n;
    const i = Math.min(Math.floor(x), n - 1);
    return mix(keys[i], keys[i + 1], x - i);
  }
  const parseRgb = s => s.match(/\d+/g).map(Number);

  /* 벡터 */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  /* 다각형을 평면 하나로 자른다 (dist ≥ 0 쪽만 남김) — 수면 아래·카메라 뒤를 잘라낼 때 */
  function clip(pts, dist, closed) {
    const out = [], n = pts.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = pts[i], b = pts[(i + 1) % n], da = dist(a), db = dist(b);
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) out.push(lerp3(a, b, da / (da - db)));
    }
    if (!closed && n && dist(pts[n - 1]) >= 0) out.push(pts[n - 1]);
    return out;
  }

  /* ---------- 팔레트 (새벽 → 아침 → 한낮 → 상공) ---------- */
  const SKY_TOP = ['#6d84a0', '#7e9cc0', '#79a8d2', '#a8c6dd'];
  const SKY_MID = ['#b0aeb8', '#a9bfd6', '#bcd3e4', '#d2e1ec'];
  const SKY_HZN = ['#e6d4c7', '#ead0be', '#e6ddd8', '#eff4f7'];
  const SEA_NEAR = ['#8b8d96', '#7d93a7', '#5f7f99', '#2b4d68'];
  const SEA_DEEP = ['#2a2f37', '#20303f', '#12283a', '#03070c'];

  /* ============================================================
     범선(슬루프) 모델 — 긴 오버행의 날씬한 선체, 흰 갑판과 낮은 선실,
     앞으로 기운 마스트에 걸린 메인세일과 집세일, 바우스프릿과 삭구
     ============================================================ */
  const SHIP = {
    hull: hex('#5d7183'), topside: hex('#8fa3b3'), boot: hex('#f2efe6'), bottom: hex('#3c4b58'),
    deck: hex('#ddd6c6'), deckLine: hex('#b9b0a0'), coach: hex('#e8e2d4'), coachSide: hex('#cdc5b4'),
    rim: hex('#3b4954'), well: hex('#c9c1b1'), spar: hex('#7a5533'), sparDark: hex('#4e3721'),
    sail: hex('#f6f2e8'), sailBack: hex('#ded7c8'), sailSeam: hex('#d8d0c0'), rope: hex('#4a4740'),
  };

  const Z0 = -1.55, LEN = 6.5;      // 고물(뒤) z, 선체 길이 — 조타석이 z≈1.2에 오도록 잡았다
  const MAST_Z = 3.05, MAST_H = 5.7, BOW_SPRIT = .95;
  const WELL0 = .30, WELL1 = .52;  // 조타석(콕핏)이 차지하는 t 구간

  /* t: 0(고물) → 1(이물) 위치에서의 단면.
     나룻배와 달리 바닥이 V자로 떨어지고, 양끝이 길게 빠진다 */
  function station(t) {
    const z = Z0 + t * LEN;
    const e = Math.sin(Math.PI * Math.min(1, Math.max(0, (t - .04) / .92))) ** .72;   // 끝으로 갈수록 0
    const b = .04 + 1.02 * e * (1 - .28 * Math.max(0, (t - .62) / .38) ** 2);         // 반폭 — 최대폭이 약간 뒤쪽
    const y0 = -.62 * e * (1 - .55 * Math.max(0, (t - .7) / .3) ** 2) + .02;          // 배밑 — 가운데가 깊다
    const ys = .40 + .34 * Math.max(0, (t - .58) / .42) ** 2.1 + .10 * Math.max(0, (.22 - t) / .22) ** 2;  // 뱃전 — 이물이 솟는다
    return { t, z, b, bc: b * .55, y0, ys };
  }
  const ring = s => [[-s.b, s.ys, s.z], [-s.bc, s.y0, s.z], [s.bc, s.y0, s.z], [s.b, s.ys, s.z]];

  function face(pts, c, n, extra) { return Object.assign({ k: 'f', p: pts, c, n }, extra); }
  function line(a, b, c, w, extra) { return Object.assign({ k: 'l', p: [a, b], c, w }, extra); }
  /* 다각형의 법선을 기준점에서 바깥을 향하게 맞춘다 */
  function outward(pts, from) {
    const n = norm(cross(sub(pts[1], pts[0]), sub(pts[pts.length - 1], pts[0])));
    const c = pts.reduce((s, q) => [s[0] + q[0] / pts.length, s[1] + q[1] / pts.length, s[2] + q[2] / pts.length], [0, 0, 0]);
    return dot(n, sub(c, from)) < 0 ? n.map(v => -v) : n;
  }
  /* 앞뒤 두 면 (돛처럼 얇은 천) */
  function twoSided(prims, pts, from, cOut, cIn, extra) {
    const n = outward(pts, from);
    prims.push(face(pts, cOut, n, extra), face(pts, cIn, n.map(v => -v), extra));
  }

  /* 돛 — 세 꼭짓점을 잡고 격자로 나눈 뒤 가운데를 부풀린다(바람을 먹은 배꼴) */
  function sail(prims, head, tack, clew, belly, seams) {
    const M = 5, N = 4;
    const at = (u, v) => {
      /* u: 앞변(head→tack) 비율, v: 그 높이에서 뒤쪽(leech)으로 가는 비율 */
      const a = lerp3(head, tack, u);
      const b = lerp3(head, clew, u);
      const q = lerp3(a, b, v);
      const bulge = Math.sin(Math.PI * v) * Math.sin(Math.PI * Math.min(1, u * 1.15)) * belly;
      return [q[0] + bulge, q[1], q[2] + bulge * .35];
    };
    const mid = [(head[0] + tack[0] + clew[0]) / 3, (head[1] + tack[1] + clew[1]) / 3, (head[2] + tack[2] + clew[2]) / 3];
    for (let i = 0; i < M; i++) {
      for (let j = 0; j < N; j++) {
        const u0 = i / M, u1 = (i + 1) / M, v0 = j / N, v1 = (j + 1) / N;
        const quad = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
        /* 꼭짓점 쪽은 삼각형으로 찌그러지므로 중복점을 걸러 낸다 */
        const pts = quad.filter((q, k) => k === 0 || Math.hypot(...sub(q, quad[k - 1])) > 1e-4);
        if (pts.length < 3) continue;
        const extra = seams && j === N - 1 ? undefined : undefined;
        twoSided(prims, pts, [mid[0] - belly * 3, mid[1], mid[2]], SHIP.sail, SHIP.sailBack, extra);
      }
    }
    /* 돛의 세 변 — 천이 끝나는 자리를 또렷하게 */
    prims.push(line(head, tack, SHIP.sailSeam, .05), line(tack, clew, SHIP.sailSeam, .05), line(clew, head, SHIP.sailSeam, .05));
  }

  function buildBoat() {
    const prims = [], N = 17;
    const st = Array.from({ length: N }, (_, i) => station(i / (N - 1)));

    /* ---- 선체 ---- */
    for (let i = 0; i < N - 1; i++) {
      const A = ring(st[i]), B = ring(st[i + 1]);
      const cz = (st[i].z + st[i + 1].z) / 2;
      for (let e = 0; e < 3; e++) {
        const q = [A[e], A[e + 1], B[e + 1], B[e]];
        const n = outward(q, [0, .1, cz]);
        const outCol = e === 1 ? SHIP.bottom : SHIP.hull;
        /* 뱃전 바로 아래 흰 띠(부트톱) — 옆판 위쪽 1/5 */
        const lines = [];
        if (e !== 1) {
          const lo = e === 0 ? 1 : 2, hi = e === 0 ? 0 : 3;
          lines.push([lerp3(A[lo], A[hi], .82), lerp3(B[lo], B[hi], .82)]);
        }
        prims.push(face(q, outCol, n, lines.length ? { lines, lc: SHIP.boot } : undefined));
        prims.push(face(q, SHIP.well, n.map(v => -v), { inside: true }));
      }
      /* 갑판 — 뱃전 사이를 덮는다. 조타석 구간만 비워 둔다 */
      const inWell = st[i].t >= WELL0 && st[i + 1].t <= WELL1;
      if (!inWell) {
        prims.push(face([A[0], B[0], B[3], A[3]], SHIP.deck, [0, 1, 0],
          { lines: [[lerp3(A[0], A[3], .5), lerp3(B[0], B[3], .5)]], lc: SHIP.deckLine }));
      }
      prims.push(line(A[0], B[0], SHIP.rim, .05), line(A[3], B[3], SHIP.rim, .05));
    }

    /* 이물·고물 마감 */
    const S = ring(st[0]), E = ring(st[N - 1]);
    prims.push(face(S, SHIP.hull, [0, 0, -1]), face(S, SHIP.well, [0, 0, 1], { inside: true }));
    prims.push(line(S[0], S[3], SHIP.rim, .055));

    /* ---- 조타석 ---- */
    const w0 = station(WELL0), w1 = station(WELL1), wy = .06;
    const wb = t => station(t).b * .60;
    const c0 = [[-wb(WELL0), w0.ys, w0.z], [wb(WELL0), w0.ys, w0.z]];
    const c1 = [[-wb(WELL1), w1.ys, w1.z], [wb(WELL1), w1.ys, w1.z]];
    prims.push(face([[c0[0][0], wy, w0.z], [c0[1][0], wy, w0.z], [c1[1][0], wy, w1.z], [c1[0][0], wy, w1.z]], SHIP.well, [0, 1, 0]));
    for (const sgn of [-1, 1]) {
      const a = [sgn * wb(WELL0), w0.ys, w0.z], b = [sgn * wb(WELL1), w1.ys, w1.z];
      prims.push(face([a, b, [b[0], wy, b[2]], [a[0], wy, a[2]]], SHIP.coachSide, [sgn, 0, 0]));
      /* 갑판과 조타석 사이의 좁은 옆길 */
      prims.push(face([[sgn * station(WELL0).b, w0.ys, w0.z], [sgn * station(WELL1).b, w1.ys, w1.z], b, a], SHIP.deck, [0, 1, 0]));
    }
    prims.push(face([c0[0], c0[1], [c0[1][0], wy, w0.z], [c0[0][0], wy, w0.z]], SHIP.coachSide, [0, 0, -1]));

    /* ---- 선실 — 조타석 앞의 낮은 지붕 ---- */
    const r0 = station(WELL1), r1 = station(.70), rh = .30;
    const rb = t => station(t).b * .62;
    const roof = [[-rb(WELL1), r0.ys + rh, r0.z], [rb(WELL1), r0.ys + rh, r0.z], [rb(.70), r1.ys + rh * .8, r1.z], [-rb(.70), r1.ys + rh * .8, r1.z]];
    prims.push(face(roof, SHIP.coach, [0, 1, 0], { lines: [[lerp3(roof[0], roof[1], .5), lerp3(roof[3], roof[2], .5)]], lc: SHIP.deckLine }));
    for (const sgn of [-1, 1]) {
      const a = [sgn * rb(WELL1), r0.ys, r0.z], b = [sgn * rb(.70), r1.ys, r1.z];
      prims.push(face([a, b, [b[0], b[1] + rh * .8, b[2]], [a[0], a[1] + rh, a[2]]], SHIP.coachSide, [sgn, 0, 0]));
    }
    prims.push(face([roof[0], roof[1], [rb(WELL1), r0.ys, r0.z], [-rb(WELL1), r0.ys, r0.z]], SHIP.coachSide, [0, 0, -1]));

    /* ---- 마스트 · 붐 · 바우스프릿 ---- */
    const ms = station((MAST_Z - Z0) / LEN);
    const foot = [0, ms.ys, MAST_Z], headPt = [0, MAST_H, MAST_Z - .55];      // 살짝 뒤로 기운다
    prims.push(line(foot, headPt, SHIP.spar, .085));
    const boomY = ms.ys + 1.58, boomEnd = [0, boomY - .08, MAST_Z - 1.60];   // 앉은 눈높이(1.36)보다 위 — 시선이 붐 아래로 지나간다
    prims.push(line([0, boomY, MAST_Z - .1], boomEnd, SHIP.spar, .06));

    const bowS = station(1), sprit = [0, bowS.ys + .06, bowS.z + BOW_SPRIT];
    prims.push(line([0, bowS.ys, bowS.z - .25], sprit, SHIP.spar, .05));

    /* ---- 돛 ---- */
    /* 메인세일 — 마스트와 붐 사이 */
    sail(prims, lerp3(foot, headPt, .985), lerp3(foot, headPt, .075), boomEnd, .10);
    /* 집세일 — 마스트 꼭대기에서 바우스프릿 끝으로 */
    sail(prims, lerp3(foot, headPt, .93), sprit, [.30, boomY + .25, MAST_Z - .35], .08);

    /* ---- 삭구 ---- */
    prims.push(line(headPt, sprit, SHIP.rope, .022));                          // 앞 스테이
    prims.push(line(headPt, [0, station(.02).ys, station(.02).z], SHIP.rope, .022));   // 뒤 스테이
    for (const sgn of [-1, 1]) {
      const sh = station(.42);
      prims.push(line(lerp3(foot, headPt, .82), [sgn * sh.b * .92, sh.ys, sh.z], SHIP.rope, .018));
    }

    /* ---- 물 닿는 선 ---- */
    const foam = [];
    for (const s of st) {
      if (s.y0 >= -.01) continue;
      const f = -s.y0 / (s.ys - s.y0), xw = s.bc + (s.b - s.bc) * f;
      foam.push([xw, s.z]);
    }
    return { prims, foam, stern: S };
  }

  const BOAT = buildBoat();

  /* 내가 타는 배 한 척 */
  const FLEET = [
    { x: 0, z: 0, s: 1, ph: 0, lead: true },
  ];

  /* ---------- 카메라 경로 — [p, 위치 xyz, 시선 xyz] ---------- */
  /* 배를 시야에서 놓치지 않는다 — 다가갈 때도, 뱃전을 넘을 때도, 떠오를 때도 시선은 배에 둔다 */
  const SEAT_X = -.28;                         // 앞자리 왼쪽에 앉는다 (이물 등불이 시야 한가운데를 가리지 않게)
  const KEYS = [
    [0.00, [24, 1.4, 1.0], [0, .55, .4]],     // 오른쪽 옆에서 바라봄
    [0.14, [17, 1.9, 3.0], [0, .6, .6]],      // 앞쪽으로 돌며 다가감
    [0.28, [8.0, 2.5, 2.4], [0, .6, 1.2]],
    [0.37, [2.6, 2.3, 1.0], [0, .45, 2.6]],   // 뱃전 위에서 배 안(이물 쪽)을 내려다봄
    [0.415, [.9, 1.62, 1.1], [-.1, .55, 4.6]],   // 먼저 자리로 내려앉고
    [0.46, [SEAT_X, 1.36, 1.2], [SEAT_X, 1.0, 40]],   // 그다음 고개를 들어 앞을 봄
    [0.60, [SEAT_X, 1.36, 1.15], [SEAT_X, 1.0, 40]],
    [0.66, [0, 2.4, -1.0], [0, .6, 9]],       // 일어나 뒤로 물러나며
    [0.73, [0, 5.2, -4.8], [0, .2, 1.6]],     // 떠올라 배 전체(뜸·사공까지)를 내려다봄
    [0.87, [0, 21, -16], [0, 0, 5.5]],
    [1.00, [0, 38, -23], [0, 0, 8]],          // 상공 — 배는 화면 아래쪽, 가운데는 마지막 문구 자리
  ];
  const camFn = [0, 1, 2].map(i => monotone(KEYS.map(k => [k[0], k[1][i]])));
  const lookFn = [0, 1, 2].map(i => monotone(KEYS.map(k => [k[0], k[2][i]])));

  const cam = {
    /* 배에 올라 있는 정도 — 이때는 카메라가 배와 함께 흔들린다 */
    onboard: p => track(p, [[.36, 0], [.45, 1], [.63, 1], [.72, 0]]),
    /* 색 진행 */
    tone: p => track(p, [[0, 0], [.32, .30], [.58, .58], [.82, .82], [1, 1]]),
    /* 고도 0 → 1 (구름·물결 연출용) */
    lift: p => track(p, [[.64, 0], [.76, .45], [.88, .85], [1, 1]]),
    /* 물살 속도 — 항해 구간에서 빨라진다 */
    speed: p => track(p, [[0, .30], [.30, .45], [.50, 1], [.66, 1], [.90, .5], [1, .42]]),
  };

  function makeCamera(p, bobY) {
    const ob = cam.onboard(p);
    const pos = camFn.map(f => f(p)); pos[1] += bobY * ob;
    const look = lookFn.map(f => f(p)); look[1] += bobY * ob;
    const fw = norm(sub(look, pos));
    const rt = norm(cross([0, 1, 0], fw));
    const up = cross(fw, rt);
    /* 먼 수평선이 화면에 놓이는 높이 */
    const hzn = H / 2 + F * Math.tan(Math.asin(clamp(fw[1], -.999, .999)));
    return { pos, fw, rt, up, hzn, ob };
  }
  const toCam = (c, q) => { const d = sub(q, c.pos); return [dot(d, c.rt), dot(d, c.up), dot(d, c.fw)]; };
  const NEAR = .12;
  const proj = q => [W / 2 + q[0] / q[2] * F, H / 2 - q[1] / q[2] * F];

  /* ---------- 하늘 ---------- */
  function sky(hzn, tone) {
    if (hzn <= 0) return;
    const g = ctx.createLinearGradient(0, 0, 0, hzn);
    g.addColorStop(0, pal(SKY_TOP, tone));
    g.addColorStop(.62, pal(SKY_MID, tone));
    g.addColorStop(1, pal(SKY_HZN, tone));
    ctx.fillStyle = g;
    ctx.fillRect(-W, -H, W * 3, hzn + H + 1);
  }

  /* 구름 — 고도가 올라가면 아래로 흐르며 커진다(지나쳐 올라가는 느낌) */
  const CLOUDS = [
    [.10, .17, .26, .030, .34], [.42, .11, .34, .026, .26],
    [.74, .20, .30, .034, .30], [.28, .27, .22, .022, .22],
    [.90, .30, .26, .028, .20], [.58, .33, .30, .020, .16],
  ];
  function clouds(p, hzn, drift, lift) {
    const a = track(p, [[0, .55], [.5, .8], [.86, .8], [1, 0]]) * clamp(hzn / (H * .25), 0, 1);
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

  function sun(p, hzn) {
    const a = track(p, [[0, 1], [.55, .85], [.9, .25], [1, .12]]);
    const x = W * track(p, [[0, .74], [.5, .66], [1, .58]]);
    const y = hzn - H * 0.06;
    const g = ctx.createRadialGradient(x, y, 0, x, y, H * 0.58);
    g.addColorStop(0, 'rgba(255,238,214,' + (0.40 * a) + ')');
    g.addColorStop(.42, 'rgba(255,226,202,' + (0.12 * a) + ')');
    g.addColorStop(1, 'rgba(255,226,202,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, Math.max(0, hzn + H * 0.3));
  }

  /* 해안선 — 항해 구간에만 수평선 위로 스쳐 지나간다 */
  function coast(p, hzn, drift, tone) {
    const a = track(p, [[.30, 0], [.44, .55], [.68, .5], [.82, 0]]);
    if (a <= .01 || hzn <= 0) return;
    const base = hzn + 1, hMax = H * 0.040;
    const off = (drift * 0.05) % 6.283;
    ctx.save();
    ctx.globalAlpha = a * 0.55;
    ctx.fillStyle = mix(pal(SKY_HZN, tone), '#48596b', .5);
    ctx.beginPath();
    ctx.moveTo(-W * .2, base);
    for (let x = -W * .2; x <= W * 1.2; x += 10) {
      const u = x / W * 3.4 + off;
      /* 봉우리 사이가 수평선까지 내려앉아 섬처럼 끊겨 보이게 한다 */
      let h = Math.sin(u) * .62 + Math.sin(u * 2.3 + 1.1) * .26 + Math.sin(u * 5.7) * .12;
      h = Math.max(0, h - 0.30) / 0.70;
      ctx.lineTo(x, base - h * hMax);
    }
    ctx.lineTo(W * 1.2, base);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* ---------- 바다 ---------- */
  function sea(hzn, tone, phase, lift) {
    const top = Math.max(hzn, -H * 4);
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, pal(SKY_HZN, tone));
    g.addColorStop(.08, pal(SEA_NEAR, tone));
    g.addColorStop(1, pal(SEA_DEEP, tone));
    ctx.fillStyle = g;
    ctx.fillRect(-W, Math.max(top, -H), W * 3, H * 3);

    const rows = W < 760 ? 28 : 46, span = H - top;
    ctx.lineWidth = 1;
    for (let i = 1; i < rows; i++) {
      const u = i / rows;
      const y = top + span * Math.pow(u, 2.15);
      if (y < -20) continue;
      const amp = 0.4 + u * u * 9;
      const alpha = (0.035 + u * 0.10) * (1 - lift * 0.45);
      ctx.strokeStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      for (let x = -W * .1; x <= W * 1.1; x += 26) {
        const yy = y
          + Math.sin((x * 0.006) + phase * (0.5 + u) + i * 2.9) * amp
          + Math.sin((x * 0.017) - phase * 0.8 + i * 1.3) * amp * 0.45
          + Math.sin((x * 0.031) + phase * 0.4 + i * 0.7) * amp * 0.22;
        x === -W * .1 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    if (hzn > -H * .2) {
      const gl = ctx.createLinearGradient(0, hzn, 0, hzn + span * 0.16);
      gl.addColorStop(0, 'rgba(255,255,255,.30)');
      gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(-W, hzn, W * 3, span * 0.16);
    }
  }

  /* ============================================================
     배 그리기 — 모든 면·선을 카메라 거리로 정렬해 먼 것부터 칠한다
     ============================================================ */
  const SUN_DIR = norm([-.45, .8, .4]);

  function pose(b, phase, rollScale) {
    const t = phase * .5 + b.ph;
    return {
      x: b.x, z: b.z, s: b.s,
      bob: reduce ? 0 : Math.sin(t) * .045,
      roll: reduce ? 0 : Math.sin(t * .66) * .035 * rollScale,
      pitch: reduce ? 0 : Math.sin(t * .9 + 1) * .018,
    };
  }
  function xf(q, P) {
    const x = q[0] * P.s, y = q[1] * P.s, z = q[2] * P.s;
    const cr = Math.cos(P.roll), sr = Math.sin(P.roll), cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
    const x1 = x * cr - y * sr, y1 = x * sr + y * cr;
    return [x1 + P.x, y1 * cp - z * sp + P.bob, y1 * sp + z * cp + P.z];
  }
  function xfN(n, P) {
    const cr = Math.cos(P.roll), sr = Math.sin(P.roll), cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
    const x1 = n[0] * cr - n[1] * sr, y1 = n[0] * sr + n[1] * cr;
    return [x1, y1 * cp - n[2] * sp, y1 * sp + n[2] * cp];
  }

  const above = q => q[1] + .005;           // 수면 위만
  const inFront = q => q[2] - NEAR;          // 카메라 앞만

  /* 월드 좌표 다각형/선 → 화면 좌표 + 깊이. 보이지 않으면 null */
  function toScreen(c, pts, closed) {
    const cp = clip(pts.map(q => toCam(c, q)), inFront, closed);
    if (cp.length < (closed ? 3 : 2)) return null;
    let z = 0;
    const s = cp.map(q => { z += q[2]; return proj(q); });
    return { s, z: z / cp.length, near: Math.min(...cp.map(q => q[2])) };
  }

  function shade(col, k, fog, fogCol) {
    return rgb([0, 1, 2].map(i => lerp(col[i] * k, fogCol[i], fog)));
  }

  function collect(c, P, items, refl, fogCol, dawn) {
    const camPos = c.pos;
    for (const pr of BOAT.prims) {
      const w = pr.p.map(q => xf(q, P));
      if (pr.k === 'f') {
        const n = xfN(pr.n, P);
        if (dot(n, sub(camPos, w[0])) <= 0) continue;          // 뒷면
        /* 바깥면만 수면에서 자른다 — 배 안쪽 바닥은 수면보다 낮아도 배 안에서 보인다 */
        const wet = pr.inside ? w : clip(w, above, true);
        if (wet.length < 3) continue;
        const sc = toScreen(c, wet, true);
        if (!sc) continue;
        const dist = Math.hypot(...sub(wet[0], camPos));
        const fog = 1 - Math.exp(-dist / 70);
        const k = (pr.inside ? .72 : .6) + .42 * Math.max(0, dot(n, SUN_DIR));
        const item = { z: sc.z, s: sc.s, fill: shade(pr.c, k * (1 - dawn * .18), fog, fogCol) };
        if (pr.lines && pr.lines.length) {
          item.lines = [];
          for (const L of pr.lines) {
            const lw = L.map(q => xf(q, P));
            const ls = toScreen(c, pr.inside ? lw : clip(lw, above, false), false);
            if (ls) item.lines.push(ls.s);
          }
          item.lc = shade(pr.lc, k, fog, fogCol);
          item.lw = Math.max(.5, .02 * F / sc.z);
        }
        items.push(item);
        /* 물에 비친 모습 — 위아래를 뒤집어 옅게 */
        if (refl && !pr.inside && c.pos[1] > 1.2) {
          const m = wet.map(q => [q[0], -q[1] * .9, q[2]]);
          const rs = toScreen(c, m, true);
          if (rs) refl.push({ z: rs.z, s: rs.s, fill: shade(pr.c, .55, fog, fogCol) });
        }
      } else if (pr.k === 'l') {
        const seg = clip(w, above, false);
        if (seg.length < 2) continue;
        const sc = toScreen(c, seg, false);
        if (!sc) continue;
        const fog = 1 - Math.exp(-Math.hypot(...sub(seg[0], camPos)) / 70);
        items.push({ z: sc.z, line: sc.s, stroke: shade(pr.c, .9, fog, fogCol), lw: Math.max(.7, pr.w * P.s * F / sc.z) });
      } else if (pr.k === 'd') {
        const q = toCam(c, w[0]);
        if (q[2] < NEAR) continue;
        const fog = 1 - Math.exp(-q[2] / 70);
        items.push({ z: q[2], disc: proj(q), r: pr.r * P.s * F / q[2], fill: shade(pr.c, 1, fog * (pr.lamp ? .3 : 1), fogCol), glow: pr.lamp ? .25 + dawn * .6 : 0 });
      }
    }
  }

  /* 물거품 · 항적 — 수면(y = 0)에 붙는다 */
  function wake(c, P, items, phase, alpha) {
    const at = (x, z) => [P.x + x * P.s, .01, P.z + z * P.s];
    const add = (a, b, al, w) => {
      const sc = toScreen(c, [a, b], false);
      if (sc) items.push({ z: sc.z + .05, line: sc.s, stroke: 'rgba(255,255,255,' + (al * alpha).toFixed(3) + ')', lw: Math.max(.6, w * F / sc.z) });
    };
    const f = BOAT.foam;
    for (let i = 0; i < f.length - 1; i++) {
      for (const sgn of [-1, 1]) add(at(sgn * f[i][0], f[i][1]), at(sgn * f[i + 1][0], f[i + 1][1]), .55, .06);
    }
    add(at(-f[0][0], f[0][1]), at(f[0][0], f[0][1]), .5, .07);
    /* 고물 뒤로 벌어지는 두 줄 */
    const x0 = f[0][0], z0 = f[0][1], K = 16;
    for (const sgn of [-1, 1]) {
      for (let k = 0; k < K; k++) {
        const wob = Math.sin(phase * 1.6 + k * .9 + sgn) * .12;
        add(at(sgn * (x0 + k * .34 + wob), z0 - k * 1.15), at(sgn * (x0 + (k + 1) * .34 + wob), z0 - (k + 1) * 1.15), .42 * (1 - k / K), .08 + k * .01);
      }
    }
    /* 가운데 흰 물살 */
    for (let k = 0; k < 10; k++) {
      const x = Math.sin(phase * 2.2 + k * 1.7) * .25;
      add(at(x - .15, z0 - .6 - k * 1.3), at(x + .15, z0 - 1.1 - k * 1.3), .3 * (1 - k / 10), .1);
    }
  }

  function drawItems(list, alpha) {
    /* 깊이가 거의 같은 면들이 프레임마다 앞뒤로 뒤집히지 않도록,
       차이가 미세하면 모델에 담긴 순서를 그대로 따른다 */
    list.forEach((it, i) => { it.i = i; });
    list.sort((a, b) => (Math.abs(a.z - b.z) < 1e-3 ? a.i - b.i : b.z - a.z));
    for (const it of list) {
      if (it.s) {
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        it.s.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
        ctx.closePath();
        ctx.fillStyle = it.fill;
        ctx.fill();
        /* 면 사이 틈이 비치지 않게 같은 색으로 한 번 더 두른다 */
        ctx.strokeStyle = it.fill; ctx.lineWidth = .8; ctx.stroke();
        if (it.lines) {
          ctx.strokeStyle = it.lc; ctx.lineWidth = it.lw; ctx.globalAlpha = alpha * .55;
          for (const L of it.lines) { ctx.beginPath(); L.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); }
        }
      } else if (it.line) {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = it.stroke; ctx.lineWidth = it.lw; ctx.lineCap = 'round';
        ctx.beginPath();
        it.line.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
        ctx.stroke();
      } else if (it.disc) {
        ctx.globalAlpha = alpha;
        if (it.glow) {
          const R = it.r * 9, g = ctx.createRadialGradient(it.disc[0], it.disc[1], 0, it.disc[0], it.disc[1], R);
          g.addColorStop(0, 'rgba(255,205,130,' + (it.glow * .55).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(255,205,130,0)');
          ctx.fillStyle = g;
          ctx.fillRect(it.disc[0] - R, it.disc[1] - R, R * 2, R * 2);
        }
        ctx.fillStyle = it.fill;
        ctx.beginPath(); ctx.arc(it.disc[0], it.disc[1], Math.max(.8, it.r), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
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
    if (reduce || Math.abs(d) < 0.0002) {
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

    const tone = cam.tone(p), lift = cam.lift(p);
    const lead = pose(FLEET[0], phase, 1);
    const c = makeCamera(p, lead.bob);
    /* 배에 타 있을 때는 카메라가 배와 함께 기울어 수평선이 흔들린다 */
    const tilt = lead.roll * c.ob;
    /* 배에 올라타 있는 동안에는 배를 카메라에 대해 완전히 고정한다.
       배만 흔들리면 면들의 깊이가 매 프레임 엇갈려 앞뒤 순서가 뒤집힌다(깜빡임).
       흔들림은 수평선 기울기(tilt)와 카메라 상하(bob)로만 표현한다. */
    lead.roll *= 1 - c.ob;
    lead.pitch *= 1 - c.ob;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (Math.abs(tilt) > 1e-4) {
      ctx.translate(W / 2, H / 2);
      ctx.rotate(tilt);
      ctx.scale(1.05, 1.05);
      ctx.translate(-W / 2, -H / 2);
    }
    const hzn = c.hzn;
    sky(hzn, tone);
    clouds(p, hzn, drift, lift);
    sun(p, hzn);
    coast(p, hzn, drift, tone);
    sea(hzn, tone, phase, lift);

    const fogCol = parseRgb(pal(SKY_HZN, tone));
    const dawn = 1 - clamp(tone / .5, 0, 1);
    const items = [], refl = [], water = [];
    FLEET.forEach((b, i) => {
      const P = i === 0 ? lead : pose(b, phase, 1);
      wake(c, P, water, phase, i === 0 ? 1 : .8);
      collect(c, P, items, refl, fogCol, dawn);
    });
    drawItems(refl, .22);
    drawItems(water, 1);
    drawItems(items, 1);
    ctx.restore();

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

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
     나룻배 모델 — 평평한 바닥, 양끝이 들린 뱃전, 네모난 이물·고물,
     가로 널판(멍에), 대나무 뜸, 삿갓 쓴 사공, 고물의 노, 이물의 등불
     ============================================================ */
  const WOOD = {
    hull: hex('#6a4a31'), keel: hex('#4a3322'), inner: hex('#a07a54'), floor: hex('#8e6a47'),
    rim: hex('#3a281b'), seat: hex('#b08a60'), plank: hex('#3b2a1c'),
    straw: hex('#b99a62'), strawIn: hex('#5c4a31'), rib: hex('#4d3d27'),
    cloth: hex('#d8d0bf'), skin: hex('#a47a58'), hat: hex('#c4a46b'), lamp: hex('#f5c67c'),
  };

  const Z0 = -3.0, LEN = 6.2;     // 고물(뒤) z, 배 길이
  /* t: 0(고물) → 1(이물) 위치에서의 단면 */
  function station(t) {
    const z = Z0 + t * LEN;
    const b = t < .42 ? .85 * (1 - .27 * ((t - .42) / .42) ** 2) : .85 * (1 - .62 * ((t - .42) / .58) ** 2);
    const y0 = -.22 + .34 * Math.max(0, (t - .55) / .45) ** 2 + .12 * Math.max(0, (.25 - t) / .25) ** 2;   // 바닥 — 양끝이 들린다
    const ys = .42 + .55 * Math.max(0, (t - .5) / .5) ** 2.2 + .18 * Math.max(0, (.3 - t) / .3) ** 2;     // 뱃전 — 이물이 높다
    return { t, z, b, bc: b * .72, y0, ys };
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
  /* 앞뒤 두 면 (뜸·노 날처럼 얇은 판) */
  function twoSided(prims, pts, from, cOut, cIn, extra) {
    const n = outward(pts, from);
    prims.push(face(pts, cOut, n, extra), face(pts, cIn, n.map(v => -v), extra));
  }

  function buildBoat() {
    const prims = [], N = 13;
    const st = Array.from({ length: N }, (_, i) => station(i / (N - 1)));

    /* 선체 — 바깥면·안쪽면을 따로 두고 법선으로 보이는 쪽만 그린다 */
    for (let i = 0; i < N - 1; i++) {
      const A = ring(st[i]), B = ring(st[i + 1]);
      for (let e = 0; e < 3; e++) {
        const q = [A[e], A[e + 1], B[e + 1], B[e]];
        const cz = (st[i].z + st[i + 1].z) / 2;
        const n = outward(q, [0, .3, cz]);
        const sideLines = [], floorLines = [];
        if (e !== 1) {
          // 옆판 이음선 (널빤지 두 줄)
          const lo = e === 0 ? 1 : 2, hi = e === 0 ? 0 : 3;
          for (const f of [.34, .67]) sideLines.push([lerp3(A[lo], A[hi], f), lerp3(B[lo], B[hi], f)]);
        } else {
          for (const f of [.2, .4, .6, .8]) floorLines.push([lerp3(A[1], A[2], f), lerp3(B[1], B[2], f)]);
        }
        prims.push(face(q, e === 1 ? WOOD.keel : WOOD.hull, n, { lines: sideLines, lc: WOOD.plank }));
        prims.push(face(q, e === 1 ? WOOD.floor : WOOD.inner, n.map(v => -v), { lines: floorLines, lc: WOOD.plank, inside: true }));
      }
      // 뱃전 테두리
      prims.push(line(A[0], B[0], WOOD.rim, .075), line(A[3], B[3], WOOD.rim, .075));
    }
    /* 이물·고물 판 (네모난 끝) */
    const S = ring(st[0]), E = ring(st[N - 1]);
    prims.push(face(S, WOOD.hull, [0, 0, -1], { lines: [[lerp3(S[1], S[0], .5), lerp3(S[2], S[3], .5)]], lc: WOOD.plank }), face(S, WOOD.inner, [0, 0, 1]));
    prims.push(face(E, WOOD.hull, [0, 0, 1], { lines: [[lerp3(E[1], E[0], .5), lerp3(E[2], E[3], .5)]], lc: WOOD.plank }), face(E, WOOD.inner, [0, 0, -1]));
    prims.push(line(S[0], S[3], WOOD.rim, .08), line(E[0], E[3], WOOD.rim, .08));

    /* 가로 널판 (앉는 자리) */
    for (const t of [.2, .56, .74, .88]) {
      const s = station(t), y = s.ys - .09, hw = s.b * .97, d = .12;
      prims.push(face([[-hw, y, s.z - d], [hw, y, s.z - d], [hw, y, s.z + d], [-hw, y, s.z + d]], WOOD.seat, [0, 1, 0]));
      prims.push(face([[-hw, y, s.z + d], [hw, y, s.z + d], [hw, y - .06, s.z + d], [-hw, y - .06, s.z + d]], WOOD.rim, [0, 0, 1]));
      prims.push(face([[-hw, y, s.z - d], [-hw, y - .06, s.z - d], [hw, y - .06, s.z - d], [hw, y, s.z - d]], WOOD.rim, [0, 0, -1]));
    }

    /* 뜸 — 배 가운데 뒤쪽을 덮는 대나무·짚 지붕 */
    const c0 = station(.2), c1 = station(.42), R = 10, rise = .78;
    const arch = s => Array.from({ length: R + 1 }, (_, j) => {
      const a = Math.PI * (1 - j / R);
      return [Math.cos(a) * s.b * .96, s.ys + Math.sin(a) * rise, s.z];
    });
    const a0 = arch(c0), a1 = arch(c1);
    for (let j = 0; j < R; j++) {
      const q = [a0[j], a0[j + 1], a1[j + 1], a1[j]];
      twoSided(prims, q, [0, (c0.ys + c1.ys) / 2, (c0.z + c1.z) / 2], WOOD.straw, WOOD.strawIn,
        { lines: [[lerp3(a0[j], a1[j], .5), lerp3(a0[j + 1], a1[j + 1], .5)]], lc: WOOD.rib });
    }
    for (const a of [a0, a1]) for (let j = 0; j < R; j++) prims.push(line(a[j], a[j + 1], WOOD.rib, .045));

    /* 사공 — 고물에 서서 노를 젓는다 */
    const sm = station(.06), base = sm.y0 + .05, bx = .12, bz = sm.z + .05;
    const hand = [.42, base + .82, bz - .3];
    prims.push(line([bx, base, bz], [bx, base + 1.12, bz], WOOD.cloth, .3));
    prims.push(line([bx, base + 1.02, bz], hand, WOOD.cloth, .1));
    prims.push({ k: 'd', p: [[bx, base + 1.3, bz]], r: .12, c: WOOD.skin });
    // 삿갓 — 넓은 원뿔
    const hatY = base + 1.37, hatR = .38, apex = [bx, hatY + .22, bz], H8 = 12;
    const brim = Array.from({ length: H8 }, (_, j) => {
      const a = j / H8 * Math.PI * 2;
      return [bx + Math.cos(a) * hatR, hatY, bz + Math.sin(a) * hatR];
    });
    for (let j = 0; j < H8; j++) {
      const tri = [apex, brim[j], brim[(j + 1) % H8]];
      prims.push(face(tri, WOOD.hat, outward(tri, [bx, hatY - .1, bz])));
    }
    prims.push(face(brim.slice().reverse(), WOOD.strawIn, [0, -1, 0]));

    /* 노 — 손잡이 → 고물 노좆(받침) → 물속 날 */
    const pivot = [.46, S[0][1] + .04, Z0 - .05], tip = [.85, -.5, Z0 - 2.7];
    prims.push(line(hand, pivot, WOOD.rim, .06), line(pivot, tip, WOOD.rim, .06));
    prims.push(line([.46, S[0][1] - .1, Z0 + .02], pivot, WOOD.rim, .07));
    const b0 = lerp3(pivot, tip, .62), bl = [.11, 0, 0];
    twoSided(prims, [sub(b0, bl), [b0[0] + bl[0], b0[1], b0[2]], [tip[0] + bl[0], tip[1], tip[2]], sub(tip, bl)], [0, 5, 0], WOOD.hull, WOOD.inner);

    /* 이물 기둥과 등불 */
    const e = station(1), post = [0, e.ys + .42, e.z - .18];
    prims.push(line([0, e.ys - .05, e.z - .18], post, WOOD.rim, .045));
    prims.push({ k: 'd', p: [[0, post[1] - .04, post[2]]], r: .055, c: WOOD.lamp, lamp: true });

    /* 물 닿는 선 (흰 물거품) — 바닥이 물 위로 뜬 이물 쪽은 없음 */
    const foam = [];
    for (const s of st) {
      if (s.y0 >= -.01) continue;
      const f = -s.y0 / (s.ys - s.y0), xw = s.bc + (s.b - s.bc) * f;
      foam.push([xw, s.z]);
    }
    return { prims, foam, stern: S };
  }

  const BOAT = buildBoat();

  /* 이끄는 배 + 동행 배 셋 (배끼리의 위치는 고정, 모두 같은 방향으로 나아간다) */
  const FLEET = [
    { x: 0, z: 0, s: 1, ph: 0, lead: true },
    { x: 11, z: -5.5, s: .92, ph: 1.7 },
    { x: -14, z: 9, s: .95, ph: 3.1 },
    { x: -5, z: 46, s: .9, ph: 4.4 },
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
    list.sort((a, b) => b.z - a.z);
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
    lead.roll *= 1 - c.ob;

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

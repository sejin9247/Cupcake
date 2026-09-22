'use strict';
/* ============================================================
   사이트 동작 — 스크롤 진행도, 챕터 전환, 프로젝트 탭, 등장 애니메이션
   ============================================================ */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------- 준비되지 않은 이미지는 자리표시자로 ---------- */
  function swapForPlaceholder(img) {
    if (!img.parentNode) return;
    const ph = document.createElement('div');
    ph.className = 'ph';
    ph.innerHTML = '이미지 자리<br>' + img.getAttribute('src') + '<br>파일을 넣으면 자동으로 표시됩니다';
    img.replaceWith(ph);
  }
  $$('img[data-slot]').forEach(img => {
    /* 리스너를 달기 전에 이미 실패했을 수 있으므로 상태를 먼저 확인한다 */
    if (img.complete && img.naturalWidth === 0) { swapForPlaceholder(img); return; }
    img.addEventListener('error', () => swapForPlaceholder(img), { once: true });
  });

  /* ---------- 인트로 스테이지 ---------- */
  const stage = $('#stage');
  const chaps = $$('.chap');
  const lines = $$('.lines li');
  const shots = $$('.shot');
  const cue = $('.scroll-cue');
  const skip = $('.skip');

  /* [시작, 끝] 구간에서 나타났다 사라지는 창 */
  function win(p, a, b, c, d) { return ss(a, b, p) * (1 - ss(c, d, p)); }

  /* 문구는 스크롤 원값이 아니라 캔버스와 같은 보간값을 따라간다.
     둘이 어긋나면 배경은 흐르는데 글자만 계단으로 튄다. */
  function paintChapters(p) {
    if (cue) cue.style.opacity = String((1 - ss(0.02, 0.10, p)) * 0.6);

    const o1 = 1 - ss(0.10, 0.20, p);
    const o2 = win(p, 0.46, 0.54, 0.62, 0.70);
    const o3 = ss(0.88, 0.95, p);
    const set = (el, o, shift) => {
      if (!el) return;
      el.style.opacity = o.toFixed(3);
      el.style.transform = 'translateY(' + (shift * (1 - o)).toFixed(1) + 'px)';
      el.classList.toggle('live', o > 0.6);
    };
    set(chaps[0], o1, 0);
    set(chaps[1], o2, 26);
    set(chaps[2], o3, 34);

    if (lines.length) {
      const u = clamp((p - 0.46) / 0.20, 0, 1);
      const idx = Math.min(lines.length - 1, Math.floor(u * lines.length));
      lines.forEach((li, i) => li.classList.toggle('hot', o2 > 0.3 && i <= idx));
    }
    shots.forEach((s, i) => s.classList.toggle('in', o2 > 0.45 && p > 0.48 + i * 0.04));
  }

  let ticking = false, first = true;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (!stage) return;
      const top = stage.offsetTop;
      const span = stage.offsetHeight - window.innerHeight;
      const p = clamp((window.scrollY - top) / span, 0, 1);
      const inStage = window.scrollY < top + stage.offsetHeight - window.innerHeight * 0.5;

      /* 첫 호출은 스냅 — 스크롤된 채로 새로고침하면 장면이 0부터 흘러오면 안 된다 */
      if (window.VOYAGE) { window.VOYAGE.set(p, first); window.VOYAGE.visible(inStage); first = false; }
      else paintChapters(p);                 // 캔버스가 없으면 스크롤 값으로 직접
      document.body.classList.toggle('on-stage', inStage);

      /* 헤더가 어두운 섹션 위에 있으면 흰 글씨로 */
      const onDark = darkAreas.some(el => {
        const r = el.getBoundingClientRect();
        return r.top < 74 && r.bottom > 26;
      });
      document.body.classList.toggle('on-dark', onDark);
      if (skip) skip.classList.toggle('show', inStage && p < 0.95);

      /* 우측 레일 */
      const mid = window.scrollY + window.innerHeight * 0.4;
      let active = null;
      // 숨겨진 섹션(공개 프로젝트가 없을 때의 #projects)은 offsetTop이 0이라 건너뛴다
      railTargets.forEach(t => { if (t.el && !t.el.hidden && t.el.offsetTop <= mid) active = t; });
      railTargets.forEach(t => t.link.classList.toggle('on', t === active));
    });
  }

  const railTargets = $$('.rail a').map(link => ({
    link, el: document.querySelector(link.getAttribute('href'))
  }));
  const darkAreas = $$('.showcase, #contact, footer.foot');

  if (window.VOYAGE) window.VOYAGE.onFrame(paintChapters);

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* 히어로 CTA — 다음 챕터로 */
  const cta = $('#startBtn');
  if (cta && stage) {
    cta.addEventListener('click', () => {
      const span = stage.offsetHeight - window.innerHeight;
      window.scrollTo({ top: stage.offsetTop + span * 0.33, behavior: 'smooth' });
    });
  }
  if (skip) {
    skip.addEventListener('click', () => {
      const w = $('#work');
      if (w) window.scrollTo({ top: w.offsetTop, behavior: 'smooth' });
    });
  }

  /* ---------- 프로젝트 탭 ---------- */
  const tabs = $$('.tabs button');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.target;
      tabs.forEach(b => b.setAttribute('aria-selected', String(b === btn)));
      $$('.panel').forEach(pn => pn.classList.toggle('on', pn.dataset.proj === key));
    });
  });

  /* ---------- 등장 애니메이션 ---------- */
  const io = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
  $$('.reveal').forEach(el => io.observe(el));

  /* 올해 표기 */
  const y = $('#yr');
  if (y) y.textContent = String(new Date().getFullYear());
})();

'use strict';
/* ============================================================
   인트로 시퀀스 · 메뉴 · 등장 애니메이션
   인트로: 썸네일 띠 → 가운데 한 장 → 화면 전면 → 히어로로 인계
   ============================================================ */
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 준비되지 않은 이미지는 자리표시자로 ---------- */
  function placeholder(img) {
    if (!img.parentNode) return;
    const d = document.createElement('div');
    d.className = 'ph';
    d.style.aspectRatio = img.dataset.ratio || '3 / 4';
    d.textContent = (img.dataset.note || '이미지 자리') + ' · ' + img.getAttribute('src').split('/').pop();
    img.replaceWith(d);
  }
  $$('img[data-slot]').forEach(img => {
    if (img.complete && img.naturalWidth === 0) { placeholder(img); return; }
    img.addEventListener('error', () => placeholder(img), { once: true });
  });
  /* 있으면 쓰고 없으면 조용히 빠지는 이미지 — 뒤의 톤 배경이 대신 보인다 */
  $$('img[data-optional]').forEach(img => {
    const drop = () => img.remove();
    if (img.complete && img.naturalWidth === 0) { drop(); return; }
    img.addEventListener('error', drop, { once: true });
  });

  /* ---------- 로딩 띠 ----------
     strip-01.jpg부터 차례로 걸고, 없는 번호는 톤 견본으로 바꾼다.
     사진을 추가하려면 img/ 안에 다음 번호로 넣기만 하면 된다. */
  const strip = $('#strip');
  if (strip) {
    const count = Number(strip.dataset.count) || 15;
    for (let i = 1; i <= count; i++) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = 'img/strip-' + String(i).padStart(2, '0') + '.jpg';
      img.addEventListener('error', () => {
        const sw = document.createElement('i');
        sw.className = 't' + (i % 5 + 1);       // 빠진 칸은 색으로 채워 띠가 끊기지 않게
        img.replaceWith(sw);
      }, { once: true });
      strip.appendChild(img);
    }
  }

  /* ---------- 인트로 ---------- */
  const intro = $('#intro'), bar = $('.bar'), heroCopy = $('.hero-copy');
  const timers = [];
  let finished = false;

  function reveal() {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    intro.classList.add('s2', 's3', 'done');
    intro.style.opacity = '0';
    document.body.classList.remove('locked');
    document.body.classList.add('over-media');
    bar.classList.add('in');
    heroCopy.classList.add('in');
    setTimeout(() => { intro.style.display = 'none'; }, 700);
  }

  if (intro) {
    intro.style.transition = 'opacity .6s ease';
    if (reduce) {
      reveal();
    } else {
      document.body.classList.add('locked');
      timers.push(setTimeout(() => intro.classList.add('s2'), 1900));
      timers.push(setTimeout(() => intro.classList.add('s3'), 3150));
      timers.push(setTimeout(reveal, 4250));
      intro.addEventListener('click', reveal);          // 눌러서 건너뛰기
    }
  }

  /* ---------- 히어로 위에서는 상단 바를 흰 글씨로 ---------- */
  const hero = $('.hero');
  if (hero) {
    const io = new IntersectionObserver(es => {
      es.forEach(e => document.body.classList.toggle('over-media', e.isIntersecting && e.intersectionRatio > 0.12));
    }, { threshold: [0, 0.12, 0.5] });
    io.observe(hero);
  }

  /* ---------- 등장 ---------- */
  const rio = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
  $$('.reveal').forEach(el => rio.observe(el));

  /* ---------- 메뉴 ---------- */
  const menu = $('#menu');
  const open = () => { menu.classList.add('open'); document.body.classList.add('locked'); };
  const close = () => { menu.classList.remove('open'); document.body.classList.remove('locked'); };
  const menuBtn = $('#menuBtn');
  if (menuBtn) menuBtn.addEventListener('click', open);
  const closeBtn = $('#closeBtn');
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (menu) {
    menu.addEventListener('click', e => { if (e.target.tagName === 'A') close(); });
    addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  const y = $('#yr');
  if (y) y.textContent = String(new Date().getFullYear());
})();

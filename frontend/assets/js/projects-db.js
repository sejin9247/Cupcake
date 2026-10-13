'use strict';
/* ============================================================
   작업물 패널의 글을 데이터베이스 값으로 맞춘다.

   HTML에는 지금 글이 그대로 들어 있다. 이 스크립트는 그것을 지우지 않고,
   DB 값이 다를 때만 덮어쓴다. 그래서
     - 자바스크립트가 돌기 전에도 패널이 비어 보이지 않고
     - 검색엔진도 글을 읽을 수 있고
     - 서버를 못 불러도 사이트가 지금과 똑같이 보인다.

   바꾸는 것: 눈썹글 · 설명 문단 · 항목표
   건드리지 않는 것: 큰 제목(줄바꿈·꾸밈), 그림, 링크 버튼
   ============================================================ */
(() => {
  const panels = document.querySelectorAll('.panel[data-proj]');
  if (!panels.length) return;

  /* 글자로만 넣는다 — DB 값을 HTML로 해석하면 꾸밈이 섞여 들어올 수 있다 */
  const setText = (el, value) => {
    if (!el || typeof value !== 'string') return 0;
    const next = value.trim();
    if (!next || el.textContent.trim() === next) return 0;
    el.textContent = next;
    return 1;
  };

  /* 항목표를 다시 그린다. 이름·값 짝이 그대로면 손대지 않는다. */
  function applyFacts(dl, facts) {
    if (!dl || !Array.isArray(facts) || !facts.length) return 0;

    const now = [...dl.querySelectorAll('div')].map(d => [
      d.querySelector('dt')?.textContent.trim() ?? '',
      d.querySelector('dd')?.textContent.trim() ?? '',
    ]);
    const want = facts.map(f => [String(f.label ?? '').trim(), String(f.value ?? '').trim()])
      .filter(([l, v]) => l && v);
    if (!want.length) return 0;
    if (JSON.stringify(now) === JSON.stringify(want)) return 0;

    const frag = document.createDocumentFragment();
    for (const [label, value] of want) {
      const wrap = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      wrap.append(dt, dd);
      frag.append(wrap);
    }
    dl.replaceChildren(frag);
    return 1;
  }

  (async () => {
    let list;
    try {
      const r = await fetch('/api/projects', { cache: 'no-cache', signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      list = (await r.json()).projects;
      if (!Array.isArray(list) || !list.length) throw new Error('빈 목록');
    } catch (e) {
      /* 못 불러도 화면은 HTML에 적힌 그대로다 — 아무것도 하지 않는다 */
      console.warn('[작업물] 데이터베이스에서 받지 못해 페이지에 적힌 글을 그대로 씁니다:', e.message);
      return;
    }

    const bySlug = new Map(list.map(p => [p.slug, p]));
    let changed = 0;

    for (const panel of panels) {
      const p = bySlug.get(panel.dataset.proj);
      if (!p) continue;                      // DB에 없는 패널은 HTML 그대로 둔다
      changed += setText(panel.querySelector('.pv-eyebrow, .pv-script'), p.eyebrow);
      changed += setText(panel.querySelector('.desc'), p.summary);
      changed += applyFacts(panel.querySelector('dl.meta'), p.facts);
    }

    if (changed) console.info(`[작업물] 데이터베이스 값으로 ${changed}곳을 맞췄습니다.`);
  })();
})();

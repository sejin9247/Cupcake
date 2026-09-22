'use strict';
/* ============================================================
   관리자 화면에서 '공개'로 저장한 프로젝트를 #projects 섹션에 그린다.
   백엔드가 없거나(배포 사이트) 공개된 프로젝트가 없으면 섹션은 숨긴 채로 둔다.
   ============================================================ */
(function () {
  const section = document.getElementById('projects');
  const list = document.getElementById('projectList');
  if (!section || !list) return;

  // 배포(Vercel)와 로컬 백엔드(4000)는 같은 주소의 /api, 다른 로컬 정적 서버(8765 등)는 4000번 백엔드
  const API_BASE = (() => {
    const { protocol, hostname, port } = location;
    if (protocol === 'file:') return null;
    const local = hostname === 'localhost' || hostname === '127.0.0.1';
    return local && port !== '4000' ? 'http://localhost:4000/api' : '/api';
  })();
  if (!API_BASE) return;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;   // 입력값은 항상 글자로만 넣는다 (HTML로 해석하지 않음)
    return n;
  };
  const paragraphs = text => String(text).split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).map(s => el('p', 'pp', s));

  function card(p, i) {
    const art = el('article', 'pcard');
    const head = el('div', 'pcard-head');
    head.append(el('span', 'no', 'Project ' + String(i + 2).padStart(2, '0')), el('h3', null, p.title));

    const grid = el('div', 'proj-grid');
    const aside = el('aside');
    const spec = el('dl', 'spec');
    [['기간', p.date], ['역할', p.role], ['참여 인원', p.members + '명']].forEach(([k, v]) => {
      const row = el('div');
      row.append(el('dt', null, k), el('dd', null, v));
      spec.append(row);
    });
    aside.append(spec);

    const body = el('div');
    const desc = el('div', 'block');
    desc.append(el('h4', null, 'Overview'), ...paragraphs(p.description));
    body.append(desc);
    if (p.notes) {
      const notes = el('div', 'block');
      notes.append(el('h4', null, 'Notes'), ...paragraphs(p.notes));
      body.append(notes);
    }
    grid.append(aside, body);
    art.append(head, grid);
    return art;
  }

  fetch(API_BASE + '/projects')
    .then(r => (r.ok ? r.json() : null))
    .then(js => {
      const items = js && Array.isArray(js.projects) ? js.projects : [];
      if (!items.length) return;
      list.replaceChildren(...items.map(card));
      section.hidden = false;
      const rail = document.querySelector('.rail a[href="#projects"]');
      if (rail) rail.hidden = false;
    })
    .catch(() => { /* 백엔드 없음 — 정적 내용만 보여 준다 */ });
})();

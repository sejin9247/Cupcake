'use strict';
/* ============================================================
   관리자 화면 — 로그인, 프로젝트 목록, 임시 저장 / 공개 / 수정 / 삭제, 중복 정리

   권한 유지 규칙
   - 로그인 토큰은 이 페이지의 메모리(변수)에만 둔다. 쿠키·localStorage·sessionStorage에 쓰지 않는다.
   - 창·탭을 닫거나, 새로고침하거나, 다른 페이지로 이동하면 토큰이 사라지고 서버 세션도 끝낸다.
   - 새 창에서는 항상 비밀번호를 다시 입력해야 한다.
   ============================================================ */
(() => {
  const API = '/api/admin';
  const FIELDS = ['title', 'role', 'description', 'date', 'members', 'notes'];
  const REQUIRED = ['title', 'role', 'description', 'date', 'members'];   // 공개할 때 필수 (참고사항 제외)

  const $ = (s, r = document) => r.querySelector(s);
  const views = {
    login: $('#loginView'), offline: $('#offlineView'),
    admin: $('#adminView'), bookings: $('#bookingsView'),
  };
  const LOGGED_IN = ['admin', 'bookings'];   // 상단 버튼이 보이는 화면
  const form = $('#projectForm');
  const saveBtn = $('#saveBtn');
  const deleteBtn = $('#deleteBtn');

  let token = null;         // 로그인 토큰 — 메모리에만
  let projects = [];
  let bookings = [];
  let currentId = null;     // null = 새 프로젝트
  let snapshot = '';        // 마지막으로 불러오거나 저장한 입력값 (저장 안 한 변경 감지용)

  /* ---------- API ---------- */
  async function api(path, { method = 'GET', body } = {}) {
    let r;
    try {
      r = await fetch(API + path, {
        method, credentials: 'omit', cache: 'no-store',
        headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
        body: body && JSON.stringify(body),
      });
    } catch {
      const e = new Error('서버에 연결할 수 없습니다.'); e.offline = true; throw e;
    }
    const js = await r.json().catch(() => null);
    if (!js) { const e = new Error('서버 응답을 읽을 수 없습니다.'); e.offline = true; throw e; }
    if (!r.ok) {
      const e = new Error(js.error?.message || `HTTP ${r.status}`);
      Object.assign(e, { status: r.status, fields: js.error?.fields, details: js.error?.details });
      if (r.status === 401 && path !== '/login') { signOutLocally(); showLogin('로그인이 만료되었습니다. 비밀번호를 다시 입력하세요.'); }
      throw e;
    }
    return js;
  }

  function show(name) {
    for (const [k, el] of Object.entries(views)) el.hidden = k !== name;
    $('#barActions').hidden = !LOGGED_IN.includes(name);
    $('#tabProjects').setAttribute('aria-current', String(name === 'admin'));
    $('#tabBookings').setAttribute('aria-current', String(name === 'bookings'));
  }

  /* 화면에 남은 관리 정보를 모두 지운다 (토큰, 목록, 입력값) */
  function signOutLocally() {
    token = null;
    projects = [];
    bookings = [];
    currentId = null;
    renderBookings();
    renderList();
    fillForm(null);
    renderEditor();
    setMsg('');
    if ($('#dupDlg').open) $('#dupDlg').close('cancel');
  }

  /* 서버 세션도 끝낸다. 페이지를 떠날 때도 전송되도록 keepalive */
  function endSession() {
    if (!token) return;
    const t = token;
    signOutLocally();
    fetch(API + '/logout', {
      method: 'POST', keepalive: true, credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: '{}',
    }).catch(() => {});
  }

  /* ---------- 로그인 ---------- */
  const loginForm = $('#loginForm');
  const loginMsg = $('#loginMsg');

  function showLogin(msg = '') {
    show('login');
    loginMsg.textContent = msg;
    loginForm.elements.password.value = '';
    loginForm.elements.password.focus();
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const input = loginForm.elements.password;
    const pw = input.value;
    input.value = '';   // 입력한 비밀번호를 화면에 남기지 않는다
    if (!pw) { loginMsg.textContent = '비밀번호를 입력하세요.'; input.focus(); return; }
    const btn = loginForm.querySelector('button');
    btn.disabled = true; loginMsg.textContent = '';
    try {
      token = (await api('/login', { method: 'POST', body: { password: pw } })).token;
      await enterAdmin();
    } catch (err) {
      token = null;
      loginMsg.textContent = err.message;
      input.focus();
    } finally {
      btn.disabled = false;
    }
  });

  $('#logoutBtn').addEventListener('click', () => {
    if (!confirmDiscard()) return;
    endSession();
    showLogin('로그아웃했습니다.');
  });

  // 창을 닫거나 이동하면 세션 종료. 뒤로 가기로 페이지가 되살아나도 로그인부터 다시
  addEventListener('pagehide', endSession);
  addEventListener('pageshow', e => { if (e.persisted) { signOutLocally(); showLogin(); } });
  addEventListener('beforeunload', e => { if (token && isDirty()) e.preventDefault(); });

  /* ---------- 목록 ---------- */
  const fmtDate = iso => new Date(iso).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const statusLabel = s => (s === 'published' ? '공개' : '초안');
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  function renderList() {
    $('#plist').replaceChildren(...projects.map(p => {
      const b = el('button');
      b.type = 'button';
      b.setAttribute('aria-current', String(p.id === currentId));
      const s = el('span', 's');
      s.append(el('span', `badge ${p.status}`, statusLabel(p.status)));
      if (p.duplicateIds?.length) s.append(el('span', 'badge dup', '중복'));
      s.append(fmtDate(p.updatedAt));
      b.append(el('span', 't' + (p.title ? '' : ' untitled'), p.title || '제목 없음'), s);
      b.addEventListener('click', () => { if (p.id !== currentId && confirmDiscard()) openProject(p.id); });
      const li = el('li');
      li.append(b);
      return li;
    }));
    $('#plistEmpty').hidden = projects.length > 0 || !token;
  }

  async function loadProjects() {
    projects = (await api('/projects')).projects;
    renderList();
  }

  /* ---------- 양식 ---------- */
  function readForm() {
    const v = Object.fromEntries(FIELDS.map(k => [k, form.elements[k].value.trim()]));
    v.status = form.elements.status.value;
    return JSON.stringify(v);
  }
  const values = () => JSON.parse(readForm());
  const isDirty = () => readForm() !== snapshot;
  const confirmDiscard = () => !isDirty() || confirm('저장하지 않은 내용이 있습니다. 버리고 이동할까요?');

  function fillForm(p) {
    for (const k of FIELDS) form.elements[k].value = p?.[k] ?? '';
    form.elements.status.value = p?.status ?? 'draft';
    clearErrors();
    syncStatus();
    snapshot = readForm();
  }

  function renderEditor() {
    const p = projects.find(x => x.id === currentId);
    $('#editorMode').textContent = p ? 'Edit project' : 'New project';
    $('#editorTitle').textContent = p ? (p.title || '제목 없는 초안') : '새 프로젝트';
    $('#editorMeta').textContent = p
      ? `${statusLabel(p.status)} · 마지막 저장 ${fmtDate(p.updatedAt)}${p.status === 'published' ? ' · 사이트에 표시 중' : ' · 사이트에 보이지 않음'}`
      : '';
    deleteBtn.hidden = !p;
    const dups = p ? projects.filter(x => p.duplicateIds?.includes(x.id)) : [];
    $('#dupNote').hidden = !dups.length;
    $('#dupNoteText').textContent = dups.length ? `제목이 같은 프로젝트가 ${dups.length}개 더 있습니다: ${dups.map(d => d.title).join(', ')}` : '';
    syncStatus();
  }

  function openProject(id) {
    currentId = id;
    fillForm(projects.find(x => x.id === id) ?? null);
    setMsg('');
    renderEditor();
    renderList();
    form.elements.title.focus({ preventScroll: true });
  }

  $('#newBtn').addEventListener('click', () => { if (confirmDiscard()) openProject(null); });

  /* 초안/공개 선택에 따라 버튼 이름·안내·필수 표시를 바꾼다 */
  function syncStatus() {
    const pub = form.elements.status.value === 'published';
    form.classList.toggle('publishing', pub);
    saveBtn.textContent = pub ? (currentId ? '수정 내용 공개' : '공개 저장') : '임시 저장';
    $('#statusHint').textContent = pub
      ? '참고사항을 뺀 모든 칸을 채워야 저장됩니다. 저장하면 사이트에 바로 표시됩니다.'
      : '빈칸이 있어도 임시 저장됩니다. 사이트 방문자에게는 보이지 않고, 다음에 로그인해도 그대로 남아 있습니다.';
  }
  form.addEventListener('change', e => {
    if (e.target.name === 'status') { syncStatus(); clearErrors(); setMsg(''); }
  });
  form.addEventListener('input', e => { if (e.target.name) setFieldError(e.target.name, ''); });

  /* ---------- 검증 (서버도 같은 규칙으로 다시 검사한다) ---------- */
  function setFieldError(name, msg) {
    const slot = form.querySelector(`.ferr[data-for="${name}"]`);
    if (slot) slot.textContent = msg;
    form.elements[name]?.closest?.('.field')?.classList.toggle('invalid', !!msg);
  }
  function clearErrors() { for (const k of [...FIELDS, 'status']) setFieldError(k, ''); }

  function validate(v) {
    const errs = {};
    if (v.members !== '' && !(Number.isInteger(+v.members) && +v.members >= 1 && +v.members <= 999)) {
      errs.members = '참여 인원은 1~999 사이의 숫자로 입력하세요.';
    }
    if (v.status === 'published') {
      for (const k of REQUIRED) if (!v[k] && !errs[k]) errs[k] = '공개하려면 꼭 입력해야 합니다.';
    } else if (FIELDS.every(k => !v[k])) {
      return { form: '적어도 한 칸은 입력해야 임시 저장할 수 있습니다.' };
    }
    return errs;
  }

  function showErrors(errs) {
    clearErrors();
    for (const [k, m] of Object.entries(errs)) if (k !== 'form') setFieldError(k, m);
    const first = FIELDS.find(k => errs[k]);
    if (first) form.elements[first].focus();
    const n = Object.keys(errs).filter(k => k !== 'form').length;
    setMsg(errs.form || `${n}개 칸을 확인하세요.`, 'err');
  }

  function setMsg(text, kind = '') {
    const m = $('#formMsg');
    m.textContent = text;
    m.className = 'msg' + (kind ? ' ' + kind : '');
  }

  const formBody = () => {
    const v = values();
    return { ...v, members: v.members === '' ? null : Number(v.members) };
  };
  const savedMsg = (p, verb) => `${verb} · ${p.status === 'published' ? '사이트에 공개됨' : '초안으로 임시 저장됨 (사이트에 보이지 않음)'}`;

  async function afterSave(project, verb) {
    await loadProjects();
    openProject(project.id);
    setMsg(savedMsg(project, verb), 'ok');
  }

  /* ---------- 중복 정리 ---------- */
  const dupDlg = $('#dupDlg');

  /* 중복 후보를 보여 주고 선택을 기다린다 → { choice, targetId } */
  function askDuplicate(dups) {
    const list = $('#dupList');
    list.replaceChildren(...dups.map((d, i) => {
      const label = el('label');
      const radio = el('input');
      Object.assign(radio, { type: 'radio', name: 'dupTarget', value: d.id, checked: i === 0 });
      label.append(radio, el('span', 't', d.title || '제목 없음'), el('span', 's', `${statusLabel(d.status)} · ${fmtDate(d.updatedAt)}`));
      const li = el('li');
      li.append(label);
      return li;
    }));
    $('#dupDiscard').textContent = currentId ? '이 중복 항목 제거' : '이 입력 제거';
    return new Promise(resolve => {
      const onClick = e => {
        const choice = e.target.closest('[data-choice]')?.dataset.choice;
        if (!choice) return;
        dupDlg.removeEventListener('click', onClick);
        const targetId = list.querySelector('input:checked')?.value;
        dupDlg.close();
        resolve({ choice, targetId });
      };
      dupDlg.addEventListener('click', onClick);
      dupDlg.addEventListener('cancel', () => { dupDlg.removeEventListener('click', onClick); resolve({ choice: 'cancel' }); }, { once: true });
      dupDlg.showModal();
    });
  }

  /* 중복 선택에 따라 처리. 반환값: 처리했으면 true */
  async function resolveDuplicate(dups) {
    const { choice, targetId } = await askDuplicate(dups);
    if (choice === 'cancel') { setMsg('저장하지 않았습니다.'); return true; }

    if (choice === 'merge') {
      const { project } = await api(`/projects/${targetId}/merge`, { method: 'POST', body: { ...formBody(), removeId: currentId ?? undefined } });
      await afterSave(project, '기존 프로젝트에 통합했습니다');
      return true;
    }
    if (choice === 'discard') {
      const removed = currentId;
      if (removed) await api(`/projects/${removed}`, { method: 'DELETE' });
      await loadProjects();
      openProject(targetId);
      setMsg(removed ? '중복 항목을 제거하고 기존 프로젝트를 열었습니다.' : '입력 내용을 버리고 기존 프로젝트를 열었습니다.', 'ok');
      return true;
    }
    return false;   // separate → 호출한 쪽에서 allowDuplicate로 다시 저장
  }

  $('#dupNoteBtn').addEventListener('click', async () => {
    const p = projects.find(x => x.id === currentId);
    const dups = projects.filter(x => p?.duplicateIds?.includes(x.id));
    if (!dups.length) return;
    try {
      if (!(await resolveDuplicate(dups))) setMsg('따로 두었습니다. 목록에는 계속 "중복"으로 표시됩니다.');
    } catch (err) { if (err.status !== 401) setMsg(err.message, 'err'); }
  });

  /* ---------- 저장 · 삭제 ---------- */
  async function save(allowDuplicate = false) {
    const body = { ...formBody(), ...(allowDuplicate && { allowDuplicate: true }) };
    const wasNew = !currentId;
    const { project } = wasNew
      ? await api('/projects', { method: 'POST', body })
      : await api(`/projects/${currentId}`, { method: 'PUT', body });
    await afterSave(project, wasNew ? '새로 저장했습니다' : '수정 내용을 저장했습니다');
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const v = values();
    // 숫자 입력칸에 숫자가 아닌 값을 넣으면 브라우저가 빈 값으로 돌려주므로 따로 확인
    if (form.elements.members.validity.badInput) v.members = 'x';
    const errs = validate(v);
    if (Object.keys(errs).length) { showErrors(errs); return; }

    saveBtn.disabled = true;
    setMsg('저장 중…');
    try {
      try {
        await save();
      } catch (err) {
        if (err.status !== 409) throw err;
        if (!(await resolveDuplicate(err.details?.duplicates ?? []))) await save(true);
      }
    } catch (err) {
      if (err.fields) showErrors(err.fields);
      else if (err.status !== 401) setMsg(err.message, 'err');
    } finally {
      saveBtn.disabled = false;
    }
  });

  deleteBtn.addEventListener('click', async () => {
    const p = projects.find(x => x.id === currentId);
    if (!p || !confirm(`'${p.title || '제목 없음'}' 프로젝트를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    deleteBtn.disabled = true;
    try {
      await api(`/projects/${p.id}`, { method: 'DELETE' });
      await loadProjects();
      openProject(null);
      setMsg('삭제했습니다.', 'ok');
    } catch (err) {
      if (err.status !== 401) setMsg(err.message, 'err');
    } finally {
      deleteBtn.disabled = false;
    }
  });

  /* ============================================================
     방문 예약 관리 — 받은 예약을 표로 보고 처리 상태만 바꾼다.
     신청자가 적은 내용은 고치지 않는다 (서버도 상태 외에는 받지 않는다).
     ============================================================ */
  const BK_STATES = [
    { key: 'received', label: '접수', hint: '신청이 들어온 그대로' },
    { key: 'confirmed', label: '확정', hint: '이 날짜·시간에 만나기로 승인' },
    { key: 'reschedule', label: '변경 요청', hint: '만나고 싶지만 다른 시간으로' },
    { key: 'cancelled', label: '취소', hint: '이 방문은 받지 않음' },
  ];
  const bkLabel = s => BK_STATES.find(x => x.key === s)?.label ?? s;

  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  /* '2026-10-08' + '15:00' → '2026년 10월 8일 (목) 15:00' */
  function fmtVisit(date, time) {
    const [y, m, d] = date.split('-').map(Number);
    return `${y}년 ${m}월 ${d}일 (${DOW[new Date(y, m - 1, d).getDay()]}) ${time}`;
  }

  function bkSetMsg(text, kind = '') {
    const m = $('#bkMsg');
    m.textContent = text;
    m.className = 'msg' + (kind ? ' ' + kind : '');
  }

  /* 한 줄 = 예약 하나. 열 순서는 표 머리글과 같다. */
  function bookingRow(b) {
    const tr = el('tr');
    tr.dataset.id = b.id;

    tr.append(el('td', 'bk-no mono', b.no));

    const who = el('td', 'bk-who');
    who.append(el('span', 'bk-name', b.name), el('span', 'bk-mail', b.email));
    tr.append(who);

    tr.append(el('td', 'bk-when', fmtVisit(b.date, b.time)));
    tr.append(el('td', 'bk-purpose', b.purpose));

    const st = el('td', 'bk-state');
    st.append(el('span', `badge bk-${b.status}`, bkLabel(b.status)));
    if (b.statusAt) st.append(el('span', 'bk-at', fmtDate(b.statusAt)));
    tr.append(st);

    const act = el('td', 'bk-act');
    const group = el('div', 'bk-btns');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', `${b.no} 처리 상태 바꾸기`);
    for (const s of BK_STATES) {
      const btn = el('button', `bk-pick bk-${s.key}`, s.label);
      btn.type = 'button';
      btn.dataset.status = s.key;
      btn.title = s.hint;
      const current = s.key === b.status;
      btn.setAttribute('aria-pressed', String(current));
      btn.disabled = current;             // 이미 그 상태면 누를 필요가 없다
      group.append(btn);
    }
    act.append(group);
    tr.append(act);
    return tr;
  }

  function renderBookings() {
    $('#bkBody').replaceChildren(...bookings.map(bookingRow));
    $('#bkEmpty').hidden = bookings.length > 0 || !token;
    $('.table-wrap').hidden = !bookings.length;

    const waiting = bookings.filter(b => b.status === 'received').length;
    const n = $('#tabBookingsN');
    n.hidden = !waiting;
    n.textContent = String(waiting);
    $('#bkSummary').textContent = bookings.length
      ? `받은 예약 ${bookings.length}건 · 아직 접수 상태 ${waiting}건. 방문 희망 시간이 이른 것부터 보여 줍니다.`
      : '받은 예약을 방문 희망 시간이 이른 것부터 보여 줍니다.';
  }

  /* 늦게 도착한 목록이 방금 바꾼 상태를 덮어쓰지 않게 한다.
     목록 읽기와 상태 바꾸기가 겹치면(탭을 누른 직후 버튼을 누르는 경우) 오래된 응답은 버린다. */
  let bkSeq = 0;

  async function loadBookings() {
    const seq = ++bkSeq;
    const { bookings: list } = await api('/bookings');
    if (seq !== bkSeq) return;        // 그 사이 더 새로운 일이 있었다
    bookings = list;
    renderBookings();
  }

  /* 상태 버튼 — 어느 줄에서 눌렀는지는 행의 data-id로 안다 */
  $('#bkBody').addEventListener('click', async e => {
    const btn = e.target.closest('button[data-status]');
    if (!btn || btn.disabled) return;
    const tr = btn.closest('tr');
    const b = bookings.find(x => x.id === tr.dataset.id);
    if (!b) return;

    const next = btn.dataset.status;
    if (next === 'cancelled' && !confirm(`${b.no} (${b.name}) 예약을 '취소'로 바꿀까요?`)) return;

    const group = btn.closest('.bk-btns');
    for (const x of group.children) x.disabled = true;
    bkSetMsg('바꾸는 중…');
    try {
      const { booking } = await api(`/bookings/${b.id}`, { method: 'PATCH', body: { status: next } });
      bkSeq++;                            // 진행 중인 목록 읽기보다 이 결과가 새것이다
      /* 기다리는 동안 목록이 새로 읽혔을 수 있다 — 그때의 b는 버려진 객체이므로 지금 목록을 id로 찾아 고친다 */
      const i = bookings.findIndex(x => x.id === booking.id);
      if (i >= 0) bookings[i] = booking; else bookings.push(booking);
      renderBookings();
      bkSetMsg(`${booking.no} → ${bkLabel(booking.status)}로 바꿨습니다.`, 'ok');
    } catch (err) {
      renderBookings();                   // 실패했으니 버튼을 원래대로 돌린다
      if (err.status !== 401) bkSetMsg(err.message, 'err');
    }
  });

  $('#bkReload').addEventListener('click', async () => {
    bkSetMsg('읽는 중…');
    try {
      await loadBookings();
      bkSetMsg(`새로 읽었습니다. (${bookings.length}건)`, 'ok');
    } catch (err) {
      if (err.status !== 401) bkSetMsg(err.message, 'err');
    }
  });

  /* ---------- 탭 ---------- */
  $('#tabProjects').addEventListener('click', () => show('admin'));

  $('#tabBookings').addEventListener('click', async () => {
    if (!confirmDiscard()) return;        // 프로젝트 양식에 저장 안 한 내용이 있으면 먼저 묻는다
    show('bookings');
    bkSetMsg('읽는 중…');
    try {
      await loadBookings();
      bkSetMsg('');
    } catch (err) {
      if (err.status !== 401) bkSetMsg(err.message, 'err');
    }
  });

  /* ---------- 시작: 항상 로그인 화면부터 ---------- */
  async function enterAdmin() {
    await loadProjects();
    show('admin');
    openProject(null);
    /* 예약도 미리 읽어 둔다 — 탭에 기다리는 건수를 띄우고, 눌렀을 때 바로 보이게.
       실패해도 로그인을 막지 않는다 (탭을 누르면 그때 이유를 보여 준다) */
    loadBookings().catch(() => {});
  }

  (async () => {
    try {
      const s = await api('/session');
      if (!s.configured) {
        showLogin('관리자 비밀번호가 아직 설정되지 않았습니다. 로컬: backend 폴더에서 npm run set-password · 배포: Vercel 환경 변수 ADMIN_PASSWORD_HASH');
      } else if (!s.storage) {
        showLogin('저장소가 연결되지 않아 저장할 수 없습니다. Vercel 프로젝트에 Upstash Redis를 연결하세요.');
      } else {
        showLogin();
      }
    } catch (err) {
      if (err.offline) show('offline');
    }
  })();
})();

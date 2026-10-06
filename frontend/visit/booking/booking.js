'use strict';
/* ============================================================
   방문 예약 — 달력(평일·공휴일 제외), 시간 선택, 입력 검사, 확인 팝업, 접수
   ============================================================ */
(function () {
  const $ = s => document.querySelector(s);
  const KST = 'Asia/Seoul';

  /* ---------- 날짜 도구 — 한국 시간 기준으로 다룬다 ---------- */
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  /* 브라우저가 어느 시간대에 있든 '한국의 오늘'을 쓴다 */
  function todayKST() {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: KST, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date());
    const g = t => p.find(x => x.type === t).value;
    return new Date(Number(g('year')), Number(g('month')) - 1, Number(g('day')));
  }
  const holidayName = key => (window.HOLIDAYS?.[key.slice(0, 4)] || {})[key] || null;

  const TODAY = todayKST();
  const LIMIT = new Date(TODAY.getFullYear(), TODAY.getMonth() + 3, 0);   // 석 달 뒤 말일까지

  function blocked(d) {
    const day = d.getDay();
    if (day === 0 || day === 6) return '주말';
    if (d < TODAY) return '지난 날짜';
    if (d > LIMIT) return '예약 가능 기간이 아님';
    const h = holidayName(ymd(d));
    return h ? h : null;
  }

  /* ---------- 달력 ---------- */
  const grid = $('#calGrid'), label = $('#calLabel');
  const prevBtn = $('#prevM'), nextBtn = $('#nextM');
  let view = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
  let picked = null;                       // 'YYYY-MM-DD'

  function renderCal() {
    const y = view.getFullYear(), m = view.getMonth();
    label.textContent = y + '년 ' + (m + 1) + '월';
    grid.textContent = '';

    const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
    for (let i = 0; i < first.getDay(); i++) {
      const b = document.createElement('span');
      b.className = 'blank';
      grid.appendChild(b);
    }
    for (let day = 1; day <= last.getDate(); day++) {
      const d = new Date(y, m, day), key = ymd(d);
      const why = blocked(d);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = day;
      btn.dataset.date = key;
      btn.setAttribute('aria-pressed', String(picked === key));
      if (ymd(TODAY) === key) btn.classList.add('today');
      if (why) {
        btn.disabled = true;
        btn.title = why;
        btn.setAttribute('aria-label', day + '일 — ' + why);
      }
      grid.appendChild(btn);
    }
    /* 지난 달·너무 먼 달로는 넘어가지 않는다 */
    prevBtn.disabled = y === TODAY.getFullYear() && m === TODAY.getMonth();
    nextBtn.disabled = new Date(y, m + 1, 1) > LIMIT;
  }

  grid.addEventListener('click', e => {
    const btn = e.target.closest('button[data-date]');
    if (!btn || btn.disabled) return;
    picked = btn.dataset.date;
    renderCal();
    showPicked();
    validate();
  });
  prevBtn.addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCal(); });
  nextBtn.addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCal(); });

  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  function pickedLabel() {
    if (!picked) return '';
    const [y, m, d] = picked.split('-').map(Number);
    return y + '년 ' + m + '월 ' + d + '일 (' + DOW[new Date(y, m - 1, d).getDay()] + ')';
  }
  function showPicked() {
    const box = $('.picked');
    $('#pickedDate').textContent = picked ? pickedLabel() : '아직 고르지 않았습니다';
    box.classList.toggle('on', !!picked);
  }

  /* ---------- 시간 — 13:00 ~ 18:00, 30분 단위 ---------- */
  const timeSel = $('#time');
  for (let t = 13 * 60; t <= 18 * 60; t += 30) {
    const v = pad(Math.floor(t / 60)) + ':' + pad(t % 60);
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    timeSel.appendChild(o);
  }

  /* ---------- 입력 검사 ---------- */
  const nameEl = $('#name'), emailEl = $('#email'), purposeEl = $('#purpose'), consentEl = $('#consent');
  const submitBtn = $('#submitBtn'), need = $('#need');
  const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

  const filled = el => el.value.trim().length > 0;
  const emailOk = () => EMAIL_RE.test(emailEl.value.trim());

  /* 잘못 적었을 때만 빨갛게 — 아직 손대지 않은 칸은 건드리지 않는다 */
  function mark(el, errEl, bad, touched) {
    const show = bad && touched;
    el.classList.toggle('bad', show);
    el.setAttribute('aria-invalid', String(show));
    errEl.hidden = !show;
  }

  const touched = { name: false, email: false, purpose: false };
  function validate() {
    mark(nameEl, $('#nameErr'), !filled(nameEl), touched.name);
    mark(emailEl, $('#emailErr'), !emailOk(), touched.email);
    mark(purposeEl, $('#purposeErr'), !filled(purposeEl), touched.purpose);

    const missing = [];
    if (!picked) missing.push('날짜');
    if (!timeSel.value) missing.push('시간');
    if (!filled(nameEl)) missing.push('이름');
    if (!emailOk()) missing.push('이메일');
    if (!filled(purposeEl)) missing.push('방문 목적');
    if (!consentEl.checked) missing.push('동의');

    submitBtn.disabled = missing.length > 0;
    need.classList.toggle('ok', missing.length === 0);
    need.textContent = missing.length
      ? '아직 ' + missing.join(' · ') + ' 이(가) 남았습니다.'
      : '모두 채우셨습니다. 예약하기를 누르면 확인 창이 열립니다.';
    return missing.length === 0;
  }

  [nameEl, emailEl, purposeEl].forEach(el => {
    const key = el.id;
    el.addEventListener('input', () => {
      if (key === 'purpose') $('#purposeCount').textContent = el.value.length.toLocaleString();
      if (touched[key]) validate(); else { submitBtnState(); }
    });
    el.addEventListener('blur', () => { touched[key] = true; validate(); });
  });
  timeSel.addEventListener('change', validate);
  consentEl.addEventListener('change', validate);

  /* 아직 blur 전이라도 버튼 상태는 따라가야 한다 */
  function submitBtnState() {
    const ok = picked && timeSel.value && filled(nameEl) && emailOk() && filled(purposeEl) && consentEl.checked;
    submitBtn.disabled = !ok;
    need.classList.toggle('ok', !!ok);
    if (ok) need.textContent = '모두 채우셨습니다. 예약하기를 누르면 확인 창이 열립니다.';
  }

  /* ---------- 확인 팝업 ---------- */
  const dlg = $('#confirmDlg'), review = $('#review'), dlgErr = $('#dlgErr');
  const doneDlg = $('#doneDlg');

  function row(k, v) {
    const d = document.createElement('div');
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;   // 입력값은 글자로만 넣는다
    d.append(dt, dd);
    return d;
  }

  $('#bk').addEventListener('submit', e => {
    e.preventDefault();
    touched.name = touched.email = touched.purpose = true;
    if (!validate()) return;
    review.textContent = '';
    review.append(
      row('날짜', pickedLabel()),
      row('시간', timeSel.value),
      row('이름', nameEl.value.trim()),
      row('이메일', emailEl.value.trim()),
      row('방문 목적', purposeEl.value.trim()),
    );
    dlgErr.hidden = true;
    dlg.showModal();
  });

  $('#dlgCancel').addEventListener('click', () => dlg.close());

  $('#dlgOk').addEventListener('click', async () => {
    const btn = $('#dlgOk');
    btn.disabled = true;
    btn.textContent = '보내는 중…';
    dlgErr.hidden = true;
    try {
      const r = await fetch(apiBase() + '/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: picked, time: timeSel.value,
          name: nameEl.value.trim(), email: emailEl.value.trim(),
          purpose: purposeEl.value.trim(), consent: true,
        }),
      });
      const js = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(js.error || js.message || ('접수에 실패했습니다 (' + r.status + ')'));
      dlg.close();
      $('#doneText').textContent = pickedLabel() + ' ' + timeSel.value + ' 로 접수되었습니다. '
        + '확인 후 ' + emailEl.value.trim() + ' 으로 답장 드리겠습니다.';
      doneDlg.showModal();
      $('#bk').reset();
      picked = null; showPicked(); renderCal();
      $('#purposeCount').textContent = '0';
      validate();
    } catch (err) {
      dlgErr.textContent = err.message;
      dlgErr.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = '예약하기';
    }
  });

  $('#doneOk').addEventListener('click', () => doneDlg.close());

  /* 배포에서는 같은 주소의 /api, 로컬 정적 서버에서는 4000번 백엔드 */
  function apiBase() {
    const { hostname, port } = location;
    const local = hostname === 'localhost' || hostname === '127.0.0.1';
    return local && port !== '4000' ? 'http://localhost:4000/api' : '/api';
  }

  /* ---------- 시작 ---------- */
  renderCal();
  showPicked();
  validate();
  $('#yr').textContent = String(new Date().getFullYear());
})();

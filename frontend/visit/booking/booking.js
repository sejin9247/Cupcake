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

  /* 고를 수 있는 시간 — 13:00 ~ 18:00, 30분 단위 */
  const TIMES = [];
  for (let t = 13 * 60; t <= 18 * 60; t += 30) TIMES.push(pad(Math.floor(t / 60)) + ':' + pad(t % 60));

  /* 이미 찬 자리 — 'YYYY-MM-DD HH:MM' 모음. 서버에서 받아 온다.
     못 받아 오면 비워 둔다: 화면에서 막지 못해도 서버가 마지막에 거른다(막아서 아무것도 못 고르게 하는 것보다 낫다). */
  let taken = new Set();
  const isTaken = (date, time) => taken.has(date + ' ' + time);
  const dayFull = date => TIMES.every(t => isTaken(date, t));

  function blocked(d) {
    const day = d.getDay();
    if (day === 0 || day === 6) return '주말';
    if (d < TODAY) return '지난 날짜';
    if (d > LIMIT) return '예약 가능 기간이 아님';
    const h = holidayName(ymd(d));
    if (h) return h;
    if (dayFull(ymd(d))) return '예약이 모두 찼음';
    return null;
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
    showAlert('');          // 새로 고르는 중이므로 지난 안내는 지운다
    renderCal();
    showPicked();
    renderTimes();          // 날짜마다 찬 시간이 다르므로 다시 그린다
    showLeft();
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

  /* ---------- 시간 ----------
     고른 날짜에 따라 다시 그린다. 이미 찬 시간은 목록에 남겨 두되 (완료)를 붙이고 고르지 못하게 한다 —
     아예 지우면 몇 시가 찼는지 알 수 없어서 오히려 답답하다. */
  const timeSel = $('#time');

  function renderTimes() {
    const keep = timeSel.value;
    timeSel.textContent = '';

    const first = document.createElement('option');
    first.value = '';
    first.textContent = picked ? '시간을 선택하세요' : '날짜를 먼저 고르세요';
    timeSel.appendChild(first);

    for (const v of TIMES) {
      const o = document.createElement('option');
      o.value = v;
      const full = picked && isTaken(picked, v);
      o.textContent = full ? v + ' (완료)' : v;
      o.disabled = !!full;
      timeSel.appendChild(o);
    }
    timeSel.disabled = !picked;

    /* 고른 시간이 그 사이 차 버렸으면 선택을 비운다 */
    timeSel.value = keep && (!picked || !isTaken(picked, keep)) ? keep : '';
  }

  /* 양식 위 알림 — 팝업이 닫힌 뒤에도 남아야 하는 안내를 띄운다 */
  function showAlert(text) {
    const a = $('#alert');
    a.textContent = text;
    a.hidden = !text;
  }

  /* 남은 자리 안내 — 날짜를 고르면 몇 자리 남았는지 알려 준다 */
  function showLeft() {
    const note = $('#timeNote');
    if (!picked) { note.textContent = ''; return; }
    const left = TIMES.filter(t => !isTaken(picked, t)).length;
    note.textContent = left ? `이 날은 ${TIMES.length}개 중 ${left}개가 남았습니다.` : '이 날은 남은 시간이 없습니다.';
    note.classList.toggle('none', left === 0);
  }

  /* ---------- 입력 검사 ---------- */
  const nameEl = $('#name'), emailEl = $('#email'), purposeEl = $('#purpose'), consentEl = $('#consent');
  const submitBtn = $('#submitBtn'), need = $('#need');
  const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

  const filled = el => el.value.trim().length > 0;
  const emailOk = () => EMAIL_RE.test(emailEl.value.trim());
  /* 고른 시간이 그 사이 차 버렸을 수도 있다 — 값이 있다고 바로 통과시키지 않는다 */
  const timeOk = () => !!timeSel.value && !isTaken(picked, timeSel.value);

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
    if (!timeOk()) missing.push('시간');
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
  timeSel.addEventListener('change', () => { showAlert(''); validate(); });
  consentEl.addEventListener('change', validate);

  /* 아직 blur 전이라도 버튼 상태는 따라가야 한다 */
  function submitBtnState() {
    const ok = picked && timeOk() && filled(nameEl) && emailOk() && filled(purposeEl) && consentEl.checked;
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

  /* Formspree로 보낸다 — 받는 메일 주소는 Formspree 쪽에 설정돼 있어서 여기에 적지 않는다.
     밑줄로 시작하는 칸은 메일에 표시되지 않는 Formspree 전용 값이다. */
  const FORM_ENDPOINT = 'https://formspree.io/f/meaeooaj';

  /* 우리 서버에 자리를 잡는다 (관리자 화면에 뜨는 기록이기도 하다).
     - 그 시간이 이미 찼거나(409) 입력이 잘못됐으면(400) 여기서 멈춘다. 메일은 보내지 않는다.
     - 서버가 아예 응답하지 않거나 저장소가 없으면 멈추지 않는다. 기록은 못 남겨도
       메일은 가야 방문자의 신청이 사라지지 않는다. */
  async function reserve() {
    let r;
    try {
      r = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          date: picked, time: timeSel.value,
          name: nameEl.value.trim(), email: emailEl.value.trim(),
          purpose: purposeEl.value.trim(), consent: true,
        }),
      });
    } catch (e) {
      console.warn('[예약] 기록 실패 — 메일만 보냅니다:', e.message);
      return;
    }
    if (r.ok) return;

    const js = await r.json().catch(() => ({}));
    const msg = js.error?.message;

    if (r.status === 409) {
      /* 그 사이 누가 가져갔다 — 목록을 새로 읽어 화면을 맞추고, 다시 고르게 한다.
         팝업을 닫으므로 안내는 양식 위 알림 자리에 띄운다 (팝업 안에 쓰면 같이 사라진다) */
      if (await loadTaken()) syncAfterTaken();
      showAlert(msg || '방금 다른 분이 그 시간을 예약했습니다. 다른 시간을 골라 주세요.');
      dlg.close();
      timeSel.focus();
      const e = new Error('slot_taken');
      e.handled = true;
      throw e;
    }
    if (r.status === 400) throw new Error(msg || '입력한 내용을 다시 확인해 주세요.');

    console.warn('[예약] 기록 실패 — 메일만 보냅니다:', r.status, msg ?? '');
  }

  /* Formspree가 돌려주는 오류를 읽을 수 있는 한 문장으로 */
  function errorText(js, status) {
    if (Array.isArray(js.errors) && js.errors.length) {
      return js.errors.map(e => (e.field ? e.field + ': ' : '') + (e.message || '')).join(' · ');
    }
    if (js.error) return js.error;
    return '접수에 실패했습니다 (' + status + '). 잠시 뒤 다시 시도해 주세요.';
  }

  $('#dlgOk').addEventListener('click', async () => {
    const btn = $('#dlgOk');
    btn.disabled = true;
    btn.textContent = '보내는 중…';
    dlgErr.hidden = true;
    try {
      /* 자리부터 잡는다. 메일을 먼저 보내면, 그 사이 찬 자리였을 때
         방문자는 접수됐다는 메일을 보내 놓고 화면에서는 거절당하는 꼴이 된다. */
      await reserve();

      const send = () => fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          '방문 날짜': pickedLabel(),
          '희망 시간': timeSel.value,
          '이름': nameEl.value.trim(),
          'email': emailEl.value.trim(),          // Formspree가 답장 주소로 쓴다
          '방문 목적': purposeEl.value.trim(),
          '정보 전달 동의': '동의함',
          '접수 시각': stamp(),
          _subject: '[방문 예약] ' + pickedLabel() + ' ' + timeSel.value + ' · ' + nameEl.value.trim(),
          _gotcha: $('#catcher').value,           // 사람이면 비어 있다 — 채워져 있으면 Formspree가 조용히 버린다
        }),
      });

      /* 못 보낸 것과 거절당한 것은 다른 일이라 메시지를 나눈다 */
      let r;
      try {
        r = await send();
      } catch {
        throw new Error('보내지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.');
      }
      const js = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(errorText(js, r.status));

      dlg.close();
      $('#doneText').textContent = pickedLabel() + ' ' + timeSel.value + ' 로 접수되었습니다. '
        + '확인 후 ' + emailEl.value.trim() + ' 으로 답장 드리겠습니다.';
      doneDlg.showModal();
      $('#bk').reset();
      picked = null; showPicked(); renderCal();
      $('#purposeCount').textContent = '0';
      validate();
    } catch (err) {
      if (!err.handled) {          // 이미 양식 위에 알린 경우에는 팝업에 또 쓰지 않는다
        dlgErr.textContent = err.message;
        dlgErr.hidden = false;
      }
    } finally {
      btn.disabled = false;
      btn.textContent = '예약하기';
    }
  });

  $('#doneOk').addEventListener('click', () => doneDlg.close());

  /* 접수 시각 — 보는 사람이 한국에 있으므로 한국 시간으로 적는다 */
  function stamp() {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: KST, dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date()) + ' (KST)';
  }

  /* ---------- 찬 자리 읽기 ----------
     실패하면 아무것도 막지 않는다. 서버가 접수 때 다시 거르므로 겹쳐 들어가지는 않는다. */
  async function loadTaken() {
    try {
      const r = await fetch('/api/bookings/taken', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const js = await r.json();
      taken = new Set((js.taken ?? []).map(s => s.date + ' ' + s.time));
      return true;
    } catch (e) {
      console.warn('[예약] 찬 자리를 읽지 못했습니다:', e.message);
      return false;
    }
  }

  /* 새로 읽은 뒤 화면을 맞춘다. 고른 날짜가 꽉 찼으면 선택을 풀어 준다. */
  function syncAfterTaken() {
    if (picked && dayFull(picked)) picked = null;
    renderCal();
    showPicked();
    renderTimes();
    showLeft();
    validate();
  }

  /* ---------- 시작 ---------- */
  renderCal();
  showPicked();
  renderTimes();
  validate();
  $('#yr').textContent = String(new Date().getFullYear());
  loadTaken().then(ok => { if (ok) syncAfterTaken(); });
})();

/* 메일 발송 — 방문 예약이 들어오면 운영자에게 알린다.
   Resend의 REST API를 fetch로 직접 부른다(의존성 없음).
   키가 없으면 보내지 않고 조용히 false를 돌려준다 — 예약 자체는 막지 않는다. */
import { config } from '../config/index.js';

const esc = s => String(s)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
/* '2026-10-08' → '2026년 10월 8일 (목)' */
function dateLabel(date) {
  const [y, m, d] = date.split('-').map(Number);
  const dow = DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}년 ${m}월 ${d}일 (${dow})`;
}

const kst = iso => new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(iso));

/* 본문 — 글자판과 화면판을 같은 내용으로 만든다 */
function body(b) {
  const rows = [
    ['방문 날짜', `${dateLabel(b.date)} ${b.time}`],
    ['이름', b.name],
    ['이메일', b.email],
    ['방문 목적', b.purpose],
    ['접수 시각', kst(b.createdAt)],
    ['예약 번호', b.id],
  ];

  const text = rows.map(([k, v]) => `${k}\n${v}`).join('\n\n')
    + `\n\n— 이 메일에 그대로 답장하면 ${b.email} 으로 갑니다.`;

  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;color:#11141a">
  <p style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#6b6f76;margin:0 0 6px">New booking</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 20px">${esc(dateLabel(b.date))} ${esc(b.time)}</h1>
  <table style="border-collapse:collapse;width:100%;font-size:14px">
    ${rows.map(([k, v]) => `<tr>
      <th style="text-align:left;vertical-align:top;width:92px;padding:10px 12px 10px 0;border-top:1px solid #e3e0dc;font-weight:500;color:#6b6f76">${esc(k)}</th>
      <td style="padding:10px 0;border-top:1px solid #e3e0dc;white-space:pre-wrap">${esc(v)}</td>
    </tr>`).join('')}
  </table>
  <p style="margin:22px 0 0;font-size:13px;color:#6b6f76">이 메일에 그대로 답장하면 ${esc(b.email)} 으로 갑니다.</p>
</div>`;

  return { text, html };
}

/* 예약 알림 보내기 → { sent: boolean, error?: string }
   실패를 던지지 않는다. 메일이 안 가는 것보다 예약을 잃는 게 더 나쁘다. */
export async function sendBookingMail(b) {
  const { resendKey, from, to } = config.mail;
  if (!resendKey || !to) return { sent: false, error: '메일 설정 없음' };

  const { text, html } = body(b);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [to],
        reply_to: [b.email],          // 받은 메일에 답장하면 방문자에게 간다
        subject: `[방문 예약] ${dateLabel(b.date)} ${b.time} · ${b.name}`,
        text, html,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const js = await r.json().catch(() => ({}));
    if (!r.ok) return { sent: false, error: js.message || `Resend ${r.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e.message };
  }
}

/* DB에 넣은 프로필이 /profile/ 페이지에 적힌 것과 같은지 대조한다.
   실행: node --env-file-if-exists=.env scripts/verify-profile.mjs

   페이지 HTML에서 값을 직접 긁어와 비교한다. 내가 옮기면서 글자를 빠뜨렸는지 보려는 것이다. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL_ || !KEY) { console.error('.env 에 SUPABASE_* 가 필요합니다.'); process.exit(1); }
const api = URL_.replace(/\/+$/, '') + '/rest/v1';
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const get = async p => (await fetch(`${api}/${p}`, { headers })).json();

const src = fileURLToPath(new URL('../../frontend/profile/index.html', import.meta.url));
const html = await readFile(src, 'utf8');

/* 태그를 벗기고 공백을 하나로 모은다 — HTML 줄바꿈·들여쓰기 때문에 글자는 같아도 달라 보인다 */
const plain = s => s
  .replace(/<small>/g, ' §')              // <small>은 따로 떼어 볼 수 있게 표시를 남긴다
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const problems = [];
const check = (label, inPage, inDb) => {
  const a = plain(String(inPage ?? ''));
  const b = plain(String(inDb ?? ''));
  if (a !== b) problems.push(`${label}\n     페이지: ${a}\n     DB    : ${b}`);
};

/* ── 페이지에서 긁기 ── */
const pick = re => (html.match(re)?.[1] ?? '').trim();

const pageSub = pick(/<p class="sub">([\s\S]*?)<\/p>/);
const pageMail = pick(/href="mailto:([^"]+)"/);
const pageLoc = pick(/<dt>Location<\/dt><dd>([\s\S]*?)<\/dd>/);
const pageAffil = pick(/<dt>Affiliation<\/dt><dd>([\s\S]*?)<\/dd>/);

/* 이력 줄: <span class="when">…</span><span class="what">…<small>…</small></span> */
const rows = [...html.matchAll(
  /<span class="when">([\s\S]*?)<\/span>\s*<span class="what">([\s\S]*?)<\/span>/g,
)].map(m => ({ when: plain(m[1]), what: plain(m[2]) }));

/* 자격증 카드: <p class="n">이름</p><span class="k">종류</span> */
const cards = [...html.matchAll(
  /<p class="n">([\s\S]*?)<\/p>\s*<span class="k">([\s\S]*?)<\/span>/g,
)].map(m => ({ name: plain(m[1]), kind: plain(m[2]) }));

/* ── DB에서 읽기 ── */
const [p] = await get('profile?select=*');
const entries = await get('profile_entries?select=*&order=kind.asc,sort_order.asc');
const byKind = k => entries.filter(e => e.kind === k);

if (!p) { console.error('profile 표가 비어 있습니다.'); process.exit(1); }

/* ── 대조 ── */
check('한 줄 소개(tagline)', pageSub, p.tagline);
check('이메일', pageMail, p.public_email);
check('거주지', pageLoc, p.location);
check('소속', pageAffil, `${p.school} ${p.department}`);

const edu = byKind('education')[0];
const mil = byKind('military')[0];
const exp = byKind('experience')[0];
const creds = byKind('credential');

const row = (i) => rows[i] ?? { when: '(없음)', what: '(없음)' };
/* 페이지 순서: 학력 → 군복무 → 경험 */
check('학력 기간', row(0).when, edu?.period);
/* 페이지는 '상명대학교 그린스마트시티학과' 한 덩어리, DB는 기관(org)과 학과(title)로 나눠 담는다 */
check('학력 내용', row(0).what, `${edu?.org} ${edu?.title} §${edu?.description}`);
check('군복무 기간', row(1).when, mil?.period);
check('군복무 내용', row(1).what, `${mil?.title} §${mil?.description}`);
check('경험 기간', row(2).when, exp?.period);
check('경험 내용', row(2).what, `${exp?.org} · ${exp?.title} §${exp?.description}`);

if (cards.length !== creds.length) {
  problems.push(`자격증 개수: 페이지 ${cards.length}개 ≠ DB ${creds.length}개`);
} else {
  cards.forEach((c, i) => {
    check(`자격증 ${i + 1} 이름`, c.name, creds[i].title);
    check(`자격증 ${i + 1} 종류`, c.kind, creds[i].description);
  });
}

/* 소개 문단이 페이지 본문에 다 들어 있는지 */
for (const [i, para] of String(p.intro ?? '').split('\n\n').entries()) {
  if (!plain(html).includes(plain(para))) {
    problems.push(`소개 ${i + 1}번째 문단이 페이지에 없습니다:\n     ${plain(para).slice(0, 60)}…`);
  }
}

/* 공개 여부 */
const hidden = entries.filter(e => !e.is_public);
if (hidden.length) problems.push(`비공개로 들어간 이력: ${hidden.map(e => e.title).join(', ')}`);
if (!p.is_public) problems.push('소개가 비공개입니다');

if (problems.length) {
  console.log(`다른 곳 ${problems.length}개:\n`);
  problems.forEach(x => console.log('  - ' + x + '\n'));
  process.exit(1);
}
console.log('페이지에 적힌 것과 DB가 같습니다. ✔');
console.log(`  소개 1줄 · 이력 ${entries.length}건 (학력 ${byKind('education').length} · 군복무 ${byKind('military').length} · 자격 ${creds.length} · 경험 ${byKind('experience').length})`);

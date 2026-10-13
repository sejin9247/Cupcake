/* DB에 넣은 작업물이 index.html 패널에 적힌 것과 같은지 대조한다.
   실행: node --env-file-if-exists=.env scripts/verify-projects.mjs

   패널 HTML에서 눈썹글·설명·항목표를 직접 긁어와 비교한다.
   내가 옮겨 적으면서 글자를 빠뜨렸는지 보려는 것이다. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL_ || !KEY) { console.error('.env 에 SUPABASE_* 가 필요합니다.'); process.exit(1); }
const api = URL_.replace(/\/+$/, '') + '/rest/v1';
const get = async p => {
  const r = await fetch(`${api}/${p}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!r.ok) { console.error(await r.text()); process.exit(1); }
  return r.json();
};

const src = fileURLToPath(new URL('../../frontend/index.html', import.meta.url));
const html = await readFile(src, 'utf8');

const plain = s => s
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&middot;/g, '·').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const problems = [];
const check = (label, page, db) => {
  const a = plain(String(page ?? ''));
  const b = plain(String(db ?? ''));
  if (a !== b) problems.push(`${label}\n     페이지: ${a}\n     DB    : ${b}`);
};

/* 패널 하나하나를 data-proj 로 떼어 낸다 */
const panels = new Map();
for (const m of html.matchAll(/<article class="panel[^"]*"\s+data-proj="([^"]+)"[\s\S]*?<\/article>/g)) {
  panels.set(m[1], m[0]);
}

const rows = await get('projects?select=*,project_facts(label,value,sort_order)&order=sort_order.asc');
if (!rows.length) { console.error('projects 표가 비어 있습니다.'); process.exit(1); }

for (const p of rows) {
  const panel = panels.get(p.slug);
  if (!panel) { problems.push(`${p.slug}: index.html 에 그 패널이 없습니다`); continue; }

  /* 눈썹글 — pv-eyebrow 또는 pv-script */
  const eyebrow = (panel.match(/<p class="pv-(?:eyebrow|script)">([\s\S]*?)<\/p>/) ?? [])[1];
  check(`${p.slug} 눈썹글`, eyebrow, p.eyebrow);

  /* 설명 문단 */
  const desc = (panel.match(/<p class="desc">([\s\S]*?)<\/p>/) ?? [])[1];
  check(`${p.slug} 설명`, desc, p.summary);

  /* 항목표 — 그림(pv-art) 안에도 dt/dd 짝이 있으므로 <dl class="meta"> 안으로 범위를 좁힌다 */
  const metaBlock = (panel.match(/<dl class="meta">([\s\S]*?)<\/dl>/) ?? [])[1] ?? '';
  const facts = [...metaBlock.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)]
    .map(m => [plain(m[1]), plain(m[2])]);
  const dbFacts = [...(p.project_facts ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(f => [f.label, f.value]);

  if (facts.length !== dbFacts.length) {
    problems.push(`${p.slug} 항목 개수: 페이지 ${facts.length}개 ≠ DB ${dbFacts.length}개`);
  } else {
    facts.forEach(([l, v], i) => {
      check(`${p.slug} 항목 ${i + 1} 이름`, l, dbFacts[i][0]);
      check(`${p.slug} 항목 ${i + 1} 값`, v, dbFacts[i][1]);
    });
  }

  /* 데모 링크 — 패널의 pv-cta href */
  const cta = (panel.match(/<a class="pv-cta"[^>]*href="([^"]+)"/) ?? [])[1];
  check(`${p.slug} 데모 링크`, cta, p.demo_url);

  if (!p.is_public) problems.push(`${p.slug}: 비공개로 들어갔습니다`);
}

/* 페이지에 있는데 DB에 없는 패널 */
for (const slug of panels.keys()) {
  if (!rows.some(p => p.slug === slug)) problems.push(`${slug}: 페이지에는 있는데 DB에 없습니다`);
}

if (problems.length) {
  console.log(`다른 곳 ${problems.length}개:\n`);
  problems.forEach(x => console.log('  - ' + x + '\n'));
  process.exit(1);
}
console.log('패널에 적힌 것과 DB가 같습니다. ✔');
console.log(`  작업물 ${rows.length}개 · 항목 ${rows.reduce((n, p) => n + (p.project_facts?.length ?? 0), 0)}개`);

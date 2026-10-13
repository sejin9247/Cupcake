/* 전국 도시계획 조례를 Supabase로 옮긴다.
   실행:  node --env-file-if-exists=.env scripts/load-ordinance.mjs <조례폴더> [--publish]

   읽는 것
     <조례폴더>/ordinance/*.json   시군구별 조례 (165개)
     <조례폴더>/legal-cap.json     국토계획법 시행령이 정한 전국 상한

   넣는 곳
     zones(21) → regions(165) → ordinance_values(6,930) → legal_caps(42)
     앞의 것이 없으면 뒤의 것이 들어가지 않으므로 이 순서를 지킨다.

   같은 자리를 다시 넣으면 덮어쓴다(upsert). 여러 번 돌려도 줄이 늘지 않는다.
   --publish 를 주면 is_public 을 true 로 넣는다. 기본은 false(올려두고 눈으로 확인한 뒤 공개). */
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const dir = process.argv[2];
const publish = process.argv.includes('--publish');
if (!dir) {
  console.error('조례 폴더를 알려주세요.\n예: node scripts/load-ordinance.mjs "../새 폴더/cupcake_groundused/data"');
  process.exit(1);
}

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL_ || !KEY) {
  console.error('backend/.env 에 SUPABASE_URL 과 SUPABASE_SECRET_KEY 가 있어야 합니다.');
  process.exit(1);
}
const api = URL_.replace(/\/+$/, '') + '/rest/v1';

/* 'YYYYMMDD' 또는 'YYYY-MM-DD' → 'YYYY-MM-DD' (없으면 null) */
function toDate(v) {
  const s = String(v ?? '').trim();
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

async function send(path, rows, { onConflict, label }) {
  if (!rows.length) return [];
  const out = [];
  const SIZE = 500;                       // 한 번에 너무 많이 보내면 요청이 거절된다
  for (let i = 0; i < rows.length; i += SIZE) {
    const chunk = rows.slice(i, i + SIZE);
    const r = await fetch(`${api}/${path}${onConflict ? `?on_conflict=${onConflict}` : ''}`, {
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        Prefer: `resolution=merge-duplicates,return=${onConflict ? 'representation' : 'representation'}`,
      },
      body: JSON.stringify(chunk),
    });
    if (!r.ok) {
      console.error(`\n${label} 실패 (${r.status}):`, (await r.text()).slice(0, 600));
      process.exit(1);
    }
    out.push(...(await r.json()));
    process.stdout.write(`\r  ${label}: ${Math.min(i + SIZE, rows.length)}/${rows.length}`);
  }
  process.stdout.write('\n');
  return out;
}

/* ---------- 1. 파일 읽기 ---------- */
const base = resolve(dir);
const ordDir = join(base, 'ordinance');
const files = (await readdir(ordDir)).filter(f => f.endsWith('.json')).sort();
const docs = [];
for (const f of files) docs.push(JSON.parse(await readFile(join(ordDir, f), 'utf8')));
console.log(`조례 ${docs.length}건을 읽었습니다.`);

/* 21종은 전국 공통이다 — 전부 같은지 확인한 뒤 첫 번째 것을 기준으로 쓴다 */
const zoneNames = docs[0].zones;
const odd = docs.filter(d => JSON.stringify(d.zones) !== JSON.stringify(zoneNames));
if (odd.length) {
  console.error(`용도지역 목록이 다른 지역이 있습니다: ${odd.map(d => d.owner).join(', ')}`);
  process.exit(1);
}

/* ---------- 2. zones ---------- */
await send('zones', zoneNames.map((name, i) => ({
  id: i + 1, name, sort_order: i + 1, is_public: publish,
})), { onConflict: 'id', label: '용도지역' });

/* ---------- 3. regions ---------- */
const regionRows = await send('regions', docs.map(d => ({
  name: d.owner,
  law_name: d.law,
  law_mst: d.mst ? String(d.mst) : null,
  effective_on: toDate(d.effective),
  fetched_on: toDate(d.fetched),
  source: d.source ?? null,
  is_public: publish,
})), { onConflict: 'name', label: '지역' });

const regionId = new Map(regionRows.map(r => [r.name, r.id]));

/* ---------- 4. ordinance_values ---------- */
const values = [];
let blanks = 0, notes = 0;
for (const d of docs) {
  const rid = regionId.get(d.owner);
  for (const [metric, block] of [['bcr', d.bcr], ['far', d.far]]) {
    block.values.forEach((cell, i) => {
      if (cell == null) blanks++;
      if (cell?.note) notes++;
      values.push({
        region_id: rid,
        zone_id: i + 1,
        metric,
        /* 조례에 그 용도지역이 없는 칸은 비워 둔다 — 0으로 적으면 '0퍼센트'라는 거짓이 된다 */
        value: cell?.v ?? null,
        unit: cell?.unit ?? null,
        article: cell?.article ?? block.article ?? null,
        note: cell?.note ?? null,
        is_public: publish,
      });
    });
  }
}
await send('ordinance_values', values, { onConflict: 'region_id,zone_id,metric', label: '조례값' });

/* ---------- 5. legal_caps ---------- */
let caps = 0;
try {
  const cap = JSON.parse(await readFile(join(base, 'legal-cap.json'), 'utf8'));
  const rows = [];
  cap.zones.forEach((name, i) => {
    const z = zoneNames.indexOf(name);
    if (z < 0) return;                     // 기준 목록에 없는 이름은 건너뛴다
    for (const [metric, arr] of [['bcr', cap.bcr], ['far', cap.far]]) {
      const v = Array.isArray(arr) ? arr[i] : null;
      if (v == null) continue;
      rows.push({
        zone_id: z + 1, metric, value: v, unit: '퍼센트 이하',
        article: null, source: cap.source ?? null,
        effective_on: toDate(cap.effective), is_public: publish,
      });
    }
  });
  await send('legal_caps', rows, { onConflict: 'zone_id,metric', label: '법정 상한' });
  caps = rows.length;
} catch (e) {
  console.log(`법정 상한은 건너뜁니다 (${e.message})`);
}

console.log(`
끝났습니다.
  용도지역   ${zoneNames.length}
  지역       ${regionRows.length}
  조례값     ${values.length}  (빈 칸 ${blanks} · 단서 ${notes})
  법정 상한  ${caps}
  공개 여부  is_public = ${publish}`);

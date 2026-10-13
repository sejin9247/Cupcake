/* 옮긴 조례가 원본 JSON과 한 칸도 틀리지 않는지 대조한다.
   실행: node --env-file-if-exists=.env scripts/verify-ordinance.mjs <조례폴더>

   개수가 맞는 것과 내용이 맞는 것은 다른 일이다. 여기서는 6,930칸을 하나씩 맞춰 본다. */
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const dir = process.argv[2];
const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!dir || !URL_ || !KEY) {
  console.error('사용법: node scripts/verify-ordinance.mjs <조례폴더>   (.env 에 SUPABASE_* 필요)');
  process.exit(1);
}
const api = URL_.replace(/\/+$/, '') + '/rest/v1';
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function getAll(path) {
  const out = [];
  const SIZE = 1000;
  for (let from = 0; ; from += SIZE) {
    const r = await fetch(`${api}/${path}`, {
      headers: { ...headers, Range: `${from}-${from + SIZE - 1}`, Prefer: 'count=exact' },
    });
    if (!r.ok) { console.error(await r.text()); process.exit(1); }
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < SIZE) break;
  }
  return out;
}

/* ---------- DB에서 받아오기 ---------- */
const zones = await getAll('zones?select=id,name,sort_order');
const regions = await getAll('regions?select=id,name,law_name,law_mst,effective_on');
const values = await getAll('ordinance_values?select=region_id,zone_id,metric,value,unit,article,note');
console.log(`DB에서 읽음 — 용도지역 ${zones.length} · 지역 ${regions.length} · 조례값 ${values.length}`);

const zoneById = new Map(zones.map(z => [z.id, z.name]));
const regionById = new Map(regions.map(r => [r.id, r.name]));
const regionByName = new Map(regions.map(r => [r.name, r]));
const cell = new Map();                      // '지역|순서|지표' → 줄
for (const v of values) cell.set(`${regionById.get(v.region_id)}|${v.zone_id}|${v.metric}`, v);

/* ---------- 원본과 맞춰 보기 ---------- */
const base = resolve(dir);
const files = (await readdir(join(base, 'ordinance'))).filter(f => f.endsWith('.json')).sort();
const problems = [];
const same = (a, b) => (a ?? null) === (b ?? null);
let checked = 0;

for (const f of files) {
  const d = JSON.parse(await readFile(join(base, 'ordinance', f), 'utf8'));
  const r = regionByName.get(d.owner);
  if (!r) { problems.push(`${d.owner}: 지역이 DB에 없음`); continue; }
  if (r.law_name !== d.law) problems.push(`${d.owner}: 조례명 다름 (${r.law_name} ≠ ${d.law})`);
  if (String(r.law_mst ?? '') !== String(d.mst ?? '')) problems.push(`${d.owner}: 법령ID 다름`);

  for (const [metric, block] of [['bcr', d.bcr], ['far', d.far]]) {
    block.values.forEach((src, i) => {
      checked++;
      const got = cell.get(`${d.owner}|${i + 1}|${metric}`);
      if (!got) { problems.push(`${d.owner} ${metric} ${zoneById.get(i + 1)}: DB에 칸이 없음`); return; }

      const wantValue = src?.v ?? null;
      const gotValue = got.value == null ? null : Number(got.value);
      if (!same(wantValue, gotValue)) {
        problems.push(`${d.owner} ${metric} ${zoneById.get(i + 1)}: 값 ${wantValue} → ${gotValue}`);
      }
      if (!same(src?.unit ?? null, got.unit)) {
        problems.push(`${d.owner} ${metric} ${zoneById.get(i + 1)}: 단위 다름`);
      }
      if (!same(src?.note ?? null, got.note)) {
        problems.push(`${d.owner} ${metric} ${zoneById.get(i + 1)}: 단서 다름`);
      }
      const wantArticle = src?.article ?? block.article ?? null;
      if (!same(wantArticle, got.article)) {
        problems.push(`${d.owner} ${metric} ${zoneById.get(i + 1)}: 조문 다름`);
      }
    });
  }
}

console.log(`맞춰 본 칸: ${checked}`);
if (problems.length) {
  console.log(`\n틀린 곳 ${problems.length}개 (앞의 20개):`);
  problems.slice(0, 20).forEach(p => console.log('  -', p));
  process.exit(1);
}
console.log('\n원본과 한 칸도 다르지 않습니다. ✔');

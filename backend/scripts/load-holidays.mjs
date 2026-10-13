/* 공휴일을 holidays.js에서 읽어 Supabase로 옮긴다.
   실행: node --env-file-if-exists=.env scripts/load-holidays.mjs [--draft]

   지금은 예약 페이지에 파일로 박혀 있어서, 2028년이 되면 코드를 고쳐 다시 배포해야 한다.
   표로 옮기면 줄만 더하면 된다.

   기본은 is_public = true 로 넣는다. 공휴일은 가려 둘 이유가 없고,
   비공개로 두면 예약 페이지에서 그 날이 막히지 않는다. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const publish = !process.argv.includes('--draft');
const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL_ || !KEY) {
  console.error('backend/.env 에 SUPABASE_URL 과 SUPABASE_SECRET_KEY 가 있어야 합니다.');
  process.exit(1);
}

/* holidays.js는 브라우저용이라 window에 담는다 — 가짜 window를 주고 읽어 온다 */
const src = fileURLToPath(new URL('../../frontend/visit/booking/holidays.js', import.meta.url));
const code = await readFile(src, 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const byYear = sandbox.window.HOLIDAYS;
if (!byYear || typeof byYear !== 'object') {
  console.error('holidays.js에서 HOLIDAYS를 찾지 못했습니다.');
  process.exit(1);
}

const rows = [];
for (const [year, days] of Object.entries(byYear)) {
  for (const [on_date, name] of Object.entries(days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(on_date)) {
      console.error(`날짜 모양이 이상합니다: ${on_date}`);
      process.exit(1);
    }
    if (!on_date.startsWith(year)) {
      console.error(`${year}년 칸에 ${on_date}가 들어 있습니다.`);
      process.exit(1);
    }
    rows.push({ on_date, name, is_public: publish });
  }
}
rows.sort((a, b) => a.on_date.localeCompare(b.on_date));

const r = await fetch(`${URL_.replace(/\/+$/, '')}/rest/v1/holidays?on_conflict=on_date`, {
  method: 'POST',
  headers: {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=representation',
  },
  body: JSON.stringify(rows),
});
if (!r.ok) {
  console.error(`실패 (${r.status}):`, (await r.text()).slice(0, 400));
  process.exit(1);
}
const saved = await r.json();

const years = [...new Set(rows.map(x => x.on_date.slice(0, 4)))].sort();
console.log(`공휴일 ${saved.length}일을 옮겼습니다. (${years.join(', ')}년 · 공개 ${publish})`);
for (const y of years) {
  console.log(`  ${y}: ${rows.filter(x => x.on_date.startsWith(y)).length}일`);
}

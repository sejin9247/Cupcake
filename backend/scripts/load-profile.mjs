/* /profile/ 페이지에 적혀 있는 내용을 Supabase로 옮긴다.
   실행: node --env-file-if-exists=.env scripts/load-profile.mjs [--draft]

   내용은 frontend/profile/index.html 에 손으로 적혀 있던 것을 그대로 옮긴 것이다.
   지어낸 값은 없고, 페이지에 없는 칸은 비워 둔다.

   기본은 is_public = true — 이미 /profile/ 페이지에서 보이는 항목들이기 때문이다.
   --draft 를 주면 비공개로 넣는다. */
const publish = !process.argv.includes('--draft');
const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL_ || !KEY) {
  console.error('backend/.env 에 SUPABASE_URL 과 SUPABASE_SECRET_KEY 가 있어야 합니다.');
  process.exit(1);
}
const api = URL_.replace(/\/+$/, '') + '/rest/v1';
const headers = {
  apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json',
};

async function send(path, body, prefer = 'return=representation') {
  const r = await fetch(`${api}/${path}`, {
    method: 'POST', headers: { ...headers, Prefer: prefer }, body: JSON.stringify(body),
  });
  if (!r.ok) { console.error(`실패 (${r.status}):`, (await r.text()).slice(0, 400)); process.exit(1); }
  return r.json();
}

/* ───────── 소개 (한 줄만 존재) ───────── */
const PROFILE = {
  full_name: '전세진',
  /* 페이지 히어로에 적힌 한 줄 */
  tagline: '도시 공간을 공부하고, 사람이 머무는 장소를 고민합니다.',
  school: '상명대학교',
  department: '그린스마트시티학과',
  grade: '3학년 재학 중',
  expected_graduation: '2028.03',
  location: '인천광역시 동구',
  public_email: 'jsejin030530@naver.com',
  /* 페이지 Profile 구역의 두 문단 */
  intro: [
    '상명대학교 그린스마트시티학과에서 도시 공간을 공부하고 있습니다. '
      + '인천에서 자랐고, 공군 복무와 조경 현장 인턴을 거쳐 지금의 전공으로 돌아왔습니다.',
    '도면 위의 선이 실제로 머무는 장소가 되기까지, 그 사이를 잇는 일에 관심이 있습니다.',
    '좋은 장소는 오래 머물고 싶어지는 곳이라고 생각합니다. 그런 곳이 어떻게 만들어지는지 배우는 중입니다.',
  ].join('\n\n'),
  is_public: publish,
};

/* ───────── 이력 ─────────
   period 는 페이지에 적힌 글 그대로. started_on·ended_on 은 월까지만 아는 경우 1일로 둔다. */
const ENTRIES = [
  {
    kind: 'education', title: '그린스마트시티학과', org: '상명대학교',
    period: '2028.03 졸업예정', description: '3학년 재학 중',
    started_on: null, ended_on: null, sort_order: 1,
  },
  {
    kind: 'military', title: '대한민국 공군', org: null,
    period: '2023.08 – 2025.05', description: '약 1년 9개월 · 만기 전역',
    started_on: '2023-08-01', ended_on: '2025-05-01', sort_order: 1,
  },
  {
    kind: 'credential', title: '컴퓨터활용능력 2급', org: null,
    period: null, description: 'Certificate', started_on: null, ended_on: null, sort_order: 1,
  },
  {
    kind: 'credential', title: 'ATC 캐드마스터', org: null,
    period: null, description: 'Certificate', started_on: null, ended_on: null, sort_order: 2,
  },
  {
    kind: 'credential', title: '운전면허 1종 보통', org: null,
    period: null, description: 'License', started_on: null, ended_on: null, sort_order: 3,
  },
  {
    kind: 'experience', title: '인턴', org: '(주)장원조경',
    period: '1개월', description: '조경 실무',
    started_on: null, ended_on: null, sort_order: 1,
  },
].map(e => ({ ...e, is_public: publish }));

/* ───────── 넣기 ───────── */

/* profile 은 한 줄만 있어야 하므로, 있으면 고치고 없으면 넣는다 */
const existing = await (await fetch(`${api}/profile?select=id&limit=1`, { headers })).json();
if (existing.length) {
  const r = await fetch(`${api}/profile?id=eq.${existing[0].id}`, {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(PROFILE),
  });
  if (!r.ok) { console.error(await r.text()); process.exit(1); }
  console.log('소개: 기존 줄을 고쳤습니다.');
} else {
  await send('profile', PROFILE);
  console.log('소개: 새로 넣었습니다.');
}

/* 이력은 같은 것을 두 번 넣지 않도록, 옮기는 항목과 같은 kind+title 은 먼저 지운다 */
for (const e of ENTRIES) {
  await fetch(`${api}/profile_entries?kind=eq.${e.kind}&title=eq.${encodeURIComponent(e.title)}`, {
    method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' },
  });
}
const saved = await send('profile_entries', ENTRIES);

const byKind = {};
for (const e of saved) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;

console.log(`이력 ${saved.length}건을 넣었습니다. (공개 ${publish})`);
for (const [k, n] of Object.entries(byKind)) console.log(`  ${k}: ${n}건`);

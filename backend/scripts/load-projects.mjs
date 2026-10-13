/* 허브(index.html)의 작업물 패널 4개를 Supabase로 옮긴다.
   실행: node --env-file-if-exists=.env scripts/load-projects.mjs [--draft]

   옮기는 것: 눈썹글 · 설명 문단 · 항목표(Year/Role/Stack/Data…) · 링크
   옮기지 않는 것: 큰 제목(줄바꿈·꾸밈이 들어간 디자인), 그림, 상세 구역

   내용은 frontend/index.html 에 적혀 있던 것을 그대로 옮긴 것이다. 지어낸 값은 없다.
   verify-projects.mjs 가 페이지와 대조한다.

   기본은 is_public = true — 이미 사이트에 보이는 것들이기 때문이다. */
const publish = !process.argv.includes('--draft');
const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL_ || !KEY) {
  console.error('backend/.env 에 SUPABASE_URL 과 SUPABASE_SECRET_KEY 가 있어야 합니다.');
  process.exit(1);
}
const api = URL_.replace(/\/+$/, '') + '/rest/v1';
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const call = async (path, init) => {
  const r = await fetch(api + path, { ...init, headers: { ...headers, ...init?.headers } });
  if (!r.ok) { console.error(`실패 (${r.status}) ${path}:`, (await r.text()).slice(0, 400)); process.exit(1); }
  const t = await r.text();
  return t ? JSON.parse(t) : null;
};

/* slug 는 패널의 data-proj 값과 같게 둔다 — 화면이 이 값으로 패널을 찾는다 */
const PANELS = [
  {
    slug: 'cbd',
    title: 'CBD Finder',
    eyebrow: 'Project 01 · 아파트 밀도로 읽는 도시의 중심',
    summary: '아파트 밀도로 도시의 중심을 찾습니다. 지역을 지정하면 아파트가 지역 평균보다 두드러지게 모인 권역을 CBD로 선정하고, 지도와 차트로 보여 주는 공간분석 대시보드.',
    role: '기획 · 설계 · 개발 단독',
    period: '2026',
    demo_url: 'cbd-dashboard/index.html',
    repo_url: 'https://github.com/sejin9247/Cupcake/tree/main/frontend/cbd-dashboard',
    sort_order: 1,
    facts: [
      ['Year', '2026'],
      ['Role', '기획 · 설계 · 개발 단독'],
      ['Stack', 'JavaScript · Leaflet · Turf.js'],
      ['Data', 'OSM · Overpass · SGIS'],
    ],
  },
  {
    slug: 'dongtan',
    title: '도시계획 조례',
    eyebrow: 'Project 02 · 스마트도시계획 · 팀 LUOGO',
    summary: '조례가 땅에 허락하는 밀도를 한 화면에. 전국 시·군·구를 검색해 그 지역 도시계획 조례의 용도지역 21종 건폐율·용적률을 조문 출처와 함께 표와 지도로 보여 줍니다.',
    role: 'LUOGO · 캡스톤디자인',
    period: '2026',
    demo_url: 'https://cupcakegroundused.vercel.app',
    repo_url: null,
    sort_order: 2,
    facts: [
      ['Year', '2026'],
      ['Team', 'LUOGO · 캡스톤디자인'],
      ['Stack', 'HTML · SVG · 법령 API'],
      ['Data', '전국 시·군·구 조례 · 브이월드'],
    ],
  },
  {
    slug: 'evidence',
    title: '근거노트 대시보드',
    eyebrow: 'Project 03 · 스마트도시계획 · 팀 LUOGO',
    summary: '조례에서 읽어 낸 값을 출처·조회일과 함께 쌓아 두고, 지역끼리 나란히 견주는 자료판. 용적률·건폐율·시행일을 지역별로 기록하고 상한보다 낮게 정한 항목을 가려냅니다.',
    role: 'LUOGO · 캡스톤디자인',
    period: '2026',
    demo_url: 'https://caupcake-supabase.vercel.app',
    repo_url: null,
    sort_order: 3,
    facts: [
      ['Year', '2026'],
      ['Team', 'LUOGO · 캡스톤디자인'],
      ['Stack', 'Supabase · Vanilla JS'],
      ['Data', '지자체 도시계획 조례'],
      ['Note', '한 · 영 전환 · 다크 모드'],
    ],
  },
  {
    slug: 'profile',
    title: 'A city is read one block at a time.',
    eyebrow: 'Urban X Data X Space',
    summary: '이력을 한 권의 편집물처럼 엮은 프로필 페이지. 학력·복무·자격·현장 경험을 크림색 지면과 세로 괘선 위에 정리했습니다.',
    role: null,
    period: null,
    demo_url: 'profile/',
    repo_url: null,
    sort_order: 4,
    facts: [
      ['Name', '전세진 · Jeon Se Jin'],
      ['Study', '그린스마트시티학과'],
      ['Based', 'Incheon'],
      ['Type', '편집 디자인 페이지'],
    ],
  },
];

for (const p of PANELS) {
  const { facts, ...row } = p;

  /* 같은 slug 가 있으면 고치고, 없으면 넣는다 */
  const [existing] = await call(`/projects?select=id&slug=eq.${p.slug}&limit=1`);
  let id;
  if (existing) {
    const [saved] = await call(`/projects?id=eq.${existing.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ ...row, is_public: publish }),
    });
    id = saved.id;
  } else {
    const [saved] = await call('/projects', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ ...row, is_public: publish }),
    });
    id = saved.id;
  }

  /* 항목표는 지우고 다시 넣는다 — 순서와 개수가 바뀌어도 어긋나지 않게 */
  await call(`/project_facts?project_id=eq.${id}`, {
    method: 'DELETE', headers: { Prefer: 'return=minimal' },
  });
  await call('/project_facts', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(facts.map(([label, value], i) => ({
      project_id: id, label, value, sort_order: i + 1, is_public: publish,
    }))),
  });

  console.log(`  ${p.slug.padEnd(9)} 항목 ${facts.length}개${existing ? ' (고침)' : ' (새로)'}`);
}

console.log(`\n작업물 ${PANELS.length}개를 옮겼습니다. (공개 ${publish})`);

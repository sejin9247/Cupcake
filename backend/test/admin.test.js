/* 관리자 로그인 · 프로젝트 저장 규칙 · 중복 정리. 임시 폴더와 테스트용 비밀번호로 실행한다. */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { hashPassword } from '../src/utils/password.js';

const PASSWORD = 'correct horse battery';
const dataDir = await mkdtemp(join(tmpdir(), 'cupcake-admin-'));
process.env.DATA_DIR = dataDir;
process.env.ADMIN_PASSWORD_HASH = await hashPassword(PASSWORD);
const { createApp } = await import('../src/app.js');

let server, base, token = null;
before(async () => {
  server = createApp({ serveFrontend: false }).listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api`;
});
after(async () => { server.close(); await rm(dataDir, { recursive: true, force: true }); });

const call = async (path, { method = 'GET', body, auth = true, headers = {} } = {}) => {
  const r = await fetch(base + path, {
    method,
    headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(auth && token && { Authorization: `Bearer ${token}` }), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: r.status, headers: r.headers, json: await r.json().catch(() => null) };
};

const FULL = { title: '도시 열섬 지도', role: '데이터 분석 · 시각화', description: '위성 영상으로 여름 지표 온도를 분석했습니다.', date: '2025.03 – 2025.06', members: 4, notes: '' };
let draftId;

test('session endpoint reveals only whether a password is set', async () => {
  const r = await call('/admin/session');
  assert.deepEqual(r.json, { configured: true, storage: true });
});

test('admin API rejects requests without a token', async () => {
  assert.equal((await call('/admin/projects')).status, 401);
  assert.equal((await call('/admin/projects', { method: 'POST', body: FULL })).status, 401);
  assert.equal((await call('/admin/projects', { headers: { Authorization: 'Bearer ' + 'x'.repeat(43) } })).status, 401);
});

test('wrong password → 401, and the hash is never sent back', async () => {
  const r = await call('/admin/login', { method: 'POST', body: { password: 'nope' } });
  assert.equal(r.status, 401);
  assert.ok(!JSON.stringify(r.json).includes('scrypt'));
});

test('login returns a token and sets no cookie', async () => {
  const r = await call('/admin/login', { method: 'POST', body: { password: PASSWORD } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('set-cookie'), null);
  assert.match(r.json.token, /^[\w-]{43}$/);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  token = r.json.token;
});

test('publishing requires every field except notes', async () => {
  const r = await call('/admin/projects', { method: 'POST', body: { status: 'published', title: '제목만' } });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.json.error.fields).sort(), ['date', 'description', 'members', 'role']);
});

test('a completely empty draft is rejected', async () => {
  assert.equal((await call('/admin/projects', { method: 'POST', body: { status: 'draft' } })).status, 400);
});

test('a partial draft is saved and stays off the public site', async () => {
  const r = await call('/admin/projects', { method: 'POST', body: { status: 'draft', title: '도시 열섬 지도', role: '분석' } });
  assert.equal(r.status, 201);
  draftId = r.json.project.id;
  assert.deepEqual((await call('/projects', { auth: false })).json.projects, []);
  const saved = (await call('/admin/projects')).json.projects;
  assert.equal(saved.length, 1);
  assert.equal(saved[0].role, '분석');   // 임시 저장한 내용이 그대로 남아 있다
});

test('a new project with the same title (ignoring spaces/case/symbols) → 409 with the duplicate', async () => {
  const r = await call('/admin/projects', { method: 'POST', body: { status: 'draft', title: ' 도시열섬-지도! ' } });
  assert.equal(r.status, 409);
  assert.deepEqual(r.json.error.details.duplicates.map(d => d.id), [draftId]);
});

test('"save separately" (allowDuplicate) creates it, and both are flagged as duplicates', async () => {
  const r = await call('/admin/projects', { method: 'POST', body: { status: 'draft', title: '도시열섬 지도', date: '2025.03', allowDuplicate: true } });
  assert.equal(r.status, 201);
  const list = (await call('/admin/projects')).json.projects;
  assert.equal(list.length, 2);
  for (const p of list) assert.equal(p.duplicateIds.length, 1);
});

test('merge fills empty fields from the target and removes the duplicate', async () => {
  const dup = (await call('/admin/projects')).json.projects.find(p => p.id !== draftId);
  const r = await call(`/admin/projects/${draftId}/merge`, {
    method: 'POST',
    body: { status: 'draft', title: '', role: '', description: '새 설명', date: dup.date, members: null, notes: '', removeId: dup.id },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.project.title, '도시 열섬 지도');   // 비운 칸 → 기존 값
  assert.equal(r.json.project.role, '분석');
  assert.equal(r.json.project.description, '새 설명');   // 입력한 칸 → 새 값
  assert.equal(r.json.project.date, '2025.03');
  const list = (await call('/admin/projects')).json.projects;
  assert.equal(list.length, 1);
  assert.deepEqual(list[0].duplicateIds, []);
});

test('merging a draft into a published project keeps it published and keeps its title', async () => {
  const pub = (await call('/admin/projects', { method: 'POST', body: { ...FULL, title: '공원 접근성', status: 'published' } })).json.project;
  const r = await call(`/admin/projects/${pub.id}/merge`, { method: 'POST', body: { status: 'draft', title: '공원-접근성!', notes: '공모전 제출' } });
  assert.equal(r.json.project.status, 'published');
  assert.equal(r.json.project.title, '공원 접근성');
  assert.equal(r.json.project.notes, '공모전 제출');
  assert.equal(r.json.project.role, FULL.role);
  await call(`/admin/projects/${pub.id}`, { method: 'DELETE' });
});

test('invalid member count is rejected', async () => {
  const r = await call(`/admin/projects/${draftId}`, { method: 'PUT', body: { ...FULL, status: 'published', members: 0 } });
  assert.equal(r.status, 400);
  assert.ok(r.json.error.fields.members);
});

test('editing a draft to published shows it on the site; back to draft hides it', async () => {
  assert.equal((await call(`/admin/projects/${draftId}`, { method: 'PUT', body: { ...FULL, status: 'published' } })).status, 200);
  const pub = (await call('/projects', { auth: false })).json.projects;
  assert.equal(pub.length, 1);
  assert.equal(pub[0].title, FULL.title);
  assert.equal(pub[0].status, undefined);   // 관리용 정보는 공개 응답에 없음
  assert.equal(pub[0].duplicateIds, undefined);

  assert.equal((await call(`/admin/projects/${draftId}`, { method: 'PUT', body: { ...FULL, status: 'draft' } })).status, 200);
  assert.deepEqual((await call('/projects', { auth: false })).json.projects, []);
});

test('projects are persisted to the data file', async () => {
  const saved = JSON.parse(await readFile(join(dataDir, 'projects.json'), 'utf8'));
  assert.equal(saved[0].title, FULL.title);
  assert.ok(!existsSync(join(dataDir, 'projects.json.tmp')));
});

test('non-JSON bodies are refused', async () => {
  const r = await call('/admin/projects', { method: 'POST', body: 'title=x', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  assert.equal(r.status, 415);
});

test('delete removes the project', async () => {
  assert.equal((await call(`/admin/projects/${draftId}`, { method: 'DELETE' })).status, 200);
  assert.equal((await call(`/admin/projects/${draftId}`, { method: 'DELETE' })).status, 404);
});

test('logout invalidates the token on the server', async () => {
  const old = token;
  assert.equal((await call('/admin/logout', { method: 'POST', body: {} })).status, 200);
  token = old;   // 같은 토큰을 다시 써도
  assert.equal((await call('/admin/projects')).status, 401);
  token = null;
});

test('repeated wrong passwords are rate-limited', async () => {
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await call('/admin/login', { method: 'POST', body: { password: 'bad' } })).status);
  assert.equal(statuses.at(-1), 429);
  // 차단 중에는 맞는 비밀번호도 거절
  assert.equal((await call('/admin/login', { method: 'POST', body: { password: PASSWORD } })).status, 429);
});

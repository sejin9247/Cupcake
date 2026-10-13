/* 진짜 Supabase projects 표를 상대로 하는 시험.
   .env에 SUPABASE_* 가 없으면 통째로 건너뛴다.
   넣는 줄에는 제목 앞에 표를 달고, 끝나면 그 표가 달린 줄만 지운다. */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

const skip = !(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
  && 'SUPABASE_URL · SUPABASE_SECRET_KEY 가 없어 건너뜁니다';

const repo = skip ? {} : await import('../src/repositories/project.repository.js');
const { db } = skip ? {} : await import('../src/db/supabase.js');

const MARK = '[시험]';
const wipe = async () => { if (!skip) await db.remove('projects', `title=like.${encodeURIComponent(MARK)}*`); };

before(wipe);
after(wipe);

const draft = (title, extra = {}) => ({
  title: `${MARK} ${title}`, role: '역할', description: '설명', date: '2026.01 – 2026.02',
  members: 3, notes: '', status: 'draft', ...extra,
});

test('초안으로 넣으면 비공개로 저장된다', { skip }, async () => {
  const p = await repo.create(draft('가'));
  assert.ok(p.id);
  assert.equal(p.status, 'draft');
  assert.equal(p.members, 3);
  assert.equal(p.date, '2026.01 – 2026.02', '기간은 바깥에서 date 로 보여야 한다');

  /* 표에는 is_public 으로 들어가야 한다 */
  const [row] = await db.select('projects', `select=is_public,period,title&id=eq.${p.id}`);
  assert.equal(row.is_public, false);
  assert.equal(row.period, '2026.01 – 2026.02');
});

test('공개로 바꾸면 표의 is_public 이 참이 된다', { skip }, async () => {
  const p = await repo.create(draft('나'));
  const up = await repo.update(p.id, { status: 'published' });
  assert.equal(up.status, 'published');

  const [row] = await db.select('projects', `select=is_public&id=eq.${p.id}`);
  assert.equal(row.is_public, true);
});

test('제목이 같아도 각각 저장되고 주소 이름이 겹치지 않는다', { skip }, async () => {
  const a = await repo.create(draft('같은제목'));
  const b = await repo.create(draft('같은제목'));
  assert.notEqual(a.id, b.id);

  const rows = await db.select('projects', `select=slug&id=in.(${a.id},${b.id})`);
  assert.equal(new Set(rows.map(r => r.slug)).size, 2, 'slug 가 서로 달라야 한다');
});

test('한글만 있는 제목도 저장된다', { skip }, async () => {
  const p = await repo.create(draft('한글제목만있음'));
  const [row] = await db.select('projects', `select=slug&id=eq.${p.id}`);
  assert.ok(row.slug && row.slug.length > 0, 'slug 가 비어 있으면 안 된다');
});

test('없는 것을 고치거나 지우면 알려 준다', { skip }, async () => {
  const none = '00000000-0000-0000-0000-000000000000';
  assert.equal(await repo.update(none, { title: `${MARK} 없음` }), null);
  assert.equal(await repo.remove(none), false);
});

test('지우면 사라진다', { skip }, async () => {
  const p = await repo.create(draft('지울것'));
  assert.equal(await repo.remove(p.id), true);
  assert.equal(await repo.get(p.id), null);
});

test('목록은 최근에 만든 것부터 나온다', { skip }, async () => {
  const mine = (await repo.list()).filter(p => p.title.startsWith(MARK));
  const times = mine.map(p => p.createdAt);
  assert.deepEqual(times, [...times].sort().reverse(), '만든 시각 역순이어야 한다');
  assert.ok(mine.every(p => p.status === 'draft' || p.status === 'published'));
});

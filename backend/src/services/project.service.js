/* 프로젝트 규칙
   - 공개(published): 참고사항(notes)을 뺀 모든 칸이 필수 → 사이트에 표시
   - 초안(draft): 빈칸 허용 (단, 전부 비어 있으면 저장하지 않음) → 관리자 화면에만 보임 */
import * as repo from '../repositories/project.repository.js';
import { HttpError } from '../utils/httpError.js';

export const STATUSES = ['draft', 'published'];

const TEXT_FIELDS = {
  title: { label: '제목', max: 100 },
  role: { label: '역할', max: 200 },
  description: { label: '설명', max: 5000 },
  date: { label: '날짜', max: 50 },
  notes: { label: '참고사항', max: 2000 },
};
const REQUIRED_FOR_PUBLISH = ['title', 'role', 'description', 'date', 'members'];

function normalize(input) {
  if (!input || typeof input !== 'object') throw new HttpError(400, '잘못된 요청입니다.');
  const fields = {};
  const out = {};

  for (const [k, { label, max }] of Object.entries(TEXT_FIELDS)) {
    const v = input[k] == null ? '' : input[k];
    if (typeof v !== 'string') { fields[k] = `${label}은(는) 글자로 입력하세요.`; continue; }
    out[k] = v.trim();
    if (out[k].length > max) fields[k] = `${label}은(는) ${max}자 이하로 입력하세요.`;
  }

  const m = input.members;
  if (m === '' || m == null) out.members = null;
  else if ((typeof m === 'number' || typeof m === 'string') && Number.isInteger(Number(m)) && Number(m) >= 1 && Number(m) <= 999) out.members = Number(m);
  else fields.members = '참여 인원은 1~999 사이의 숫자로 입력하세요.';

  out.status = input.status;
  if (!STATUSES.includes(out.status)) fields.status = '초안 또는 공개를 선택하세요.';

  if (out.status === 'published') {
    for (const k of REQUIRED_FOR_PUBLISH) {
      if (!fields[k] && (out[k] === '' || out[k] == null)) fields[k] = '공개하려면 꼭 입력해야 합니다.';
    }
  } else if (out.status === 'draft' && !Object.keys(fields).length &&
             Object.keys(TEXT_FIELDS).every(k => !out[k]) && out.members == null) {
    throw new HttpError(400, '적어도 한 칸은 입력해야 초안으로 저장할 수 있습니다.');
  }

  if (Object.keys(fields).length) throw new HttpError(400, '입력 내용을 확인하세요.', { fields });
  return out;
}

/* 사이트 방문자에게 보이는 모양 (상태·생성 시각 등 관리용 정보는 뺀다) */
const toPublic = ({ id, title, role, description, date, members, notes, updatedAt }) =>
  ({ id, title, role, description, date, members, notes, updatedAt });

export async function listPublished() {
  return (await repo.list()).filter(p => p.status === 'published').map(toPublic);
}

/* ---------- 중복 확인 ----------
   제목에서 띄어쓰기·기호·대소문자를 무시하고 같으면 중복으로 본다.
   예: "CBD 탐색기", "cbd탐색기", "CBD-탐색기!" → 모두 "cbd탐색기" */
export const duplicateKey = title => String(title ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

const summary = ({ id, title, status, updatedAt }) => ({ id, title, status, updatedAt });

function duplicatesOf(items, title, exceptId) {
  const key = duplicateKey(title);
  return key ? items.filter(p => p.id !== exceptId && duplicateKey(p.title) === key) : [];
}

/* allowDuplicate: 관리자가 "그래도 따로 저장"을 고른 경우 */
async function assertNoDuplicate(data, exceptId, allowDuplicate) {
  if (allowDuplicate) return;
  const dups = duplicatesOf(await repo.list(), data.title, exceptId);
  if (dups.length) {
    throw new HttpError(409, `제목이 같은 프로젝트가 이미 있습니다: ${dups.map(p => p.title).join(', ')}`,
      { details: { duplicates: dups.map(summary) } });
  }
}

/* 관리자 목록: 각 프로젝트에 중복 후보 id를 붙여 준다 */
export async function listAll() {
  const items = await repo.list();
  return items.map(p => ({ ...p, duplicateIds: duplicatesOf(items, p.title, p.id).map(d => d.id) }));
}

export async function createProject(input) {
  const data = normalize(input);
  await assertNoDuplicate(data, null, input.allowDuplicate === true);
  return repo.create(data);
}

export async function updateProject(id, input) {
  const data = normalize(input);
  await assertNoDuplicate(data, id, input.allowDuplicate === true);
  const saved = await repo.update(id, data);
  if (!saved) throw new HttpError(404, '프로젝트를 찾을 수 없습니다.');
  return saved;
}

/* 통합: 입력 내용을 기존 프로젝트(targetId)에 합친다. removeId가 있으면 그 중복 항목은 지운다.
   - 입력한 칸은 입력값으로, 비워 둔 칸은 기존 값으로 (제목은 기존 제목 유지)
   - 둘 중 하나라도 공개였다면 공개로 둔다 (새로 입력한 초안을 합쳤다고 공개 중인 프로젝트가 숨지 않게) */
export async function mergeProject(targetId, input, removeId) {
  const target = await repo.get(targetId);
  if (!target) throw new HttpError(404, '통합할 프로젝트를 찾을 수 없습니다.');
  const merged = { status: target.status === 'published' || input.status === 'published' ? 'published' : 'draft' };
  for (const k of [...Object.keys(TEXT_FIELDS), 'members']) {
    const v = input[k];
    merged[k] = v === '' || v == null || (k === 'title' && target.title) ? target[k] : v;
  }
  const saved = await repo.update(targetId, normalize(merged));
  if (removeId && removeId !== targetId) await repo.remove(removeId);
  return saved;
}

export async function deleteProject(id) {
  if (!(await repo.remove(id))) throw new HttpError(404, '프로젝트를 찾을 수 없습니다.');
}

/* /api/admin — 관리자 전용. session·login 외에는 모두 로그인 토큰(Authorization: Bearer)이 필요하다. */
import { Router } from 'express';
import { bearerToken, requireAdmin } from '../middleware/requireAdmin.js';
import { adminConfigured, login, logout } from '../services/auth.service.js';
import { createProject, deleteProject, listAll, mergeProject, updateProject } from '../services/project.service.js';
import { store } from '../store/index.js';
import { HttpError } from '../utils/httpError.js';

export const adminRouter = Router();

adminRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if ((req.method === 'POST' || req.method === 'PUT') && !req.is('application/json')) {
    throw new HttpError(415, 'Content-Type은 application/json이어야 합니다.');
  }
  next();
});

/* GET /api/admin/session → 로그인 화면이 안내 문구를 고르는 데 쓴다 */
adminRouter.get('/session', (req, res) => {
  res.json({ configured: adminConfigured(), storage: store.persistent });
});

/* POST /api/admin/login { password } → { token } */
adminRouter.post('/login', async (req, res) => {
  res.json({ token: await login(req.body?.password, req.ip) });
});

adminRouter.post('/logout', async (req, res) => {
  await logout(bearerToken(req));
  res.json({ ok: true });
});

/* 프로젝트 관리 (초안 포함 전체) */
adminRouter.get('/projects', requireAdmin, async (req, res) => {
  res.json({ projects: await listAll() });
});

adminRouter.post('/projects', requireAdmin, async (req, res) => {
  res.status(201).json({ project: await createProject(req.body) });
});

adminRouter.put('/projects/:id', requireAdmin, async (req, res) => {
  res.json({ project: await updateProject(req.params.id, req.body) });
});

/* POST /api/admin/projects/:id/merge { ...입력값, removeId? } → 중복 통합 */
adminRouter.post('/projects/:id/merge', requireAdmin, async (req, res) => {
  const { removeId, ...input } = req.body ?? {};
  res.json({ project: await mergeProject(req.params.id, input, removeId) });
});

adminRouter.delete('/projects/:id', requireAdmin, async (req, res) => {
  await deleteProject(req.params.id);
  res.json({ ok: true });
});

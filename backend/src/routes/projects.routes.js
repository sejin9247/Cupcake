import { Router } from 'express';
import { listPublished } from '../services/project.service.js';

export const projectsRouter = Router();

/* GET /api/projects → 공개된 프로젝트만 (사이트용, 로그인 불필요) */
projectsRouter.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json({ projects: await listPublished() });
});

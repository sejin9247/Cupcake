import { Router } from 'express';
import { dbStatus } from '../db/index.js';
import { serverHasSgisKey } from '../services/sgis.service.js';

export const healthRouter = Router();

/* 프론트엔드가 시작할 때 이 주소로 백엔드가 켜져 있는지 확인한다 */
healthRouter.get('/', (req, res) => {
  res.json({ ok: true, sgis: serverHasSgisKey(), db: dbStatus() });
});

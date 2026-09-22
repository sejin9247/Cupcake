import { Router } from 'express';
import { sgisGet, sgisTest } from '../services/sgis.service.js';

export const sgisRouter = Router();

/* 브라우저 설정 창에 키를 넣은 경우 헤더로 실려 온다. 없으면 서버 .env 키를 쓴다. */
const credsOf = req => ({ key: req.get('X-SGIS-Key') || '', secret: req.get('X-SGIS-Secret') || '' });

/* POST /api/sgis/test → { ok: true }  (키 확인) */
sgisRouter.post('/test', async (req, res) => {
  await sgisTest(credsOf(req), req.abortSignal);
  res.json({ ok: true });
});

/* GET /api/sgis/addr/stage.json?cd=11  등 — SGIS 응답을 그대로 돌려준다 */
sgisRouter.get('/*path', async (req, res) => {
  const path = [].concat(req.params.path).join('/');
  res.json(await sgisGet(path, req.query, credsOf(req), req.abortSignal));
});

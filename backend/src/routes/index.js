/* /api 아래 라우트 목록. 새 API는 routes/에 파일을 만들고 여기에 한 줄 추가한다. */
import { Router } from 'express';
import { config } from '../config/index.js';
import { adminRouter } from './admin.routes.js';
import { geoRouter } from './geo.routes.js';
import { healthRouter } from './health.routes.js';
import { overpassRouter } from './overpass.routes.js';
import { projectsRouter } from './projects.routes.js';
import { sgisRouter } from './sgis.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/admin', adminRouter);

// 외부 API 중계 — 로컬 개발용 (배포에서는 config.enableProxy가 false)
if (config.enableProxy) {
  apiRouter.use('/geo', geoRouter);
  apiRouter.use('/overpass', overpassRouter);
  apiRouter.use('/sgis', sgisRouter);
}

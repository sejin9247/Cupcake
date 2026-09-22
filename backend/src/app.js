/* Express 앱 구성. 서버 실행(listen)은 server.js가 맡아, 테스트에서 이 앱을 그대로 불러 쓸 수 있다.
   Vercel 배포에서는 저장소 루트의 api/index.js가 이 앱을 서버리스 함수로 내보낸다. */
import cors from 'cors';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { config } from './config/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { requestSignal } from './middleware/requestSignal.js';
import { apiRouter } from './routes/index.js';

const FRONTEND_DIR = fileURLToPath(new URL('../../frontend/', import.meta.url));

/* 관리자 화면 보안 헤더 — 배포에서는 vercel.json의 headers가 같은 값을 붙인다
   no-store: 뒤로 가기·캐시로 관리 화면이 다시 보이지 않게 / CSP: 외부 스크립트 실행 차단 */
export const ADMIN_PAGE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
};

export function createApp({ serveFrontend = true } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Vercel 앞단이 넣어 주는 X-Forwarded-For로 실제 접속 IP를 알아낸다 (로그인 시도 제한용)
  if (config.onVercel) app.set('trust proxy', 1);

  app.use('/api', cors({ origin: config.corsOrigins, allowedHeaders: ['Content-Type', 'X-SGIS-Key', 'X-SGIS-Secret'] }));
  app.use('/api', express.json({ limit: '100kb' }), requestSignal, apiRouter);
  app.use('/api', notFound);

  // 개발 편의: http://localhost:4000 에서 프론트엔드까지 한 번에 연다 (배포 시 프론트엔드는 Vercel)
  if (serveFrontend) {
    app.use('/admin', (req, res, next) => { res.set(ADMIN_PAGE_HEADERS); next(); });
    app.use(express.static(FRONTEND_DIR, { extensions: ['html'] }));
  }

  app.use(errorHandler);
  return app;
}

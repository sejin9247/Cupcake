/* Vercel 서버리스 함수 진입점.
   vercel.json의 rewrites가 /api/* 요청을 모두 이 함수로 보내고, backend/의 Express 앱이 처리한다.
   정적 파일(frontend/)은 Vercel이 직접 서빙하므로 여기서는 API만 다룬다. */
import { createApp } from '../backend/src/app.js';

export default createApp({ serveFrontend: false });

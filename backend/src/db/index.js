/* 데이터베이스 연결 지점 — 아직 연결하지 않았다.

   연결할 때:
   1. 드라이버 설치 (예: npm install pg)
   2. connectDb()에서 풀을 만들어 db에 넣는다
   3. 테이블 접근은 src/repositories/에 저장소 파일을 추가해 그 안에서만 한다
      (라우트·서비스는 저장소 함수만 호출)

   예시 (PostgreSQL):
     import pg from 'pg';
     db = new pg.Pool({ connectionString: config.db.url });
     await db.query('select 1');
*/
import { config } from '../config/index.js';

let db = null;

export async function connectDb() {
  if (!config.db.url) {
    console.log('[db] DATABASE_URL 없음 — DB 없이 실행합니다');
    return null;
  }
  console.warn('[db] DATABASE_URL이 있지만 드라이버가 아직 연결되지 않았습니다 (src/db/index.js 참고)');
  return null;
}

export async function disconnectDb() {
  await db?.end?.();
  db = null;
}

export const getDb = () => db;
export const dbStatus = () => (db ? 'connected' : 'disconnected');
